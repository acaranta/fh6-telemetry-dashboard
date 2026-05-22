import { EventEmitter } from 'node:events';
import type { TelemetryFrame } from '../../../shared/telemetry';

type FrameListener = (frame: TelemetryFrame) => void;

/**
 * In-process fan-out point for live telemetry. The UDP receiver emits parsed
 * frames here; the broadcaster and the session recorder subscribe. Neither side
 * knows about the other.
 */
export class TelemetryBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitFrame(frame: TelemetryFrame): void {
    this.emit('frame', frame);
  }

  onFrame(listener: FrameListener): void {
    this.on('frame', listener);
  }

  offFrame(listener: FrameListener): void {
    this.off('frame', listener);
  }
}
