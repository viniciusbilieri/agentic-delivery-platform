# TeamClaw implementation status

## 2026-09-16 — Slice 1: persistent project foundation

Baseline inspected: `babbf4244150f90d1ce9948018a9b179ad3696b4`.

### Discovery and scope

The baseline is a Vinext/React application on Cloudflare Workers, with a server-side Supabase client and one `agentic_delivery.deliveries` table. Its main UI simulated orchestration with timers. The API listed every delivery and accepted anonymous writes; no project, membership, run, worker, or checkpoint model existed. No AGENTS.md was present. No existing source work was overwritten.

This slice preserves the stack and original demo, establishes project-level boundaries, and persists demands without claiming to execute agents. The specification's end-to-end vertical slice requires subsequent worker and checkpoint slices. It is not complete yet.

### Implemented

- Authenticated project registry and creation; only owned/shared projects are listed.
- Project-scoped demand history, run/step visibility, and append-only event history.
- Owner-managed member grants/revocation using the site's stable user identifier.
- Roles: owner, admin, member, tester, viewer. Owner alone manages membership in v1; admin/member/tester may submit demands; viewer is read-only.
- API authentication, strict input validation, bounded JSON bodies, same-origin mutation checks, and private/no-store responses.
- Transactional RPC creates demand, queued run, initial discovery step and audit event together. Project lock coordinates membership changes and submission retries. Idempotency key reuse with changed payload/actor returns a conflict.
- Durable state constraints/triggers including `waiting_for_quota`; invalid transitions and cross-project run/step relationships are rejected by PostgreSQL.
- Original visual POC retained at `/demo`, clearly labeled as fictional/simulated, without writing real records.
- Root route uses real persisted data, explicit loading/empty/error states, and no automatic simulated progress.
- Original specification and kickoff prompt included verbatim at repository root.

### Schema / API

Additive migration: `supabase/migrations/20260916220000_project_foundation.sql`.

New tables: projects, project_members, project_events, runs, run_steps. Existing deliveries gain nullable project_id/created_by/request_id. Historical rows stay unchanged and unassigned; no user can claim them through the application. Assignment requires separately verified ownership and an explicit administrative data migration.

Routes:

- `GET /api/me`: authenticated user's site-specific identifier.
- `GET/POST /api/projects`: list accessible projects / create owned project.
- `GET /api/deliveries?project_id=<uuid>`: scoped delivery history (latest 50).
- `POST /api/deliveries`: project_id, title, objective, request_id UUID; creates a queued run.
- `GET /api/projects/<uuid>/runs`: latest 50 runs and their steps.
- `GET /api/projects/<uuid>/events`: latest 100 project events.
- `GET/POST/DELETE /api/projects/<uuid>/members`: owner-only membership management.

Unscoped/anonymous delivery API calls intentionally no longer work. An existing client must supply a project ID, authenticated identity and an idempotency UUID. The demo no longer calls the persistence API.

### Configuration and rollout

Keep SUPABASE_URL and SUPABASE_SECRET_KEY server-side, as in `.env.example`. Secrets never enter source control or the browser. The Data API must expose `agentic_delivery` to service_role only. The secret key is a Data API credential, not a PostgreSQL DDL/migration credential.

1. Verify target Supabase project and backup/rollback policy.
2. If creating a fresh database, apply the existing baseline migration first. Do not rerun it on an initialized database.
3. Apply the new migration with the Supabase SQL editor or an administrative PostgreSQL connection. The file is transactional and must run with stop-on-error behavior. Do not partially execute/rewrite applied migrations.
4. Configure runtime credentials and verify owner/project creation, demand creation and a second user's isolation.
5. Deploy the application only after the migration succeeds. Hosted Sites publishing does not automatically apply these external Supabase migrations.

Example for an initialized database with psql installed:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260916220000_project_foundation.sql
```

No usable Supabase credentials or DATABASE_URL were present in this task's environment/checkout; Sites environment metadata contained no configured entries. The remote migration was **not applied**. Tests use disposable local PostgreSQL (PGlite), not the production database. Production publication is blocked until database rollout/configuration is verified; Git delivery can proceed independently.

### Validation

- `npm test`: 16 passing tests (HTTP authorization/validation and real PostgreSQL migrations/RPCs).
- Migration tests cover legacy preservation, browser-role denial, cross-user/project isolation, role changes, revocation, duplicate submission, transaction rollback, cross-project foreign keys, append-only audit and state transition ordering.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm run lint`: passed.
- Sites/Vinext deployable build: passed (all eight routes emitted).

### Known limitations / next slice

- No worker, CLI invocation, lease scheduler, checkpoint storage, automatic retry, real quota detection or actual auditor/executor loop yet. Queued tasks intentionally remain queued.
- A quota transition test checks the schema state model, not end-to-end continuation. That acceptance test belongs with worker/checkpoint implementation.
- Project context is currently name/description/objective and event history. Project Brain snapshots, document ingestion and deep discovery are pending.
- Workspaces and general task/initiative entities are deferred; a delivery is the demand boundary for this slice.
- API reads are capped (50 demands/runs and 100 events); cursor pagination is pending. Projects currently have no list cap.
- No email invites. A user must first access this same Site and share their identifier. Platform-level access restrictions remain in addition to application membership.
- Hosted auth trusts the Sites dispatcher to sanitize/inject identity headers. Portable development sign-in is loopback only. Never expose a standalone server accepting these headers directly to the internet without a trusted authentication gateway.
- PostgreSQL row-level security denies browser roles; service_role bypasses RLS. Application authorization and actor-bound RPC checks are required. RPCs are invoker-security, service-role only.
- Retry identity for a draft demand survives retries while the page stays open; refreshing after an uncertain submission requires inspecting history before resubmitting.

Next slice: worker identity + project allowlist + outbound polling, transactional leases and fencing, capability registry, and a harmless test runtime. Then CLI adapters and checkpoint/quota pause/resume, followed by brownfield discovery and the bounded auditor/executor loop.
