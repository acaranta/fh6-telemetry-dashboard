import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTelemetryStore } from '../../state/telemetryStore';
import { makeMapCrs } from '../../map/mapCrs';
import { calibrationCenterPixel } from '../../map/calibration';
import { api } from '../../lib/api';
import { DEFAULT_MAP_SETTINGS, FH6_MAP, type MapCalibration } from '../../../../shared/mapDefaults';

interface CapturePoint {
  world: [number, number] | null;
  pixel: [number, number] | null;
}

type Slot = 'A' | 'B';

interface MapCalibratorProps {
  onClose: () => void;
}

export function MapCalibrator({ onClose }: MapCalibratorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapEnabled = useTelemetryStore((s) => s.status?.map.enabled ?? true);

  const [pointA, setPointA] = useState<CapturePoint>({ world: null, pixel: null });
  const [pointB, setPointB] = useState<CapturePoint>({ world: null, pixel: null });
  const [activeSlot, setActiveSlot] = useState<Slot>('A');
  const [status, setStatus] = useState<string | null>(null);

  const activeSlotRef = useRef<Slot>('A');
  activeSlotRef.current = activeSlot;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const map = L.map(el, {
      crs: makeMapCrs(),
      minZoom: 0,
      maxZoom: 18,
      attributionControl: false,
    });

    // Open over the actual map area rather than the tile-pyramid origin.
    const centerOnCalibration = (cal: MapCalibration): void => {
      map.setView(map.unproject(L.point(calibrationCenterPixel(cal)), FH6_MAP.maxZoom), 12);
    };
    centerOnCalibration(DEFAULT_MAP_SETTINGS.calibration);
    api
      .settings()
      .then((s) => centerOnCalibration(s.calibration))
      .catch(() => {
        /* keep the default centre */
      });

    if (mapEnabled) {
      L.tileLayer('/maptiles/{z}/{x}/{y}.jpg', {
        tileSize: FH6_MAP.tileSize,
        minNativeZoom: FH6_MAP.minZoom,
        maxNativeZoom: FH6_MAP.maxZoom,
        noWrap: true,
      }).addTo(map);
    }

    const markerA = L.circleMarker([0, 0], { radius: 7, color: '#22c55e', fillOpacity: 0.8 });
    const markerB = L.circleMarker([0, 0], { radius: 7, color: '#3b82f6', fillOpacity: 0.8 });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const projected = map.project(e.latlng, FH6_MAP.maxZoom);
      const pixel: [number, number] = [projected.x, projected.y];
      if (activeSlotRef.current === 'A') {
        setPointA((p) => ({ ...p, pixel }));
        markerA.setLatLng(e.latlng).addTo(map);
      } else {
        setPointB((p) => ({ ...p, pixel }));
        markerB.setLatLng(e.latlng).addTo(map);
      }
    });

    const sizeTimer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => {
      window.clearTimeout(sizeTimer);
      map.remove();
    };
  }, [mapEnabled]);

  const captureWorld = (slot: Slot): void => {
    const frame = useTelemetryStore.getState().frame;
    if (!frame) {
      setStatus('No live telemetry — drive in-game to capture a world position.');
      return;
    }
    const world: [number, number] = [frame.positionX, frame.positionZ];
    if (slot === 'A') setPointA((p) => ({ ...p, world }));
    else setPointB((p) => ({ ...p, world }));
    setStatus(null);
  };

  const complete = (p: CapturePoint): boolean => p.world !== null && p.pixel !== null;
  const canSave = complete(pointA) && complete(pointB);

  const save = async (): Promise<void> => {
    if (!canSave) return;
    const calibration: MapCalibration = {
      worldA: pointA.world as [number, number],
      pixelA: pointA.pixel as [number, number],
      worldB: pointB.world as [number, number],
      pixelB: pointB.pixel as [number, number],
    };
    try {
      await api.saveSettings({ calibration, defaultView: null });
      setStatus('Calibration saved. Reopen the dashboard to apply.');
      window.setTimeout(onClose, 1200);
    } catch {
      setStatus('Failed to save calibration.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-xl border border-cockpit-edge bg-cockpit-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Track Map Calibration</h2>
          <button
            onClick={onClose}
            className="rounded border border-cockpit-edge px-3 py-1 text-sm text-slate-300 hover:bg-cockpit-bg"
          >
            Close
          </button>
        </div>

        <div className="rounded-lg border border-cockpit-edge bg-cockpit-bg/50 p-3 text-xs text-slate-400">
          <p className="mb-1.5 text-slate-300">
            Calibration lines the game's world coordinates up with the map image — you only need to
            do it once.
          </p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              In-game, drive to a sharp, easily-recognisable landmark — a tight corner or a junction
              works best.
            </li>
            <li>
              Select <span className="text-slate-200">Point A</span> below and press{' '}
              <span className="text-slate-200">Capture world</span> to record the car's position.
            </li>
            <li>Click that exact same spot on the map.</li>
            <li>
              Repeat for <span className="text-slate-200">Point B</span> at a second landmark, as
              far from the first as possible for accuracy.
            </li>
            <li>
              Press <span className="text-slate-200">Save Calibration</span> — the track map will
              use it from then on.
            </li>
          </ol>
        </div>

        <div
          ref={containerRef}
          className="isolate h-72 w-full shrink-0 overflow-hidden rounded bg-cockpit-bg"
        />

        <div className="grid grid-cols-2 gap-3">
          <SlotCard
            slot="A"
            point={pointA}
            active={activeSlot === 'A'}
            onActivate={() => setActiveSlot('A')}
            onCaptureWorld={() => captureWorld('A')}
          />
          <SlotCard
            slot="B"
            point={pointB}
            active={activeSlot === 'B'}
            onActivate={() => setActiveSlot('B')}
            onCaptureWorld={() => captureWorld('B')}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-amber-300">{status}</span>
          <button
            onClick={() => void save()}
            disabled={!canSave}
            className="rounded bg-cockpit-accent px-4 py-1.5 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Calibration
          </button>
        </div>
      </div>
    </div>
  );
}

interface SlotCardProps {
  slot: Slot;
  point: CapturePoint;
  active: boolean;
  onActivate: () => void;
  onCaptureWorld: () => void;
}

function SlotCard({ slot, point, active, onActivate, onCaptureWorld }: SlotCardProps) {
  const fmt = (p: [number, number] | null): string =>
    p ? `${p[0].toFixed(1)}, ${p[1].toFixed(1)}` : '—';

  return (
    <div
      onClick={onActivate}
      className={`cursor-pointer rounded-lg border p-2.5 ${
        active ? 'border-cockpit-accent bg-cockpit-bg' : 'border-cockpit-edge bg-cockpit-bg/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-200">Point {slot}</span>
        {active && (
          <span className="text-[10px] uppercase text-cockpit-accent">click map to set</span>
        )}
      </div>
      <dl className="mt-1.5 space-y-0.5 font-mono text-[11px] text-slate-400">
        <div className="flex justify-between">
          <dt>world</dt>
          <dd>{fmt(point.world)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>pixel</dt>
          <dd>{fmt(point.pixel)}</dd>
        </div>
      </dl>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCaptureWorld();
        }}
        className="mt-2 w-full rounded border border-cockpit-edge px-2 py-1 text-xs text-slate-300 hover:bg-cockpit-panel"
      >
        Capture world
      </button>
    </div>
  );
}
