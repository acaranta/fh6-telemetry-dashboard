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

export function TrackMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapEnabled = useTelemetryStore((s) => s.status?.map.enabled ?? true);
  const tileCount = useTelemetryStore((s) => s.status?.map.tileCount ?? 0);
  const downloadState = useTelemetryStore((s) => s.status?.map.tileDownload ?? 'idle');
  const [calibrating, setCalibrating] = useState(false);
  const [requested, setRequested] = useState(false);

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
    let fitted = false;
    let lastFit = 0;

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
        if (!fitted) centerOnCalibration(settings.calibration);
      })
      .catch(() => {
        /* keep defaults */
      });

    const toLatLng = (x: number, z: number): L.LatLng =>
      map.unproject(L.point(worldToPixel(x, z)), FH6_MAP.maxZoom);

    const render = (frame: TelemetryFrame | null, path: TrackPath): void => {
      if (path.length > 0) {
        line.setLatLngs(path.map(([x, z]) => toLatLng(x, z)));
        const now = Date.now();
        if ((!fitted && path.length > 4) || now - lastFit > 5000) {
          const bounds = line.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16, animate: false });
            fitted = true;
            lastFit = now;
          }
        }
      }
      if (frame) {
        marker.setLatLng(toLatLng(frame.positionX, frame.positionZ));
        const svg = marker.getElement()?.querySelector('svg');
        if (svg) svg.style.transform = `rotate(${(frame.yaw * 180) / Math.PI}deg)`;
      }
    };

    const initial = useTelemetryStore.getState();
    render(initial.frame, initial.trackPath);
    const unsubscribe = useTelemetryStore.subscribe((s) => render(s.frame, s.trackPath));
    const sizeTimer = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(sizeTimer);
      unsubscribe();
      tileLayerRef.current = null;
      map.remove();
    };
  }, [mapEnabled]);

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
      <div className="relative isolate">
        <div ref={containerRef} className="h-80 w-full overflow-hidden rounded bg-cockpit-bg" />
        <button
          onClick={() => setCalibrating(true)}
          className="absolute right-2 top-2 z-[1000] rounded border border-cockpit-edge bg-cockpit-panel/90 px-2 py-1 text-xs text-slate-300 hover:bg-cockpit-bg"
        >
          Calibrate
        </button>
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
