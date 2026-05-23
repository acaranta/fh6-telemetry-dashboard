import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTelemetryStore, type TrackPath } from '../../state/telemetryStore';
import { Panel } from '../common/Panel';
import { makeMapCrs } from '../../map/mapCrs';
import { calibrationCenterPixel, makeWorldToPixel, type WorldToPixel } from '../../map/calibration';
import { api } from '../../lib/api';
import { DEFAULT_MAP_SETTINGS, FH6_MAP, type MapCalibration } from '../../../../shared/mapDefaults';
import type { TelemetryFrame } from '../../../../shared/telemetry';
import { MapCalibrator } from './MapCalibrator';

const CAR_ICON_SVG =
  '<svg width="24" height="24" viewBox="0 0 24 24">' +
  '<polygon points="12,2 20,21 12,16 4,21" fill="#ff6b1a" stroke="#0a0c10" ' +
  'stroke-width="1.5" stroke-linejoin="round"/></svg>';

type ViewMode = 'live' | 'last-minute' | 'full';
const LIVE_MS = 5_000;
const LAST_MINUTE_MS = 60_000;

/**
 * Slice the track path to whatever should be visible right now. In "live" /
 * "last-minute" mode this keeps only the points within the trailing window
 * (LIVE_MS / LAST_MINUTE_MS) of the most recent sample, which is also the
 * replay playhead during replay.
 */
function visiblePath(path: TrackPath, mode: ViewMode): TrackPath {
  if (mode === 'full' || path.length === 0) return path;
  const window = mode === 'live' ? LIVE_MS : LAST_MINUTE_MS;
  const cutoff = path[path.length - 1][2] - window;
  // path is monotonically increasing in t — binary search the first kept index.
  let lo = 0;
  let hi = path.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path[mid][2] < cutoff) lo = mid + 1;
    else hi = mid;
  }
  return path.slice(lo);
}

