# TeamClaw — Evolution Specification

**Status:** Proposed evolution / Codex handoff  
**Date:** 2026-09-16  
**Repository:** `viniciusbilieri/agentic-delivery-platform`  
**Purpose:** Evolve the current Agentic Delivery Platform POC into a persistent, multi-project, multi-user, multi-runtime agentic software delivery platform that can operate locally, remotely and continuously across quota interruptions.

---

## 1. Executive vision

TeamClaw should evolve from a POC that receives a demand and simulates/coordinates a delivery into a platform that **understands software projects, preserves their context, coordinates specialized AI agents, executes work on available machines, and resumes work safely after interruptions**.

The target product statement is:

> **TeamClaw understands software systems and coordinates autonomous teams and execution nodes to continuously evolve them.**

The platform must support both:

1. **Greenfield projects** — start from an idea, requirements or uploaded documents.
2. **Brownfield projects** — connect to an existing repository, perform deep discovery, reconstruct the architecture, identify gaps/risks and continue development.

It must also support multiple users and multiple execution locations. A user can start or inspect work from a phone or Mac while a ThinkPad, VM or cloud worker performs the actual execution.

---

## 2. Current repository baseline

The current repository already provides a useful foundation:

- Next.js / React application running through Vinext.
- Cloudflare Workers deployment model.
- Supabase Postgres persistence.
- Server-side `agentic_delivery` schema.
- Existing `deliveries` API and persistence.
- ChatGPT sign-in helpers and stable user identity headers.
- Portable development support for Windows, macOS and Linux.
- README already anticipates a future local agent executor that invokes installed `claude` and `codex` CLIs as child processes while leaving CLI credentials on the local machine.

The evolution should **extend this architecture rather than throw it away**.

Important principle: the current `delivery` concept becomes one object inside a broader persistent `project` model.

---

# 3. Primary real-world use cases

## UC-01 — Henrique tests TeamClaw

The owner must be able to give Henrique access to the hosted TeamClaw interface without giving him unrestricted access to every project, repository, local machine or credential.

Desired flow:

1. Owner creates a workspace/project available for Henrique.
2. Henrique authenticates.
3. Henrique sees only projects explicitly shared with him.
4. He can create a demand or run the permitted workflow.
5. The execution may happen on an authorized worker without exposing worker credentials.
6. Owner can inspect all activity through an audit/event log.

This implies workspace/project membership and RBAC.

---

## UC-02 — Continue the Ipiranga project

Current manual workflow:

- Codex acts as an **auditor / devil's advocate**.
- Codex inspects the work, challenges assumptions and creates detailed prompts/work packages.
- Claude performs the implementation / heavy lifting.
- The result comes back to Codex for review.
- The process repeats until the work is acceptable.

TeamClaw should automate this orchestration while keeping the same separation of responsibilities.

Desired flow:

```text
User demand
    ↓
Auditor / Devil's Advocate (Codex)
    ↓
Creates implementation work package
    ↓
Executor (Claude)
    ↓
Code / tests / artifacts
    ↓
Auditor review (Codex)
    ↓
 ┌───────────────┴───────────────┐
 ↓                               ↓
approved                    changes requested
 ↓                               ↓
next step                    Executor again
```

The loop must be bounded and observable. Never create an uncontrolled infinite agent loop.

---

## UC-03 — Quota exhaustion without losing progress

Example:

1. Claude or Codex is implementing a task.
2. The runtime reports a rate/quota/usage limit.
3. TeamClaw detects the condition.
4. Current progress is checkpointed.
5. The step becomes `waiting_for_quota`.
6. The worker remains healthy and can work on other eligible tasks/runtimes.
7. TeamClaw determines a safe retry time from provider metadata when available, or uses configured backoff/probing when it is not available.
8. When execution is available again, the system reacquires the task lease.
9. It resumes from the checkpoint.
10. If the original provider session cannot be resumed, TeamClaw creates a new session with a generated **resume brief** containing the necessary project state and next action.

