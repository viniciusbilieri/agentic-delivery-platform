# ADR 0001 — Durable projects and an additive control-plane foundation

Status: accepted for slice 1. Date: 2026-09-16.

## Context

The existing POC stores deliveries globally and runs a browser-only simulation. TeamClaw needs isolated projects before a second user or a local worker can safely access it. Cloudflare Workers cannot host long-running CLI processes. Supabase already supplies persistence and must remain compatible with existing records.

## Decisions

- Preserve Vinext/Cloudflare and Supabase. A project is the durable authorization boundary; the owner is the authenticated site's stable user ID, not an email or browser-supplied owner.
- Keep all data behind server-side APIs. Browser Supabase roles receive no schema/table/function access. Service-role-only, invoker-security RPCs implement transactional writes and repeat authorization checks. Pin function search_path to the empty schema.
- Serialize membership mutation and demand creation with a project row lock. Deduplicate demand requests by project/request UUID; reject mismatching reuse. Events commit in the same transaction as the action.
- Treat existing ownerless deliveries as unassigned historical records. Do not guess ownership or expose them through an unscoped API.
- Persist runs and steps, including quota-wait states, before introducing execution. Database transitions are validated; workers/checkpoints/leases remain a separate slice. Do not claim that persisted queue state constitutes real execution.
- Preserve the original POC at an explicitly simulated `/demo` route. The project console shows real stored state.
- Future worker credentials remain local. Workers initiate outbound communication and require explicit project allowlists. No browser-to-shell endpoint is introduced.

## Consequences

External users see only explicitly shared projects. Membership administration initially stays owner-only even for the reserved admin role. Historical data needs a separate reviewed ownership migration. The current API contract intentionally rejects unauthenticated and unscoped callers. Remote database migration precedes deployment. True resumability and Project Brain require later slices; the data model does not depend on provider chat sessions.
