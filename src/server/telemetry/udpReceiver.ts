import dgram from 'node:dgram';
import type { Config } from '../config';
import type { Logger } from '../logger';
import type { TelemetryBus } from '../core/telemetryBus';
import { Fh6ParseError, parseFrame } from './forzaParser';

export interface UdpStats {
  host: string;
  port: number;
  packetsReceived: number;
  parseErrors: number;
  bytesReceived: number;
  lastPacketAt: string | null;
  lockedSender: string | null;
}

/**
 * Listens for Forza Data Out UDP datagrams, parses them and pushes frames onto
 * the telemetry bus. Never throws on bad packets — parse failures are counted
 * and logged at debug level.
 */
export class UdpReceiver {
  private socket: dgram.Socket | null = null;
  private packetsReceived = 0;
  private parseErrors = 0;
  private bytesReceived = 0;
  private lastPacketTime = 0;
  private lockedSender: string | null = null;
  private firstPacketLogged = false;

  constructor(
    private readonly config: Config,
    private readonly logger: Logger,
    private readonly bus: TelemetryBus,
  ) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      this.socket = socket;

      const onError = (err: Error): void => {
        this.logger.error({ err }, 'UDP socket error');
        reject(err);
      };

      socket.once('error', onError);
      socket.on('message', (buf, rinfo) => this.handleMessage(buf, rinfo));

      socket.bind(this.config.udpPort, this.config.udpHost, () => {
        socket.off('error', onError);
        socket.on('error', (err) => this.logger.error({ err }, 'UDP socket error'));
        this.logger.info(`UDP receiver listening on ${this.config.udpHost}:${this.config.udpPort}`);
        resolve();
      });
    });
  }

  private handleMessage(buf: Buffer, rinfo: dgram.RemoteInfo): void {
    const recvTime = Date.now();

    if (this.config.lockToFirstSender) {
      if (this.lockedSender && recvTime - this.lastPacketTime > this.config.sessionTimeoutMs) {
        this.logger.info(`sender lock on ${this.lockedSender} expired`);
        this.lockedSender = null;
      }
      if (!this.lockedSender) {
        this.lockedSender = rinfo.address;
        this.logger.info(`locked to sender ${rinfo.address}`);
      } else if (this.lockedSender !== rinfo.address) {
        return;
      }
    }

    try {
      const frame = parseFrame(buf, recvTime);
      this.packetsReceived += 1;
      this.bytesReceived += buf.length;
      this.lastPacketTime = recvTime;

      if (!this.firstPacketLogged) {
        this.firstPacketLogged = true;
        this.logger.info(
          `first telemetry packet received from ${rinfo.address} (${buf.length} bytes)`,
        );
      }

      this.bus.emitFrame(frame);
    } catch (err) {
      this.parseErrors += 1;
      if (err instanceof Fh6ParseError) {
        this.logger.debug(`failed to parse packet from ${rinfo.address}: ${err.message}`);
      } else {
        this.logger.warn({ err }, `unexpected error parsing packet from ${rinfo.address}`);
      }
    }
  }

  getLastPacketTime(): number {
    return this.lastPacketTime;
  }

  getStats(): UdpStats {
    return {
      host: this.config.udpHost,
      port: this.config.udpPort,
      packetsReceived: this.packetsReceived,
      parseErrors: this.parseErrors,
      bytesReceived: this.bytesReceived,
      lastPacketAt: this.lastPacketTime ? new Date(this.lastPacketTime).toISOString() : null,
      lockedSender: this.lockedSender,
    };
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }
      this.socket.close(() => {
        this.socket = null;
        resolve();
      });
    });
  }
}