The user should not need to sit at the machine waiting for the usage limit to reset.

---

## UC-04 — ThinkPad as a persistent execution node

The user can leave a ThinkPad online at home/office and use TeamClaw from a Mac or phone.

The ThinkPad runs something conceptually similar to:

```bash
teamclaw worker start
```

The worker creates an **outbound authenticated connection** to the TeamClaw control plane. Do not expose an inbound public port on the ThinkPad.

It advertises capabilities such as:

```text
Worker: thinkpad-home
OS: Linux
Status: online
Capabilities:
- git
- node
- python
- docker
- claude-cli
- codex-cli
- local repository access
```

A task can then be scheduled onto that machine from any authorized client.

---

## UC-05 — Multiple persistent projects

TeamClaw must maintain a project registry.

Example:

```text
TeamClaw
├── Agentic Delivery Platform
├── Ipiranga
├── Data Governance
├── Veltrix Internal AI
└── Sandbox / Henrique Demo
```

Each project has independent:

- repository/source configuration;
- project brain;
- documents;
- architecture knowledge;
- agents;
- tasks;
- runs;
- checkpoints;
- secrets policy;
- worker access policy;
- members/permissions;
- artifacts;
- execution history.

Project context must never bleed into another project.

---

# 4. Product modes

## 4.1 New project from description

```text
Description → Discovery → Requirements → Architecture → Delivery
```

## 4.2 New project from documents

User may provide files instead of manually retyping context.

Initial supported formats:

- `.md`
- `.txt`
- `.docx`
- `.pdf`

Later:

- `.xlsx`
- `.csv`
- `.pptx`
- images/diagrams

Flow:

```text
Files
 ↓
Document ingestion
 ↓
Extraction + classification
 ↓
Project Brain
 ↓
Gap questions / assumptions
 ↓
Delivery workflow
```

The system should retain the original artifact and also produce normalized structured context.

Every important extracted fact should preserve provenance when possible:

```text
REQ-014: Integrate with SAP API
Source: architecture.docx / section 4.2
```

---

## 4.3 Import existing project / Brownfield Mode

Input can be:

- local repository path accessible to a worker;
- Git repository URL;
- existing cloned repository;
- later, additional systems such as Azure DevOps/GitLab.

Before changing code, TeamClaw runs **Deep Discovery**.

Expected discovery outputs:

- repository map;
- languages and frameworks;
- package/dependency inventory;
- service/module map;
- APIs/endpoints;
- database/data access clues;
- infrastructure/deployment clues;
- CI/CD workflows;
- tests and test coverage clues;
- documentation inventory;
- Git history summary;
- current branch/SHA;
- architectural reconstruction;
- technical debt candidates;
- security/operational risks;
- unanswered questions;
- recommended next actions.

The discovery result is persisted as a versioned project snapshot.

Example user actions after discovery:

```text
[ Continue current roadmap ]
[ Add a feature ]
[ Improve architecture ]
[ Address technical debt ]
[ Ask TeamClaw to propose a roadmap ]
```

---

# 5. Target architecture

```text
                           CLIENTS
              ┌──────────────┼──────────────┐
              │              │              │
             Web            Mac           Mobile
              └──────────────┼──────────────┘
                             │
                             ▼
                    TEAMCLAW CONTROL PLANE
                  Cloudflare / Next / Vinext
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
       ▼                     ▼                     ▼
 Project Registry      Orchestration         Scheduler
 Project Brain         State Machine         Quota Manager
 RBAC / Audit          Agent Runs            Worker Registry
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                             ▼
                       Supabase Postgres
                             │
                             ▼
                    Worker Task Protocol
                     outbound connections
            ┌────────────────┼─────────────────┐
            │                │                 │
            ▼                ▼                 ▼
       ThinkPad Worker    Mac Worker       Cloud Worker
            │                │                 │
    ┌───────┼────────┐       │          ┌──────┼──────┐
    │       │        │       │          │      │      │
  Codex   Claude   Docker   Codex      APIs  Docker local LLM
   CLI      CLI
```

