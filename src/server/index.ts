import fs from 'node:fs';
import { loadConfig } from './config';
import { createLogger } from './logger';
import { createHttpServer } from './http/httpServer';
import { TelemetryBus } from './core/telemetryBus';
import { UdpReceiver } from './telemetry/udpReceiver';
import { LiveBroadcaster } from './ws/broadcaster';
import { WsServer } from './ws/wsServer';
import { SessionStore } from './session/sessionStore';
import { SessionManager, recoverInterruptedSessions } from './session/sessionManager';
import { ReplayEngine } from './replay/replayEngine';
import type { ServerStatus } from '../../shared/api';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info(
    {
      webPort: config.webPort,
      udpHost: config.udpHost,
      udpPort: config.udpPort,
      dataDir: config.dataDir,
    },
    'starting FH6 telemetry dashboard',
  );

  fs.mkdirSync(config.sessionsDir, { recursive: true });
  fs.mkdirSync(config.mapTilesDir, { recursive: true });

  await recoverInterruptedSessions(config, logger);

  const bus = new TelemetryBus();
  const udpReceiver = new UdpReceiver(config, logger, bus);
  const broadcaster = new LiveBroadcaster(bus, config.broadcastHz);
  const sessionStore = new SessionStore(config.sessionsDir, logger);
  const sessionManager = new SessionManager(config, logger, bus);

  const getStatus = (): ServerStatus => {
    const udp = udpReceiver.getStats();
    const lastPacketMs = udpReceiver.getLastPacketTime();
    const recording = sessionManager.getStatus();
    return {
      mode: 'live',
      udp: {
        host: udp.host,
        port: udp.port,
        packetsReceived: udp.packetsReceived,
        parseErrors: udp.parseErrors,
        bytesReceived: udp.bytesReceived,
        lastPacketAt: udp.lastPacketAt,
        receivingPackets: lastPacketMs > 0 && Date.now() - lastPacketMs < 2000,
        lockedSender: udp.lockedSender,
      },
      recording,
      map: {
        enabled: config.mapEnabled,
        tilesAvailable: false,
        tileDownload: 'idle',
        tileCount: 0,
      },
      allowDeleteSessions: config.allowDeleteSessions,
    };
  };

  const http = createHttpServer(config, logger, { getStatus, sessionStore });
  const wsServer = new WsServer(http.server, logger, broadcaster, getStatus);
  wsServer.setReplayService(new ReplayEngine(logger, sessionStore));

  broadcaster.start();
  sessionManager.start();
  await http.listen({ host: '0.0.0.0', port: config.webPort });
  logger.info(`HTTP server listening on :${config.webPort}`);

  await udpReceiver.start();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down`);
    broadcaster.stop();
    await udpReceiver.stop();
    await sessionManager.shutdown();
    await wsServer.close();
    await http.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('fatal startup error', err);
  process.exit(1);
});
