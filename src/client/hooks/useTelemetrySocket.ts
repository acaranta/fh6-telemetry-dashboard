import { useEffect } from 'react';
import { useTelemetryStore } from '../state/telemetryStore';
import type { ClientMessage, ServerMessage } from '../../../shared/protocol';

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

/**
 * Owns the single WebSocket connection: auto-reconnects with capped backoff
 * and routes inbound messages into the telemetry store. Call once, at the app
 * root.
 */
export function useTelemetrySocket(): void {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let backoff = 250;
    let closedByUs = false;

    const handle = (msg: ServerMessage): void => {
      const store = useTelemetryStore.getState();
      switch (msg.type) {
        case 'hello':
          store.setMode(msg.mode);
          if (msg.mode === 'live') store.resetReplay();
          break;
        case 'telemetry':
          store.pushFrame(msg.frame, msg.source);
          break;
        case 'status':
          store.setStatus(msg.status);
          break;
        case 'replay.state':
          store.patchReplay({
            state: msg.state,
            sessionId: msg.sessionId,
            speed: msg.speed,
            active: true,
          });
          store.setMode('replay');
          break;
        case 'replay.progress':
          store.patchReplay({
            frameIndex: msg.frameIndex,
            elapsedMs: msg.elapsedMs,
            totalMs: msg.totalMs,
          });
          break;
        case 'error':
          console.warn(`[ws] ${msg.code}: ${msg.message}`);
          break;
        case 'pong':
          break;
      }
    };

    const connect = (): void => {
      useTelemetryStore.getState().setConnection('connecting');
      ws = new WebSocket(wsUrl());

      ws.onopen = () => {
        backoff = 250;
        useTelemetryStore.getState().setConnection('open');
      };
      ws.onmessage = (event) => {
        try {
          handle(JSON.parse(event.data as string) as ServerMessage);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        useTelemetryStore.getState().setConnection('closed');
        if (closedByUs) return;
        reconnectTimer = window.setTimeout(connect, backoff);
        backoff = Math.min(5000, backoff * 2);
      };
      ws.onerror = () => ws?.close();
    };

    const send = (msg: ClientMessage): void => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };
    useTelemetryStore.getState().setSend(send);

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);
}