---

# 6. Architectural components

## 6.1 Control Plane

Responsibilities:

- authentication;
- workspace/project authorization;
- project registry;
- task/run lifecycle;
- orchestration;
- scheduling;
- worker registry;
- execution leases;
- quota events;
- project brain access;
- UI/API;
- audit log.

The Control Plane should not need local CLI credentials.

---

## 6.2 Project Brain

The Project Brain is persistent structured knowledge about one project.

Suggested logical structure:

```yaml
project:
  objective:
  business_context:
  stakeholders:
  repositories:
  requirements:
  functional_requirements:
  non_functional_requirements:
  constraints:
  integrations:
  architecture:
  architecture_decisions:
  dependencies:
  risks:
  technical_debt:
  roadmap:
  open_questions:
  assumptions:
  current_state:
  artifacts:
```

It is **not merely chat history**.

Agent conversations are execution traces. The Project Brain is the durable source of project context.

Every brain update should be attributable to an event, file, repository snapshot, agent observation or human decision.

---

## 6.3 Document Ingestion

Responsibilities:

1. accept upload;
2. validate format/size;
3. store original artifact;
4. extract text/structure;
5. create chunks or logical sections;
6. classify content;
7. extract requirements/constraints/decisions/entities;
8. preserve provenance;
9. generate/update project context snapshot;
10. flag uncertain or conflicting information.

Heavy extraction that does not fit the Cloudflare runtime should be delegated to a worker node.

Do not ingest secrets by default. Apply allow/deny rules and warn on detected credentials.

---

## 6.4 Repository Intelligence / Deep Discovery

Repository discovery should be implemented as a reproducible pipeline rather than one giant model prompt.

Example stages:

```text
01 Repository metadata
02 File tree + ignore policy
03 Manifest detection
04 Language/framework detection
05 Dependency extraction
06 Entrypoints/modules/services
07 API/data/integration clues
08 Test inventory
09 CI/CD + infra
10 Documentation inventory
11 Git state/history
12 Agent-assisted architectural synthesis
13 Risks/gaps
14 Persist discovery snapshot
```

The scanner should explicitly ignore by default:

- `.git/`
- `node_modules/`
- build artifacts unless needed;
- binary files;
- `.env*` values;
- credential files;
- large generated datasets.

Never send a whole repository to a model blindly.

---

## 6.5 Agent Orchestrator

The orchestrator owns state transitions, not an individual LLM.

Initial agent profiles:

### Delivery Lead
Turns human intent into an actionable delivery objective and identifies missing context.

### Solution Architect
Produces architecture/options/impact assessment.

### Auditor / Devil's Advocate
Recommended default runtime for the Ipiranga workflow: Codex CLI.

Responsibilities:

- challenge assumptions;
- inspect repository state;
- review architecture;
- review implementation plans;
- review diffs/results;
- identify risks/regressions;
- create structured implementation work packages;
- approve or request changes according to explicit acceptance criteria.

### Executor / Engineer
Recommended initial runtime for Ipiranga: Claude CLI.

Responsibilities:

- consume a work package;
- implement changes;
- run tests/checks;
- produce a completion report;
- never self-approve critical changes.

### QA / Verification
Can initially be rules + tests + auditor review, and later become its own agent profile.

---

## 6.6 Runtime Adapter Layer

Do not couple orchestration to one provider.

Conceptual interface:

```ts
interface AgentRuntime {
  id: string;
  kind: 'cli' | 'api' | 'local';
  healthCheck(): Promise<RuntimeHealth>;
  start(input: RuntimeInput): Promise<RuntimeSession>;
  resume?(sessionId: string, input: RuntimeInput): Promise<RuntimeSession>;
  cancel(sessionId: string): Promise<void>;
  classifyError(error: unknown): RuntimeError;
}
```

