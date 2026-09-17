# Codex Kickoff Prompt — TeamClaw Evolution

Use this prompt when resuming work on the TeamClaw repository.

---

You are working on the repository:

`https://github.com/viniciusbilieri/agentic-delivery-platform`

The project is evolving from an Agentic Delivery POC into a persistent multi-project, multi-user, multi-runtime agentic software-delivery platform.

Read **`TEAMCLAW_EVOLUTION_SPEC.md`** in full before changing code. Treat that document as the product/architecture specification, but validate every implementation assumption against the existing repository.

## Your first responsibility: Deep Discovery

Before coding:

1. Inspect the repository structure, current UI, APIs, database access, migrations, tests, authentication helpers and deployment constraints.
2. Identify what is already implemented versus what the specification proposes.
3. Identify compatibility constraints from Cloudflare Workers, Vinext and Supabase.
4. Inspect current Git state and do not destroy existing work.
5. Produce a concise implementation plan mapping the specification phases onto the actual codebase.
6. Call out any architectural recommendation in the specification that should be adjusted based on the real repository.

Do not rewrite the application from scratch unless you discover a concrete and documented blocker.

## Implementation strategy

Implement the evolution in **small, reviewable vertical slices**. Do not attempt the entire specification in one massive patch.

Start with the foundation required for the first vertical slice:

1. first-class persistent Projects;
2. project-scoped authorization/membership foundation;
3. project event/audit model;
4. durable Run / Run Step state model capable of later supporting workers and checkpointing;
5. preserve the current delivery flow by associating deliveries with projects rather than deleting working behavior.

Then proceed toward:

6. Worker registry and outbound worker protocol;
7. runtime adapter abstraction;
8. Codex CLI and Claude CLI adapters on a local worker;
9. checkpointing;
10. quota-aware `waiting_for_quota` pause/resume;
11. Brownfield repository discovery;
12. Auditor → Executor workflow.

## Non-negotiable architecture rules

- Project state is durable and independent of chat/provider sessions.
- CLI credentials stay on the local worker. Never store them in Supabase or the repository.
- Authentication is not authorization; enforce project/workspace membership server-side.
- A test user such as Henrique must only see explicitly shared projects.
- Local workers initiate outbound communication. Do not require a publicly exposed ThinkPad port.
- Never expose arbitrary browser-controlled shell execution.
- Use explicit worker/project permissions.
- Long-running execution must be checkpointable.
- Quota/rate-limit interruption is a paused state, not generic failure.
- Resumption must work even when the original Codex/Claude session cannot be resumed.
- Runtime adapters must normalize provider-specific errors.
- Use execution leases and idempotency protections to avoid duplicate work.
- Prefer safe git branches/worktrees for agent-driven code changes.
- Require human approval for destructive/production operations by default.
- Auditor/Executor loops must have a configurable maximum iteration count.

## Quota/resume requirement

Design quota handling around a state machine.

Expected behavior:

1. runtime reports usage/rate limit;
2. classify it as `RATE_LIMIT` or `USAGE_LIMIT`;
3. persist a checkpoint containing Git SHA/branch, completed work, changed files, tests, findings and exact next action;
4. set the step to `waiting_for_quota`;
5. persist provider retry/reset metadata when available;
6. otherwise use a bounded retry/backoff policy;
7. release execution resources safely;
8. later reacquire the task using a lease;
9. resume original provider session if supported;
10. otherwise create a new session using a generated Resume Brief;
11. continue the same logical run without duplicate actions.

Create automated tests that simulate this flow. Do not rely on a real provider quota being exhausted to test it.

## Ipiranga target workflow

The product must eventually support this workflow as a reusable template:

`User → Codex Auditor/Devil's Advocate → structured work package → Claude Executor → tests → Codex review → approve or changes requested → repeat within limit`

Define structured contracts for both `work_package` and `execution_result`; do not make free-form chat the sole inter-agent protocol.

## Development discipline

- Use additive/versioned migrations; do not silently rewrite an already-applied migration.
- Keep existing tests passing.
- Add tests for authorization and state transitions.
- Run lint/tests/build appropriate to each slice.
- After every meaningful slice, update `docs/implementation-status.md` with:
  - implemented capability;
  - schema/API changes;
  - new commands/configuration;
  - tests executed;
  - known limitations;
  - next recommended slice.
- Create ADRs for major architectural decisions listed in the specification.
- If you find a major conflict between the specification and current code, document the conflict and choose the smallest safe path forward.

## First response before major implementation

Return:

1. **Current-state discovery** — what the repo actually contains.
2. **Gap analysis** — current vs target.
3. **Proposed architecture adjustments** if needed.
4. **Concrete first slice** with files/tables/routes likely to change.
5. **Risk list**.
6. Then begin implementing the first slice unless a genuine destructive ambiguity prevents safe progress.

The objective is not to create another chatbot interface. The objective is to create a durable control plane for software projects that can coordinate agents and machines, stop safely, survive provider limits and continue later from any authorized device.
