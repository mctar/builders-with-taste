# Builders with taste

A mobile workshop app with facilitator-controlled phases and a live projection screen. Frontend: React/TypeScript on GitHub Pages. Backend: Fastify, PostgreSQL, and private image storage on Hugin.

Participants join with a session code, complete the original nine-card exercise, and keep using their own Claude or ChatGPT app. Structured answers contribute to room results. Build photos and submitted concept cards appear immediately only with permission. Private notes and the brick-pile photo remain on the phone. The host can pause the gallery, hide cards, control phases/timers, and export results.

## Local development

Use Node 24 and npm.

```sh
npm ci
npm run dev:api
# In another terminal:
npm run dev
# Once the API is ready:
npm run session -- 'Rehearsal'
```

Development uses embedded PostgreSQL via PGlite in `.runtime/database`. Production uses PostgreSQL through `DATABASE_URL`. The session command prints the public join code and saves private host/stage links to an ignored `.runtime/session-<code>.json` file. Sessions begin in the lobby; open the first phase in the host view.

```sh
npm test
npm run build
npm run load
# Include an upload burst:
PHOTOS=200 npm run load
```

The load test creates a separate, clearly named session, exercises 400 identities and live connections, saves before/after answers, optionally uploads photos, checks aggregate counts, and closes its test session. It does not touch workshop sessions. Reports contain timing and counts, not credentials. Use an off-peak window for load tests on Hugin.

## Hugin deployment

Connect using `ssh hugin`. Keep this app in `~/experiments/builders-with-taste` with its own Compose project. Keep photographs under `/data/services/gervilabs/builders-with-taste/photos` (the mounted directory contains a `photos` subdirectory); PostgreSQL lives in the dedicated Compose volume. Do not reuse Kaupang's database.

1. Copy `.env.example` to `.env`. Generate separate random `DB_PASSWORD` and `ADMIN_TOKEN` values; keep this file mode 600. Use URL-safe characters in the database password. Never commit it.
2. Create `PHOTO_DIRECTORY` and give UID 1000 access to it.
3. Run `docker compose up -d --build` and check `curl -fsS http://127.0.0.1:4181/health`.
4. Add `build-api.btrbot.com → http://127.0.0.1:4181` to the existing named Cloudflare Tunnel, preserving all other routes. Validate the configuration, create the DNS route, and restart the tunnel service only when ready. No database port is exposed.
5. Confirm the public `/health` endpoint, CORS from `https://mctar.github.io`, and SSE through the real tunnel. Allow SSE streaming and disable caching for API responses. Do not put an interactive login/challenge in front of the participant API.

The API container is limited to two CPU cores and 1 GB memory. Image work is bounded; a busy upload gets a retryable 503 while text responses remain available. Both containers restart automatically, and images survive container replacement. Tokens are hashed, session-scoped, role-limited, and expire (participants after two days; host/stage after 30 days). The admission code does not grant screen or host access.

To create a session on Hugin without printing administrator credentials, use the trusted host's environment or call the provisioning endpoint from inside the API container. `scripts/session.ts` is a convenience for a checkout with development dependencies; set `API_URL`, `ADMIN_TOKEN`, and `FRONTEND_URL` to the deployed values. Store the resulting private links outside Git. QR codes contain only the public participant join link.

## GitHub Pages

The repository's `main` branch deploys through `.github/workflows/pages.yml` after tests and the production build pass. Pages must be configured to use GitHub Actions. `BASE_PATH` is `/builders-with-taste/` and `VITE_API_URL` is `https://build-api.btrbot.com`. Change those two public settings if the repository name or API hostname changes. Hash routing supports direct links and refreshes on Pages.

Backend releases are controlled separately. Copy reviewed source to Hugin, set a distinct `APP_VERSION`, build the image, and recreate only this Compose app. Schema initialization is additive and version 1; future non-additive schema changes require an explicit migration and backup first. Keep the prior image available for rollback. The runtime database account owns this app's schema and is isolated from other databases; production migrations should be split into a separate role when the schema evolves.

## Recovery and event readiness

- Phones persist private drafts and a serialized submission outbox in IndexedDB. A success message requires a server acknowledgement. Transient failures retry; validation/conflict errors require a visible reconnect/review action. Clearing browser storage or changing devices loses anonymous access and local-only drafts.
- The projection screen reads durable snapshots, receives SSE invalidations, polls every 15 seconds, and retains its last snapshot when offline. Notifications are an optimization, not the stored result. One API process owns the live connections; adding replicas requires shared notification delivery.
- The current release does not promise a fully offline page reload. Keep the app open during a network interruption. Server submission and external AI still need a network.
- `docker compose restart api` recovers the app; `sudo systemctl restart cloudflared` recovers the tunnel. Neither should remove data. Never use `docker compose down -v` on a workshop deployment.
- `bash deploy/backup.sh` takes a consistent database/photo backup with a brief API pause. Copy the backup to a second device and verify restore into a separate Compose project before an important event. To restore, start an empty test database, run `pg_restore -U builders -d builders` against `database.dump`, and extract `photos.tar.gz` into the test API data volume while that API is stopped. Keep matching pairs.
- Select retention with the facilitator. This release does not automatically delete participant data. Remove closed sessions and their associated assets/operation records only after an export and an agreed retention period. Exported JSON is untrusted participant content and must be escaped if imported into another UI.
- Hugin and its network are single points of failure. Rehearse on the actual venue Wi-Fi with the projection computer. A 400-client burst test verifies the tested API path, not the venue's wireless capacity or a complete event-duration soak.

## Checks

`npm test` covers phase gating, session ownership, participant/stage permissions, idempotent joins/writes, stale revisions, actual image upload/access, publication/hiding, consent revocation and stale replay, paired aggregates, pause/resume timers, CORS, and withdrawal after session closure. The load test is separate so normal CI does not generate 400 sessions or contact production.