Initial adapters:

```text
CLI
├── codex-cli
└── claude-cli

API / future
├── OpenAI
├── Anthropic
└── other providers

Local / future
├── Ollama
└── LM Studio / compatible endpoints
```

CLI credentials remain local to the worker and must not be copied into TeamClaw's database.

---

## 6.7 Worker Node

A worker is a trusted execution daemon installed on a machine.

Core responsibilities:

- register with the Control Plane;
- authenticate with a worker token/key pair;
- report heartbeat;
- advertise capabilities;
- acquire tasks through leases;
- access authorized local repositories;
- spawn CLI runtimes;
- stream sanitized logs/events;
- maintain local runtime session metadata;
- create checkpoints;
- upload artifacts/results;
- report quota/runtime errors;
- cancel work when requested.

### Connectivity

For the first implementation, favor a robust outbound HTTPS polling/long-polling protocol over opening ports on the machine.

Later, WebSocket/Durable Objects or another real-time transport can reduce latency.

Security rule:

> The local worker initiates the connection. The public internet should not need direct inbound access to the ThinkPad.

---

# 7. Multi-project model

A project is a first-class durable entity.

Suggested hierarchy:

```text
Workspace
  └── Project
        ├── Sources
        ├── Documents
        ├── Project Brain
        ├── Initiatives
        │     └── Tasks
        ├── Runs
        │     └── Steps
        ├── Checkpoints
        ├── Artifacts
        ├── Decisions
        ├── Members
        └── Events
```

A `delivery` can become an initiative/run associated with a project rather than the top-level data model.

---

# 8. Multi-user access and Henrique testing

## 8.1 Required authorization model

Suggested roles:

- `owner`
- `admin`
- `member`
- `tester`
- `viewer`

Authorization should exist at least at workspace and project levels.

Examples:

- Owner: full access.
- Henrique/Test user: only demo/test projects explicitly shared.
- Ipiranga project: private and not visible to unrelated testers.

Do not equate authentication with authorization.

The current ChatGPT sign-in identity can identify users, but TeamClaw must add explicit application-level membership checks.

---

## 8.2 Worker authorization

A worker belongs to an owner/workspace and has an allowlist of projects it can execute.

Example:

```text
thinkpad-home
  allowed_projects:
    - Ipiranga
    - Agentic Delivery Platform

henrique-demo-worker
  allowed_projects:
    - Sandbox Demo
```

A user being able to submit a task does not automatically mean every worker may execute it.

---

# 9. Quota-aware execution and automatic continuation

This is a core product capability.

## 9.1 Execution states

Suggested state model:

```text
queued
leased
running
waiting_for_input
waiting_for_approval
waiting_for_quota
retry_scheduled
completed
failed
cancelled
```

A quota interruption is **not a failure**.

---

## 9.2 Runtime error taxonomy

Runtime adapters should normalize provider-specific output into categories such as:

```text
RATE_LIMIT
USAGE_LIMIT
AUTH_ERROR
CONTEXT_LIMIT
TRANSIENT_NETWORK
TOOL_ERROR
PROCESS_CRASH
INVALID_REQUEST
UNKNOWN
```

For `RATE_LIMIT` / `USAGE_LIMIT`:

1. stop issuing more work to that provider/session;
2. capture provider message safely;
3. persist checkpoint;
4. set `waiting_for_quota`;
5. persist `resume_after` when determinable;
6. otherwise apply configured exponential or bounded retry policy;
7. optionally try a compatible alternate runtime only if project policy permits it;
8. resume later.

Do not rely on undocumented assumptions about exact quota reset times.

---

## 9.3 Checkpoint requirements

A checkpoint must be sufficient to continue even if the provider conversation/session is lost.

Minimum checkpoint payload:

