import { create } from 'zustand';
import type { TelemetryFrame } from '../../../shared/telemetry';
import type { ServerStatus } from '../../../shared/api';
import type { ClientMessage, ConnectionMode, ReplayState } from '../../../shared/protocol';

export type ConnectionState = 'connecting' | 'open' | 'closed';

/** Samples kept for the rolling charts (~10 s at 30 Hz). */
const HISTORY_LEN = 300;

export interface ReplayInfo {
  active: boolean;
  sessionId: string | null;
  state: ReplayState;
  speed: number;
  frameIndex: number;
  elapsedMs: number;
  totalMs: number;
}

export interface History {
  speed: number[];
  rpm: number[];
  throttle: number[];
  brake: number[];
}

const emptyHistory = (): History => ({ speed: [], rpm: [], throttle: [], brake: [] });

const emptyReplay = (): ReplayInfo => ({
  active: false,
  sessionId: null,
  state: 'ended',
  speed: 1,
  frameIndex: 0,
  elapsedMs: 0,
  totalMs: 0,
});

function pushCapped(arr: number[], value: number): number[] {
  const next = arr.length >= HISTORY_LEN ? arr.slice(arr.length - HISTORY_LEN + 1) : arr.slice();
  next.push(value);
  return next;
}

interface TelemetryStore {
  frame: TelemetryFrame | null;
  source: ConnectionMode;
  connection: ConnectionState;
  mode: ConnectionMode;
  status: ServerStatus | null;
  replay: ReplayInfo;
  history: History;
  lastFrameAt: number;
  send: (msg: ClientMessage) => void;

  pushFrame: (frame: TelemetryFrame, source: ConnectionMode) => void;
  setConnection: (connection: ConnectionState) => void;
  setMode: (mode: ConnectionMode) => void;
  setStatus: (status: ServerStatus) => void;
  patchReplay: (patch: Partial<ReplayInfo>) => void;
  resetReplay: () => void;
  setSend: (send: (msg: ClientMessage) => void) => void;
}

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  frame: null,
  source: 'live',
  connection: 'connecting',
  mode: 'live',
  status: null,
  replay: emptyReplay(),
  history: emptyHistory(),
  lastFrameAt: 0,
  send: () => {},

  pushFrame: (frame, source) =>
    set((state) => ({
      frame,
      source,
      mode: source,
      lastFrameAt: Date.now(),
      history: {
        speed: pushCapped(state.history.speed, frame.speed),
        rpm: pushCapped(state.history.rpm, frame.currentEngineRpm),
        throttle: pushCapped(state.history.throttle, frame.accelerator),
        brake: pushCapped(state.history.brake, frame.brake),
      },
    })),

  setConnection: (connection) => set({ connection }),
  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),

  patchReplay: (patch) => set((state) => ({ replay: { ...state.replay, ...patch } })),

  resetReplay: () => set({ replay: emptyReplay(), history: emptyHistory() }),

  setSend: (send) => set({ send }),
}));
