import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { ReplayEngine } from '../../src/server/replay/replayEngine';
import { SessionStore } from '../../src/server/session/sessionStore';
import { parseFrame } from '../../src/server/telemetry/forzaParser';
import { buildPacket } from '../fixtures/buildPacket';
import type { Logger } from '../../src/server/logger';
import type { ServerMessage } from '../../shared/protocol';
import { SESSION_SCHEMA_VERSION, emptyStats, type SessionManifest } from '../../shared/session';

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Logger;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await sleep(15);
  }
}

let tmpDir: string;
let sessionsDir: string;

/** Create a recorded session on disk; returns its id. */
function createSession(frameCount: number, compressed = false): string {
  const id = `20260522-120000-${Math.random().toString(16).slice(2, 6)}`;
  const dir = path.join(sessionsDir, id);
  fs.mkdirSync(dir, { recursive: true });

  const lines: string[] = [];
  for (let i = 0; i < frameCount; i += 1) {
    lines.push(JSON.stringify(parseFrame(buildPacket({ speed: i }), 1000 + i * 16)));
  }
  const body = lines.join('\n') + '\n';

  const dataFile = compressed ? 'telemetry.jsonl.gz' : 'telemetry.jsonl';
  if (compressed) {
    fs.writeFileSync(path.join(dir, dataFile), zlib.gzipSync(body));
  } else {
    fs.writeFileSync(path.join(dir, dataFile), body);
  }

  const manifest: SessionManifest = {
    id,
    schemaVersion: SESSION_SCHEMA_VERSION,
    status: 'completed',
    endReason: 'timeout',
    createdBy: 'fh6-telemetry-dashboard',
    startedAt: new Date(1000).toISOString(),
    endedAt: new Date(1000 + frameCount * 16).toISOString(),
    durationMs: frameCount * 16,
    frameCount,
    droppedFrames: 0,
    dataFile,
    compressed,
    car: { ordinal: 0, class: 0, performanceIndex: 0, drivetrain: 0, cylinders: 0 },
    stats: emptyStats(),
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return id;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh6-replay-'));
  sessionsDir = path.join(tmpDir, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ReplayEngine', () => {
  it('streams every frame in order and ends', async () => {
    const id = createSession(10);
    const engine = new ReplayEngine(silentLogger, new SessionStore(sessionsDir, silentLogger));
    const messages: ServerMessage[] = [];

    await engine.start(id, 8, (m) => messages.push(m));
    await waitFor(() => messages.some((m) => m.type === 'replay.state' && m.state === 'ended'));

    const speeds = messages
      .filter((m): m is Extract<ServerMessage, { type: 'telemetry' }> => m.type === 'telemetry')
      .map((m) => m.frame.speed);
    expect(speeds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('replays a gzip-compressed session', async () => {
    const id = createSession(6, true);
    const engine = new ReplayEngine(silentLogger, new SessionStore(sessionsDir, silentLogger));
    const messages: ServerMessage[] = [];

    await engine.start(id, 8, (m) => messages.push(m));
    await waitFor(() => messages.some((m) => m.type === 'replay.state' && m.state === 'ended'));

    const telemetry = messages.filter((m) => m.type === 'telemetry');
    expect(telemetry).toHaveLength(6);
  });

  it('stops playback when stop() is called', async () => {
    const id = createSession(40);
    const engine = new ReplayEngine(silentLogger, new SessionStore(sessionsDir, silentLogger));
    const messages: ServerMessage[] = [];

    const session = await engine.start(id, 0.5, (m) => messages.push(m));
    session.stop();
    await sleep(300);

    const telemetry = messages.filter((m) => m.type === 'telemetry');
    expect(telemetry.length).toBeLessThan(40);
    expect(messages.some((m) => m.type === 'replay.state' && m.state === 'ended')).toBe(false);
  });

  it('pauses and resumes playback', async () => {
    const id = createSession(20);
    const engine = new ReplayEngine(silentLogger, new SessionStore(sessionsDir, silentLogger));
    const messages: ServerMessage[] = [];

    const session = await engine.start(id, 1, (m) => messages.push(m));
    session.pause();
    await sleep(250);
    const whilePaused = messages.filter((m) => m.type === 'telemetry').length;
    expect(whilePaused).toBeLessThan(20);

    session.resume();
    await waitFor(() => messages.some((m) => m.type === 'replay.state' && m.state === 'ended'));
    const total = messages.filter((m) => m.type === 'telemetry').length;
    expect(total).toBe(20);
  });

  it('rejects an unknown session', async () => {
    const engine = new ReplayEngine(silentLogger, new SessionStore(sessionsDir, silentLogger));
    await expect(engine.start('does-not-exist', 1, () => {})).rejects.toThrow();
  });
});