```yaml
checkpoint:
  project_id:
  run_id:
  step_id:
  worker_id:
  agent_profile:
  runtime:
  provider_session_id: optional
  repository:
    path_or_source:
    branch:
    head_sha:
    dirty_state_summary:
  objective:
  acceptance_criteria:
  completed_work_summary:
  files_changed:
  tests_run:
  test_results:
  last_agent_result:
  unresolved_findings:
  next_action:
  artifacts:
  created_at:
```

If there are uncommitted edits, the worker should persist enough information to avoid corruption. Prefer safe git commits/worktrees/checkpoint branches for long-running agent changes.

---

## 9.4 Resume strategy

Resume priority:

```text
1. Resume original runtime session if officially supported and session is valid.
2. Otherwise start a new runtime session with a generated Resume Brief.
```

A Resume Brief should contain only the necessary context:

```text
Project
Current task
Acceptance criteria
Architecture constraints
Relevant prior decisions
Git branch + current SHA
Summary of completed work
Files already modified
Tests/results
Auditor findings
Exact next action
```

This makes continuation provider-independent.

---

## 9.5 Scheduler behavior during quota wait

When one runtime is unavailable:

- worker should remain online;
- unrelated projects/tasks may continue;
- tasks using other runtimes may continue;
- the blocked task remains visible;
- UI shows reason and retry/resume status;
- no duplicate execution is allowed.

Use execution leases + idempotency keys to protect against the same step being picked up twice after reconnects/retries.

---

# 10. Auditor → Executor orchestration

This should become a reusable workflow template.

## 10.1 Proposed state machine

```text
TASK_CREATED
    ↓
AUDITOR_DISCOVERY
    ↓
AUDITOR_WORK_PACKAGE
    ↓
EXECUTOR_IMPLEMENTATION
    ↓
AUTOMATED_CHECKS
    ↓
AUDITOR_REVIEW
    ├── APPROVED → HUMAN/DELIVERY CHECKPOINT → COMPLETE/NEXT TASK
    ├── CHANGES_REQUESTED → EXECUTOR_IMPLEMENTATION
    └── BLOCKED → HUMAN INPUT
```

## 10.2 Guardrails

Configurable per project:

```yaml
workflow:
  max_review_iterations: 4
  require_tests: true
  require_human_before_merge: true
  require_human_before_deploy: true
  allow_runtime_fallback: false
```

If `max_review_iterations` is reached, stop and escalate rather than looping forever.

---

# 11. Prompt/work-package contract

Agents should not pass free-form chat messages as the only contract.

The Auditor produces a structured work package:

```yaml
work_package:
  title:
  objective:
  context:
  repository_scope:
  files_or_modules_of_interest:
  constraints:
  implementation_guidance:
  prohibited_changes:
  acceptance_criteria:
  required_tests:
  expected_artifacts:
  known_risks:
```

The Executor returns:

```yaml
execution_result:
  summary:
  files_changed:
  implementation_notes:
  tests_run:
  test_results:
  assumptions:
  blockers:
  follow_up:
```

This structure is critical for reliable automation and resumption.

---

# 12. Suggested data model

Do not treat this as final SQL; Codex should adapt it to the repository conventions.

Suggested tables/entities:

```text
workspaces
workspace_members

projects
project_members
project_sources
project_documents
project_context_snapshots
project_decisions
project_events

initiatives
tasks

agent_profiles
runtime_configs

workers
worker_capabilities
worker_project_permissions
worker_heartbeats

runs
run_steps
execution_leases
checkpoints
artifacts

quota_events
runtime_events
```

Important relationships:

```text
workspace 1─N projects
project   1─N tasks
project   1─N documents
project   1─N context_snapshots
project   1─N runs
run       1─N steps
step      1─N checkpoints
worker    N─N projects (explicit permission)
user      N─N projects/workspaces (RBAC)
```

---

# 13. Local mode vs connected mode

