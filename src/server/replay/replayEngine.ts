import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import type { Logger } from '../logger';
import type { SessionStore } from '../session/sessionStore';
import type { ReplayService, ReplaySession } from '../ws/wsServer';
import type { ServerMessage } from '../../../shared/protocol';
import type { TelemetryFrame } from '../../../shared/telemetry';
import type { SessionManifest } from '../../../shared/session';

/** Inter-frame gaps longer than this (menu pauses) are compressed in replay. */
const MAX_GAP_MS = 5000;
/** Wake-up granularity while waiting — bounds pause/speed/stop latency. */
const POLL_MS = 150;
const PROGRESS_INTERVAL_MS = 500;
const MIN_SPEED = 0.1;
const MAX_SPEED = 16;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

/**
 * Streams one recorded session to a single client at original timing,
 * honouring pause/resume/stop/speed/seek. The JSONL file is read line by line
 * so memory stays flat regardless of session size.
 */
class ReplayRunner implements ReplaySession {
  private stopped = false;
  private paused = false;
  private speed: number;
  private virtualElapsedMs = 0;
  private playToken = 0;
  private lastProgressWall = 0;

  constructor(
    private readonly dataPath: string,
    private readonly manifest: SessionManifest,
    private readonly logger: Logger,
    private readonly send: (msg: ServerMessage) => void,
    speed: number,
  ) {
    this.speed = clampSpeed(speed);
  }

  begin(): void {
    this.send({
      type: 'replay.state',
      state: 'playing',
      sessionId: this.manifest.id,
      speed: this.speed,
    });
    this.startPass(0);
  }

  pause(): void {
    if (this.stopped || this.paused) return;
    this.paused = true;
    this.emitState('paused');
  }

  resume(): void {
    if (this.stopped || !this.paused) return;
    this.paused = false;
    this.emitState('playing');
  }

  setSpeed(speed: number): void {
    if (this.stopped) return;
    this.speed = clampSpeed(speed);
    this.emitState(this.paused ? 'paused' : 'playing');
  }

  seek(toMs: number): void {
    if (this.stopped) return;
    this.virtualElapsedMs = Math.max(0, toMs);
    this.startPass(this.virtualElapsedMs);
  }

  stop(): void {
    this.stopped = true;
    this.playToken += 1;
  }

  private emitState(state: 'playing' | 'paused' | 'ended'): void {
    this.send({
      type: 'replay.state',
      state,
      sessionId: this.manifest.id,
      speed: this.speed,
    });
  }

  private startPass(offsetMs: number): void {
    const token = ++this.playToken;
    this.virtualElapsedMs = offsetMs;
    void this.playPass(token, offsetMs).catch((err: unknown) => {
      this.logger.error({ err }, `replay of ${this.manifest.id} failed`);
      if (token === this.playToken) {
        this.send({ type: 'error', code: 'replay_error', message: 'replay stream failed' });
      }
    });
  }

  private cancelled(token: number): boolean {
    return this.stopped || token !== this.playToken;
  }

  private async playPass(token: number, offsetMs: number): Promise<void> {
    const fileStream = fs.createReadStream(this.dataPath);
    const input = this.manifest.compressed ? fileStream.pipe(zlib.createGunzip()) : fileStream;
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    let prevRecvTime = -1;
    let targetOffset = 0;
    let frameIndex = 0;

    try {
      for await (const line of rl) {
        if (this.cancelled(token)) return;
        const trimmed = line.trim();
        if (!trimmed) continue;

        let frame: TelemetryFrame;
        try {
          frame = JSON.parse(trimmed) as TelemetryFrame;
        } catch {
          continue;
        }

        if (prevRecvTime < 0) {
          prevRecvTime = frame.recvTime;
        } else {
          targetOffset += Math.min(frame.recvTime - prevRecvTime, MAX_GAP_MS);
          prevRecvTime = frame.recvTime;
        }
        frameIndex += 1;

        // Skip frames before the seek point.
        if (targetOffset < offsetMs) continue;

        await this.waitUntil(targetOffset, token);
        if (this.cancelled(token)) return;

        this.send({ type: 'telemetry', source: 'replay', frame });
        this.maybeSendProgress(frameIndex, targetOffset);
      }

      if (!this.cancelled(token)) {
        this.send({
          type: 'replay.progress',
          frameIndex,
          elapsedMs: targetOffset,
          totalMs: this.manifest.durationMs,
        });
        this.stopped = true;
        this.emitState('ended');
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }
  }

  /** Block until the replay clock reaches `targetOffset`, honouring pause/speed. */
  private async waitUntil(targetOffset: number, token: number): Promise<void> {
    while (this.virtualElapsedMs < targetOffset) {
      if (this.cancelled(token)) return;
      if (this.paused) {
        await sleep(POLL_MS);
        continue;
      }
      const remainingSession = targetOffset - this.virtualElapsedMs;
      const wallWait = Math.min(remainingSession / this.speed, POLL_MS);
      const before = Date.now();
      await sleep(wallWait);
      if (!this.paused) {
        this.virtualElapsedMs += (Date.now() - before) * this.speed;
      }
    }
  }

  private maybeSendProgress(frameIndex: number, elapsedMs: number): void {
    const now = Date.now();
    if (now - this.lastProgressWall < PROGRESS_INTERVAL_MS) return;
    this.lastProgressWall = now;
    this.send({
      type: 'replay.progress',
      frameIndex,
      elapsedMs,
      totalMs: this.manifest.durationMs,
    });
  }
}

/** Factory that resolves a session and spins up a per-connection replay. */
export class ReplayEngine implements ReplayService {
  constructor(
    private readonly logger: Logger,
    private readonly sessionStore: SessionStore,
  ) {}

  async start(
    sessionId: string,
    speed: number,
    send: (msg: ServerMessage) => void,
  ): Promise<ReplaySession> {
    const manifest = await this.sessionStore.getManifest(sessionId);
    if (!manifest) {
      throw new Error(`session "${sessionId}" not found`);
    }
    const dataPath = path.join(this.sessionStore.sessionDir(sessionId), manifest.dataFile);
    if (!fs.existsSync(dataPath)) {
      throw new Error(`telemetry data missing for session "${sessionId}"`);
    }

    const runner = new ReplayRunner(dataPath, manifest, this.logger, send, speed);
    runner.begin();
    this.logger.info(`replay started for session ${sessionId} at ${speed}x`);
    return runner;
  }
}
