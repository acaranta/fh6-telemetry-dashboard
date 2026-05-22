# Forza Horizon 6 Telemetry Dashboard

A self-hosted, Dockerized dashboard for **Forza Horizon 6**. It receives the
game's "Data Out" UDP telemetry, shows it live in a racing-cockpit web
dashboard, records every driving session to disk, and replays recorded
sessions in the same dashboard.

```
Forza Horizon 6  ──UDP──▶  Container  ──▶  Live dashboard (WebSocket)
                                │
                                └──▶  Recorded sessions on /data  ──▶  Replay
```

## Features

- **Live telemetry** — speed, RPM, gear, pedals, steering, G-force, tyres,
  suspension, lap/race data, vehicle stats, and rolling charts.
- **Track map** — racing line and heading-aware car marker on a Leaflet map,
  with a tile-less vector-trace fallback.
- **Automatic recording** — every session is written to `/data/sessions` as
  JSON Lines, with a manifest and computed statistics.
- **Replay** — browse recorded sessions and replay them in the dashboard with
  pause/resume/stop, `0.25x`–`8x` speed, and seek.
- **Single container** — one image serves the dashboard, the API, the
  WebSocket feed and the UDP receiver.

## Quick start

```bash
docker compose up --build
```

Then open <http://localhost:8080>.

Recorded sessions are stored in `./fh6-data` on the host (mounted at `/data`).

## Configure Forza Horizon 6

In the game: **Settings → HUD and Gameplay → Data Out**

| Setting       | Value                                            |
| ------------- | ------------------------------------------------ |
| Data Out      | `On`                                             |
| Data Out IP   | the IP address of the host running the container |
| Data Out Port | `20440`                                          |

The container listens on UDP port **20440** by default. If the game runs on the
same machine as Docker, use that machine's LAN IP (not `127.0.0.1`, since the
container is a separate network namespace) — or run the game on a console/PC and
point it at the Docker host.

Start driving; the dashboard updates in real time and a recording begins
automatically.

## Recordings

Each session is a folder under `/data/sessions`:

```
/data/sessions/20260522-183012-a1b2/
├── manifest.json     session metadata, car info and stats
├── telemetry.jsonl   one normalized telemetry frame per line
└── stats.json        computed session statistics
```

A session **starts** on the first in-race telemetry frame and **ends** after
`SESSION_TIMEOUT_SECONDS` without packets. If the container is stopped
mid-session, the session is repaired (marked `recovered`) on the next start.

Set `COMPRESS_FINISHED_SESSIONS=true` to gzip `telemetry.jsonl` when a session
finishes.

## Replay

Open **Sessions** in the top bar, pick a session and press **Replay**. The
dashboard switches to replay mode with transport controls, a speed selector and
a seek bar. Press **Stop** to return to live mode.

## Configuration

All settings are environment variables (see [.env.example](.env.example)):

| Variable                     | Default   | Description                                        |
| ---------------------------- | --------- | -------------------------------------------------- |
| `WEB_PORT`                   | `8080`    | Dashboard HTTP/WebSocket port                      |
| `UDP_HOST`                   | `0.0.0.0` | UDP bind address                                   |
| `UDP_PORT`                   | `20440`   | UDP telemetry port                                 |
| `DATA_DIR`                   | `/data`   | Storage root for sessions, tiles and settings      |
| `SESSION_TIMEOUT_SECONDS`    | `30`      | Packet silence before a session ends               |
| `COMPRESS_FINISHED_SESSIONS` | `false`   | gzip `telemetry.jsonl` on session end              |
| `ALLOW_DELETE_SESSIONS`      | `false`   | Enable `DELETE /api/sessions/:id`                  |
| `LOCK_TO_FIRST_SENDER`       | `false`   | Ignore packets from other source IPs               |
| `LOG_LEVEL`                  | `info`    | `trace`/`debug`/`info`/`warn`/`error`/`silent`     |
| `BROADCAST_HZ`               | `30`      | Live WebSocket rate (recording stays at full rate) |
| `MAP_ENABLED`                | `true`    | Enable the track map                               |
| `MAP_AUTODOWNLOAD_TILES`     | `true`    | Download map tiles on first start                  |
| `MAP_TILES_URL`              | MapGenie  | Tile URL template (`{z}/{x}/{y}`)                  |
| `MAX_SESSION_LIST_ITEMS`     | `500`     | Max sessions returned by the API                   |

## API

| Method   | Path                | Description                                      |
| -------- | ------------------- | ------------------------------------------------ |
| `GET`    | `/api/health`       | Health check                                     |
| `GET`    | `/api/status`       | Runtime status (UDP, recording, map)             |
| `GET`    | `/api/sessions`     | List recorded sessions                           |
| `GET`    | `/api/sessions/:id` | Session manifest                                 |
| `DELETE` | `/api/sessions/:id` | Delete a session (needs `ALLOW_DELETE_SESSIONS`) |
| `GET`    | `/api/settings`     | Map calibration settings                         |
| `PUT`    | `/api/settings`     | Update map calibration                           |
| `WS`     | `/ws`               | Live telemetry + replay control                  |

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev        # server (:8080) + Vite dev server (:5173)
npm test           # run the test suite
npm run lint       # ESLint + Prettier
npm run typecheck  # tsc --noEmit
npm run build      # production build into dist/
```

Useful tools:

```bash
npm run capture         # capture one raw FH6 packet for offset verification
npm run download-tiles  # pre-download the map tiles
```

## Notes & caveats

- **Packet offsets are unverified.** The FH6 "Car Dash" packet layout in
  [`src/server/telemetry/offsets.ts`](src/server/telemetry/offsets.ts) is
  assembled from the official documentation plus FH5 / Forza Motorsport
  community sources, and is partly inferred. The parser is length-tolerant.
  Run `npm run capture` against a real game to verify and correct the offsets.
- **Map tiles** are downloaded at runtime from MapGenie into your `/data`
  volume; they are not bundled in the image. The tiles are extracted game
  assets — use of the map feature is at the operator's discretion. The track
  map falls back to a tile-less vector trace when tiles are unavailable.

## License

MIT