The architecture should support two useful modes.

## 13.1 Local / standalone

For development or sensitive projects:

```text
Browser → local TeamClaw → local worker → local repo / CLI
```

A minimal implementation can still use configured Supabase initially if replacing persistence would distract from the product slice. True offline/local persistence can be a later feature.

## 13.2 Connected / hosted control plane

Primary target:

```text
Phone / Mac / Browser
       ↓
Hosted TeamClaw Control Plane
       ↓
outbound worker connection
       ↓
ThinkPad / Mac / VM
       ↓
local repo + Codex/Claude CLI
```

The hosted control plane stores orchestration state, not local CLI credentials.

---

# 14. Execution routing

Each task declares capabilities.

Example:

```yaml
requirements:
  repository: ipiranga
  git: true
  docker: true
  runtime: claude-cli
```

Workers advertise capabilities.

Scheduler selects a compatible worker based on:

1. project authorization;
2. repository availability;
3. required runtime;
4. worker online state;
5. active capacity;
6. quota/provider availability;
7. explicit user override.

UI can expose:

```text
Execution location:
(*) Auto
( ) ThinkPad Home
( ) MacBook
( ) Cloud
```

Start with `Auto` + explicit worker selection. Sophisticated distributed scheduling can come later.

---

# 15. Security principles

Required from the first usable external test:

1. **No CLI credentials in the repository/database.**
2. **No direct inbound port requirement on local workers.**
3. **Project-level authorization.**
4. **Worker-project allowlists.**
5. **Server-side API authorization for every mutation.**
6. **Do not expose `.env` values during discovery.**
7. **Sanitize logs before uploading.**
8. **Audit important actions.**
9. **Human approval before destructive/production actions by default.**
10. **Never let a test user indirectly execute arbitrary shell commands on the owner's personal worker.**
11. Use constrained task types and workspace/repository roots rather than accepting unrestricted paths/commands from browser input.
12. Prefer git worktrees/branches for isolated agent execution.

---

# 16. Observability / UX

Each project page should eventually expose:

```text
Project status
Current branch / revision
Project Brain freshness
Workers available
Active runs
Blocked runs
Quota waits
Open tasks
Recent discoveries
Artifacts
Decisions
Event timeline
```

Example timeline:

```text
15:08  Task started
15:09  ThinkPad acquired execution lease
15:10  Codex auditor started
15:14  Work package produced
15:15  Claude executor started
15:31  Claude quota reached
15:31  Checkpoint CP-204 created
15:31  Step paused — waiting_for_quota
17:04  Runtime available
17:04  Step resumed from CP-204
17:22  Tests passed
17:24  Codex review started
17:29  Changes requested
```

The UI should clearly distinguish:

- running;
- waiting for quota;
- waiting for human;
- failed.

---

# 17. Recommended implementation phases

## Phase 0 — Architectural foundation

**Goal:** Prepare the existing POC for durable projects without breaking current behavior.

Deliverables:

- inspect current code and migrations;
- introduce `projects` as first-class entity;
- associate existing/new deliveries with a project;
- introduce project events;
- centralize authorization helpers;
- preserve existing API/tests where possible;
- create versioned migration(s), never edit already-applied migrations destructively;
- add `/docs` architecture notes.

Acceptance:

- multiple projects can be persisted;
- current delivery flow still works;
- all project reads/writes are server-authorized.

---

## Phase 1 — Multi-user / project registry

**Goal:** Make Henrique-style external testing safe.

Deliverables:

- workspace/project membership;
- roles (`owner/admin/member/tester/viewer` or equivalent);
- project list/dashboard;
- project create/open;
- membership checks on API routes;
- event/audit records.

Acceptance:

- user A cannot read project B without membership;
- tester can be restricted to a demo project;
- private Ipiranga project is invisible to Henrique unless explicitly shared.

---

## Phase 2 — Document ingestion + Project Brain v1