export function TrackMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapEnabled = useTelemetryStore((s) => s.status?.map.enabled ?? true);
  const tileCount = useTelemetryStore((s) => s.status?.map.tileCount ?? 0);
  const downloadState = useTelemetryStore((s) => s.status?.map.tileDownload ?? 'idle');
  const [calibrating, setCalibrating] = useState(false);
  const [requested, setRequested] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const viewModeRef = useRef<ViewMode>('live');
  viewModeRef.current = viewMode;
  const fittedRef = useRef(false);
  const lastFitRef = useRef(0);
  const renderRef = useRef<((f: TelemetryFrame | null, p: TrackPath) => void) | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const map = L.map(el, {
      crs: makeMapCrs(),
      minZoom: 0,
      maxZoom: 18,
      attributionControl: false,
      preferCanvas: true,
    });
    mapRef.current = map;
    fittedRef.current = false;
    lastFitRef.current = 0;

    // Open over the actual map area, not the tile-pyramid origin.
    const centerOnCalibration = (cal: MapCalibration): void => {
      map.setView(map.unproject(L.point(calibrationCenterPixel(cal)), FH6_MAP.maxZoom), 12);
    };
    centerOnCalibration(DEFAULT_MAP_SETTINGS.calibration);

    if (mapEnabled) {
      // Tiles are proxied and cached lazily by the server on first request.
      const tileLayer = L.tileLayer('/maptiles/{z}/{x}/{y}.jpg', {
        tileSize: FH6_MAP.tileSize,
        minNativeZoom: FH6_MAP.minZoom,
        maxNativeZoom: FH6_MAP.maxZoom,
        noWrap: true,
        updateWhenIdle: false,
      });
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;
    }

    const line = L.polyline([], { color: '#ff6b1a', weight: 3, opacity: 0.9 }).addTo(map);
    const marker = L.marker([0, 0], {
      icon: L.divIcon({
        className: 'fh6-car-icon',
        html: CAR_ICON_SVG,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
      interactive: false,
    }).addTo(map);

    let worldToPixel: WorldToPixel = makeWorldToPixel(DEFAULT_MAP_SETTINGS.calibration);
    api
      .settings()
      .then((settings) => {
        worldToPixel = makeWorldToPixel(settings.calibration);
        if (!fittedRef.current) centerOnCalibration(settings.calibration);
      })
      .catch(() => {
        /* keep defaults */
      });

    const toLatLng = (x: number, z: number): L.LatLng =>
      map.unproject(L.point(worldToPixel(x, z)), FH6_MAP.maxZoom);

    const render = (frame: TelemetryFrame | null, path: TrackPath): void => {
      const visible = visiblePath(path, viewModeRef.current);
      const mode = viewModeRef.current;
      if (visible.length > 0) {
        line.setLatLngs(visible.map(([x, z]) => toLatLng(x, z)));
      } else {
        line.setLatLngs([]);
      }
      if (!frame) return;
      const carLatLng = toLatLng(frame.positionX, frame.positionZ);
      marker.setLatLng(carLatLng);
      const now = Date.now();
      if (mode === 'live') {
        // Lock the car to the centre of the viewport at a fixed zoom level.
        if (!fittedRef.current) {
          map.setView(carLatLng, 15, { animate: false });
          fittedRef.current = true;
        } else {
          map.panTo(carLatLng, { animate: false });
        }
      } else {
        // Last 60s / full track: keep the car centred AND the visible trace
        // entirely in view by fitting a bounds symmetric around the car so
        // the car sits at the centre while the trail still fits.
        map.panTo(carLatLng, { animate: false });
        if (visible.length > 1 && now - lastFitRef.current > 200) {
          const cx = frame.positionX;
          const cz = frame.positionZ;
          let mx = 0;
          let mz = 0;
          for (const [x, z] of visible) {
            const dx = Math.abs(x - cx);
            if (dx > mx) mx = dx;
            const dz = Math.abs(z - cz);
            if (dz > mz) mz = dz;
          }
          if (mx > 0 || mz > 0) {
            const sw = toLatLng(cx - mx, cz - mz);
            const ne = toLatLng(cx + mx, cz + mz);
            map.fitBounds(L.latLngBounds([sw, ne]), {
              padding: [24, 24],
              maxZoom: 16,
              animate: false,
            });
            lastFitRef.current = now;
          }
        }
      }
      const svg = marker.getElement()?.querySelector('svg');
      if (svg) svg.style.transform = `rotate(${(frame.yaw * 180) / Math.PI}deg)`;
    };
    renderRef.current = render;

    const initial = useTelemetryStore.getState();
    render(initial.frame, initial.trackPath);
    const unsubscribe = useTelemetryStore.subscribe((s) => render(s.frame, s.trackPath));
    const sizeTimer = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(sizeTimer);
      unsubscribe();
      tileLayerRef.current = null;
      renderRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [mapEnabled]);

  // Toggle fullscreen via ESC, and let Leaflet recompute its size when the
  // container's dimensions change. invalidateSize alone is not enough — the
  // tile layer keeps its previous bounds and won't fetch tiles for newly
  // revealed area (going fullscreen) or repaint stale tiles when shrinking
  // back. Re-applying the view and redrawing the tile layer fixes both.
  useEffect(() => {
    const refit = (): void => {
      const m = mapRef.current;
      if (!m) return;
      m.invalidateSize({ animate: false, pan: false });
      m.setView(m.getCenter(), m.getZoom(), { animate: false });
      tileLayerRef.current?.redraw();
    };
    // Two animation frames + a small delay so the toggled CSS has been
    // applied and the container has its new dimensions before we measure.
    const raf1 = window.requestAnimationFrame(() => {
      const raf2 = window.requestAnimationFrame(refit);
      cancelRefs.raf2 = raf2;
    });
    const cancelRefs: { raf2: number | null; timer: number | null } = {
      raf2: null,
      timer: window.setTimeout(refit, 120),
    };
    const cleanup = (): void => {
      window.cancelAnimationFrame(raf1);
      if (cancelRefs.raf2 != null) window.cancelAnimationFrame(cancelRefs.raf2);
      if (cancelRefs.timer != null) window.clearTimeout(cancelRefs.timer);
    };
    if (!fullscreen) return cleanup;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cleanup();
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  // When the view mode changes, force an immediate re-fit so the visible
  // window matches the new mode without waiting for the 5 s throttle.
  useEffect(() => {
    fittedRef.current = false;
    lastFitRef.current = 0;
    const st = useTelemetryStore.getState();
    renderRef.current?.(st.frame, st.trackPath);
  }, [viewMode]);

  const downloading = downloadState === 'downloading';
  const startDownload = async (): Promise<void> => {
    setRequested(true);
    try {
      await api.downloadMapTiles();
    } catch (err) {
      console.error(err);
    }
  };

  // Forget server-side failed tiles, then re-request the visible ones.
  const refreshTiles = async (): Promise<void> => {
    try {
      await api.refreshMapTiles();
    } catch (err) {
      console.error(err);
    }
    tileLayerRef.current?.redraw();
  };

  return (
    <Panel title="Track Map">
      {/* `isolate` keeps Leaflet's internal z-indexes from escaping above
          dashboard overlays and modals. */}
      {/* The inner container's className is kept constant: Leaflet appends
          `leaflet-container` to it on init via classList, and React would
          wipe that class away if we toggled `className` on this element. All
          size/positioning changes live on the wrapper instead. */}
      <div
        className={
          fullscreen ? 'fixed inset-0 z-[1100] bg-cockpit-bg p-2' : 'relative isolate h-40'
        }
      >
        <div ref={containerRef} className="h-full w-full overflow-hidden rounded bg-cockpit-bg" />
        <div className="absolute right-2 top-2 z-[1000] flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded border border-cockpit-edge bg-cockpit-panel/90 text-xs">
            <button
              onClick={() => setViewMode('live')}
              title="Keep the car centred on the map with a 5s stub trail"
              className={`px-2 py-1 ${
                viewMode === 'live'
                  ? 'bg-cockpit-accent font-semibold text-black'
                  : 'text-slate-300 hover:bg-cockpit-bg'
              }`}
            >
              Live
            </button>
            <button
              onClick={() => setViewMode('last-minute')}
              title="Follow the car with the last 60 seconds of trace"
              className={`border-l border-cockpit-edge px-2 py-1 ${
                viewMode === 'last-minute'
                  ? 'bg-cockpit-accent font-semibold text-black'
                  : 'text-slate-300 hover:bg-cockpit-bg'
              }`}
            >
              Last 60s
            </button>
            <button
              onClick={() => setViewMode('full')}
              title="Show the entire track for this session"
              className={`border-l border-cockpit-edge px-2 py-1 ${
                viewMode === 'full'
                  ? 'bg-cockpit-accent font-semibold text-black'
                  : 'text-slate-300 hover:bg-cockpit-bg'
              }`}
            >
              Full track
            </button>
          </div>
          <button
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
            className="rounded border border-cockpit-edge bg-cockpit-panel/90 px-2 py-1 text-xs text-slate-300 hover:bg-cockpit-bg"
          >
            {fullscreen ? '✕' : '⛶'}
          </button>
          <button
            onClick={() => setCalibrating(true)}
            className="rounded border border-cockpit-edge bg-cockpit-panel/90 px-2 py-1 text-xs text-slate-300 hover:bg-cockpit-bg"
          >
            Calibrate
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          {tileCount.toLocaleString()} map tiles cached
          {mapEnabled ? ' · tiles load as you pan the map' : ' · map disabled'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshTiles()}
            disabled={!mapEnabled}
            title="Re-fetch missing tiles in view"
            className="rounded border border-cockpit-edge px-2 py-1 text-slate-300 hover:bg-cockpit-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⟳ Refresh
          </button>
          <button
            onClick={() => void startDownload()}
            disabled={!mapEnabled || downloading}
            className="rounded border border-cockpit-edge px-2.5 py-1 text-slate-300 hover:bg-cockpit-bg disabled:cursor-not-allowed disabled:opacity-40"
          >
            {downloading
              ? 'Downloading all tiles…'
              : requested && downloadState === 'complete'
                ? 'Download complete'
                : 'Download all tiles'}
          </button>
        </div>
      </div>
      {calibrating && <MapCalibrator onClose={() => setCalibrating(false)} />}
    </Panel>
  );
}
