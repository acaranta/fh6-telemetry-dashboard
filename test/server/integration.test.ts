import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dgram from 'node:dgram';
import pino from 'pino';
import { WebSocket } from 'ws';
import { startServer, type ServerHandle } from '../../src/server/app';
import { buildPacket } from '../fixtures/buildPacket';
import type { Config } from '../../src/server/config';
import type { ServerMessage, TelemetryMsg } from '../../shared/protocol';

// A real (transport-less) pino logger — Fastify validates the logger instance.
const silentLogger = pino({ level: 'silent' });

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await sleep(20);
  }
}

let tmpDir: string;
let server: ServerHandle | null = null;

function makeConfig(webPort: number, udpPort: number): Config {
  return {
    webPort,
    udpHost: '127.0.0.1',
    udpPort,
    dataDir: tmpDir,
    sessionsDir: path.join(tmpDir, 'sessions'),
    mapTilesDir: path.join(tmpDir, 'maptiles'),
    settingsFile: path.join(tmpDir, 'settings.json'),
    sessionTimeoutMs: 60_000,
    compressFinishedSessions: false,
    allowDeleteSessions: false,
    lockToFirstSender: false,
    logLevel: 'silent',
    broadcastHz: 30,
    mapEnabled: false,
    mapAutodownloadTiles: false,
    mapTilesUrl: '',
    maxSessionListItems: 100,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh6-integration-'));
});

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('integration: UDP → WebSocket → recording', () => {
  it('delivers a UDP packet to a WebSocket client and records a session', async () => {
    const webPort = 19000 + Math.floor(Math.random() * 2000);
    const udpPort = 29000 + Math.floor(Math.random() * 2000);
    const config = makeConfig(webPort, udpPort);
    server = await startServer(config, silentLogger);

    const ws = new WebSocket(`ws://127.0.0.1:${webPort}/ws`);
    const messages: ServerMessage[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()) as ServerMessage);
    });

    const udp = dgram.createSocket('udp4');
    const packet = buildPacket({ isRaceOn: 1, speed: 73, currentEngineRpm: 6200 });
    for (let i = 0; i < 6; i += 1) {
      await new Promise<void>((resolve) => udp.send(packet, udpPort, '127.0.0.1', () => resolve()));
      await sleep(40);
    }

    await waitFor(() => messages.some((m) => m.type === 'telemetry'));
    const telemetry = messages.find((m): m is TelemetryMsg => m.type === 'telemetry');
    expect(telemetry?.source).toBe('live');
    expect(telemetry?.frame.speed).toBe(73);

    await waitFor(
      () => fs.existsSync(config.sessionsDir) && fs.readdirSync(config.sessionsDir).length > 0,
    );
    const sessionId = fs.readdirSync(config.sessionsDir)[0];
    expect(fs.existsSync(path.join(config.sessionsDir, sessionId, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(config.sessionsDir, sessionId, 'telemetry.jsonl'))).toBe(true);

    udp.close();
    ws.close();
  });

  it('serves the health endpoint', async () => {
    const webPort = 19000 + Math.floor(Math.random() * 2000);
    const udpPort = 29000 + Math.floor(Math.random() * 2000);
    server = await startServer(makeConfig(webPort, udpPort), silentLogger);

    const res = await fetch(`http://127.0.0.1:${webPort}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