**Goal:** Start projects from existing documentation.

Deliverables:

- upload artifact metadata;
- raw artifact storage abstraction;
- `.md`/`.txt` first;
- `.docx` and `.pdf` next;
- normalized extracted content;
- provenance;
- project context snapshot;
- UI showing sources/context.

Acceptance:

- user can create a project, upload a document and see extracted project context without manually retyping it.

---

## Phase 3 — Local Worker + runtime adapters

**Goal:** Execute work on ThinkPad/Mac while controlled by hosted TeamClaw.

Deliverables:

- worker daemon package/process;
- registration/token mechanism;
- heartbeat;
- capability reporting;
- outbound task polling/long-poll;
- execution lease;
- Codex CLI adapter;
- Claude CLI adapter;
- sanitized event/log streaming;
- cancellation.

Acceptance:

- start a task from phone/browser;
- authorized ThinkPad acquires it;
- ThinkPad invokes the selected CLI locally;
- results return to the project timeline;
- no CLI authentication material is stored by the control plane.

---

## Phase 4 — Checkpointing + quota-aware pause/resume

**Goal:** Remove the requirement for a human to wait at the machine for provider limits.

Deliverables:

- runtime error taxonomy;
- `waiting_for_quota` state;
- quota event persistence;
- checkpoint model;
- resume brief generator;
- retry scheduler;
- idempotent reacquisition;
- UI status;
- tests simulating quota interruption.

Acceptance scenario:

1. start executor task;
2. simulate provider usage limit;
3. system checkpoints and pauses;
4. no task duplication occurs;
5. runtime becomes available;
6. system resumes automatically;
7. completion is linked to original run.

This is a **must-have acceptance test**.

---

## Phase 5 — Brownfield Deep Discovery

**Goal:** Understand an existing project before changing it.

Deliverables:

- register repository/source;
- safe repository scanner;
- discovery stages;
- architecture synthesis;
- dependency/module/test/CI inventory;
- risk/gap report;
- versioned discovery snapshot;
- Project Brain update.

Acceptance:

- connect an existing repository and receive a reproducible discovery report before any source modification occurs.

---

## Phase 6 — Auditor ↔ Executor workflow

**Goal:** Automate the current Ipiranga Codex/Claude workflow.

Deliverables:

- workflow template;
- Auditor profile;
- Executor profile;
- structured work package;
- structured execution result;
- automated checks;
- auditor review;
- bounded revision loop;
- human escalation/approval.

Acceptance:

- Codex can inspect a task/repository and create the work package;
- Claude implements it;
- Codex reviews it;
- requested changes loop back;
- approvals and all artifacts remain attached to the run.

---

## Phase 7 — Advanced routing and productization

Later capabilities:

- multiple workers per task/project;
- cloud workers;
- API runtimes;
- local LLM runtimes;
- runtime cost policies;
- fallbacks;
- GitHub PR automation;
- CI-aware verification;
- deployment agents;
- notification integrations;
- richer artifact formats;
- semantic code/document retrieval;
- distributed execution.

Do not build these before the vertical slice is working.

---

# 18. Recommended first vertical slice

Do **not** try to implement the entire specification in one giant change.

The first meaningful vertical slice should prove:

```text
Multi-project Control Plane
        +
one authenticated test user
        +
one local worker (ThinkPad)
        +
Codex Auditor
        +
Claude Executor
        +
checkpoint / quota pause / resume
        +
one existing repository
```

Recommended demonstration:

1. Register `Agentic Delivery Platform` and `Ipiranga` as distinct projects.
2. Register `thinkpad-home` worker.
3. Submit a small safe task to Ipiranga.
4. Codex creates a work package.
5. Claude begins implementation.
6. Simulate a quota interruption.
7. TeamClaw saves the checkpoint and shows `waiting_for_quota`.
8. Re-enable runtime.
9. TeamClaw resumes automatically.
10. Codex reviews the result.
11. Full activity is visible from another device.

