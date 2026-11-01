# Builders with taste

A mobile workshop app with facilitator-controlled phases and a live projection screen. Frontend: React/TypeScript on GitHub Pages. Backend: Fastify, PostgreSQL, and private image storage on Hugin.

Participants join with a session code, choose ChatGPT, Gemini, Claude, Copilot, or Something else on the welcome screen, and complete the original nine-card exercise in their own AI app. The choice is saved with their answers and can be changed in the session menu. The facilitator sees the AI breakdown and each participant’s choice; it is included in the export. Structured answers contribute to room results. Build photos and submitted concept cards appear immediately only with permission. Private notes and the brick-pile photo remain on the phone. The host can pause the gallery, hide cards, control phases/timers, and export results.

The facilitator dashboard shows counts at all ten participant screens, connected/waiting/finished totals, and a searchable anonymous participant roster with current screen, time there, last activity, queued saves, and checkpoints. Phones report minimal activity metadata about every 25–30 seconds and after screen/save changes. They show a matching Builder reference for troubleshooting. Host-only reports contain photo-readiness flags, never private photo contents or private reflection text. Background activity is labelled separately; long build/development steps alone are not treated as errors. Older open clients show their last saved screen until refreshed. The public projection API does not expose the roster.

Every photo control has separate **Take a photo** and **Choose from camera roll** options, including when replacing a picture. The camera control requests the rear camera; the library control leaves the operating system's image picker available. Both paths use the same compression, private draft storage, and display consent rules.

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
5. Confirm the public `/health` endpoint, CORS from `https://brick.btrbot.com` and `https://mctar.github.io`, and SSE through the real tunnel. Allow SSE streaming and disable caching for API responses. Do not put an interactive login/challenge in front of the participant API.

The API container is limited to two CPU cores and 1 GB memory. Image work is bounded; a busy upload gets a retryable 503 while text responses remain available. Both containers restart automatically, and images survive container replacement. Tokens are hashed, session-scoped, role-limited, and expire (participants after two days; host/stage after 30 days). The admission code does not grant screen or host access.

To create a session on Hugin without printing administrator credentials, use the trusted host's environment or call the provisioning endpoint from inside the API container. `scripts/session.ts` is a convenience for a checkout with development dependencies; set `API_URL`, `ADMIN_TOKEN`, and `FRONTEND_URL` to the deployed values. Store the resulting private links outside Git. QR codes contain only the public participant join link.

## GitHub Pages

The app lives at `https://brick.btrbot.com/`. The repository's `main` branch deploys through `.github/workflows/pages.yml` after tests and the production build pass. Pages uses GitHub Actions with `brick.btrbot.com` configured as its custom domain and HTTPS enforced. DNS is a DNS-only CNAME from `brick.btrbot.com` to `mctar.github.io`. Actions-based Pages deployments do not require a CNAME file.

`BASE_PATH` is `./` so assets work at both the project path and domain root. `VITE_API_URL` is `https://build-api.btrbot.com`; `VITE_PUBLIC_URL` is `https://brick.btrbot.com/` for canonical join links and QR codes. Hash routing supports direct links and refreshes. Set `FRONTEND_URL=https://brick.btrbot.com/` when provisioning sessions with `scripts/session.ts`.

Keep existing phone tabs open during a domain change: drafts, photos, and anonymous access are stored per browser origin. New participants use the custom domain; switching an existing phone to a different origin starts separate local storage. Both origins remain allowed by the API.

Backend releases are controlled separately. Copy reviewed source to Hugin, set a distinct `APP_VERSION`, build the image, and recreate only this Compose app. Schema initialization is additive and version 1; future non-additive schema changes require an explicit migration and backup first. Keep the prior image available for rollback. The runtime database account owns this app's schema and is isolated from other databases; production migrations should be split into a separate role when the schema evolves.

## Recovery and event readiness

- Phones persist private drafts and a serialized submission outbox in IndexedDB. A success message requires a server acknowledgement. Transient failures retry; validation/conflict errors require a visible reconnect/review action. Clearing browser storage or changing devices loses anonymous access and local-only drafts.
- The projection screen reads durable snapshots, receives SSE invalidations, polls every 15 seconds, and retains its last snapshot when offline. Notifications are an optimization, not the stored result. One API process owns the live connections; adding replicas requires shared notification delivery.
- The current release does not promise a fully offline page reload. Keep the app open during a network interruption. Server submission and external AI still need a network.
- `docker compose restart api` recovers the app; `sudo systemctl restart cloudflared` recovers the tunnel. Neither should remove data. Never use `docker compose down -v` on a workshop deployment.
- `bash deploy/backup.sh` takes a consistent database/photo backup with a brief API pause. Copy the backup to a second device and verify restore into a separate Compose project before an important event. To restore, start an empty test database, run `pg_restore -U builders -d builders` against `database.dump`, and extract `photos.tar.gz` into the test API data volume while that API is stopped. Keep matching pairs.
- Select retention with the facilitator. This release does not automatically delete participant data. Remove closed sessions and their associated assets/operation records only after an export and an agreed retention period. Exported JSON is untrusted participant content and must be escaped if imported into another UI.
- Hugin and its network are single points of failure. Rehearse on the actual venue Wi-Fi with the projection computer. A 400-client burst test verifies the tested API path, not the venue's wireless capacity or a complete event-duration soak.

## Big-screen scenes

The facilitator selects overview, results, gallery, or reflections. Votes land as coloured bricks (one per answer); results show animated paths using only people with both before and after answers. The gallery rotates a build into the spotlight every 11 seconds and celebrates newly shared contributions. Pausing the gallery removes its images from the screen immediately.

The join QR stays on screen. Click it or press **J** for a large reveal; **Escape** closes it. **M** toggles decorative motion, and the screen respects the operating system's reduced-motion setting. Use the full-screen button for projection. Rehearsal sessions are visibly marked **DRY RUN**.

## Checks

`npm test` covers phase gating, session ownership, participant/stage permissions, idempotent joins/writes, stale revisions, actual image upload/access, publication/hiding, consent revocation and stale replay, paired aggregates, pause/resume timers, CORS, and withdrawal after session closure. The load test is separate so normal CI does not generate 400 sessions or contact production.