If this works reliably, the core product thesis is validated.

---

# 19. Engineering constraints for Codex

When implementing this specification:

1. **Perform deep discovery of the existing TeamClaw repository first.**
2. Do not blindly replace the current POC.
3. Preserve the existing Cloudflare/Vinext/Supabase foundation unless there is a concrete blocker.
4. Prefer additive migrations.
5. Keep secrets server-side/local.
6. Keep CLI auth on the worker.
7. Design runtime adapters provider-agnostically.
8. Do not depend on a provider's conversation session as the only source of resumability.
9. Make every long-running execution checkpointable.
10. Favor deterministic state machines over agents deciding orchestration state informally.
11. Create tests for state transitions and quota interruptions.
12. Use idempotency keys and execution leases.
13. Use safe git branches/worktrees for code-changing agents.
14. Avoid unrestricted browser-to-shell functionality.
15. Keep implementation changes in small, reviewable slices.
16. After each slice, update `docs/implementation-status.md` with what exists, schema changes, commands, tests and next step.
17. Run existing tests/lint/build as appropriate before declaring a slice complete.

---

# 20. Non-goals for the initial evolution

Do not prioritize yet:

- fully autonomous production deployments;
- dozens of agent personas;
- complex visual workflow builder;
- automatic provider switching without explicit policy;
- enterprise billing;
- full offline-first sync;
- arbitrary remote shell;
- Kubernetes/distributed compute;
- vector database solely because it is fashionable;
- attempting to index every byte of every repository.

Keep the architecture extensible, but prove the workflow first.

---

# 21. Key architectural decisions to capture as ADRs

Codex should create ADRs for at least:

1. Project as the top-level durable context boundary.
2. Control Plane vs Worker separation.
3. Outbound-only worker communication for local nodes.
4. Provider-agnostic runtime adapter interface.
5. Checkpoint-based resumability independent of LLM session persistence.
6. Project/worker authorization model.
7. Structured Auditor→Executor work package contract.
8. Git isolation strategy for agent changes.
9. Artifact storage strategy.
10. Initial worker transport (polling/long-poll vs WebSocket).

---

# 22. Definition of Done for the evolution MVP

The evolution MVP is successful when all statements below are true:

- [ ] TeamClaw supports multiple isolated projects.
- [ ] Project context persists independently from a chat/session.
- [ ] An authorized second user can test only projects shared with them.
- [ ] A local ThinkPad can act as a remote execution worker.
- [ ] The user can submit/monitor work from another machine or phone.
- [ ] Codex CLI and Claude CLI can be configured as distinct agent runtimes.
- [ ] An Auditor can generate a structured work package for an Executor.
- [ ] Executor results can be returned for Auditor review.
- [ ] The review loop has configurable limits and human escalation.
- [ ] A repository can be registered and deeply discovered before modifications.
- [ ] Markdown/text documentation can feed the Project Brain; DOCX/PDF follow without redesigning the model.
- [ ] Runtime quota exhaustion transitions the work into a resumable paused state instead of failure.
- [ ] TeamClaw automatically resumes after availability returns, without requiring the user to stay at the machine.
- [ ] Resume works even when the original provider conversation cannot be restored.
- [ ] CLI credentials never need to leave the local worker.
- [ ] Execution history, checkpoints and important decisions are auditable.

---

# 23. Product principle

The central design rule for future development is:

> **A TeamClaw project must survive devices, sessions, agents, provider limits and time.**

The system should be able to stop today on a ThinkPad, be inspected tomorrow from a phone, continue next week from a Mac or another worker, and still know:

- what the project is;
- why decisions were made;
- where the code is;
- what has already been done;
- what remains;
- what the Auditor thinks;
- what the Executor changed;
- what is blocked;
- and exactly how to safely continue.

That persistent project state — not the individual chat session — is the core of TeamClaw.
