# Deployment Cleanup Execution Order (Build-Failure Remediation)

This plan is the ordered path to stabilize Paperclip deployment after repeated partial removals. It focuses on restoring deterministic builds first, then hardening so adapter/package churn cannot silently break Docker/CI again.

## Goals

1. Unblock deployment immediately.
2. Remove fragile/manual build wiring.
3. Add guardrails so workspace drift is caught early.
4. Keep docs and runtime wiring aligned.

## Comparison to the 6 already-completed remediation commits

Status mapping against the six historical commits (`70c487a`, `86ee656`, `b84bf94`, `4a0d247`, `b06b308`, `5bcabe8`):

1. **Switch to `pnpm install --no-frozen-lockfile` in Docker deps stage** — ✅ Completed and retained.
2. **Temporary add/remove of Gemini Docker manifest path** — ⚠️ Incomplete in prior state; now superseded by adapter-directory copy in deps stage.
3. **Remove Gemini workspace dep in CLI** — ⚠️ Completed earlier, but does not by itself protect Docker workspace resolution.
4. **Remove Gemini workspace dep in Server** — ⚠️ Completed earlier, but does not by itself protect Docker workspace resolution.
5. **Remove Gemini workspace dep in UI (later reverted)** — ⚠️ Not a stable fix; UI currently depends on Gemini again.
6. **Overall outcome of the six commits** — ⚠️ Partial Phase 1 only; did not complete brittleness removal or CI preflight guardrails.

This plan's P0 priorities below are ordered to close those remaining gaps in a durable way.


## Implementation Status (current)

- ✅ Phase 1 baseline unblock implemented in Docker deps install path.
- ✅ Phase 2 brittleness reduction implemented by copying adapter directory in deps stage.
- ✅ Phase 3 guardrail implemented with CI Docker deps-stage preflight.
- ✅ Added `pnpm check:workspace-deploy` consistency check for workspace/deploy drift.
- ⏳ Phase 4 adapter registry consolidation is still pending.
- ⏳ Phase 5 broader documentation alignment remains ongoing.

## Phase 0 — Baseline & Freeze (P0, immediate)

- Cut a short-lived remediation branch.
- Freeze dependency/package removal changes until baseline passes.
- Record failing pipeline/build logs as reference artifacts.

**Exit criteria**

- Team agrees no more adapter/package removals while remediation is in flight.
- Current failures are reproducible locally (or in CI) from clean state.

## Phase 1 — Immediate unblock for current failure (P0)

### 1.1 Fix Docker workspace manifest copy gap

- In root `Dockerfile` `deps` stage, ensure every workspace package that appears in `workspace:*` dependencies has its `package.json` available before `pnpm install`.
- Specifically include missing `packages/adapters/gemini-local/package.json`.

### 1.2 Verify deps-stage resolution

- Build Docker `deps` stage (or full image) and confirm no `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`.
- Confirm `pnpm install --no-frozen-lockfile` completes in container context.

**Exit criteria**

- Docker install step succeeds with current workspace.
- Deploy pipeline proceeds past dependency install.

## Phase 2 — Eliminate fragile hand-maintained adapter copy list (P0)

### 2.1 Replace manual adapter manifest enumeration

- Refactor Docker install-layer inputs to stop enumerating each adapter by name.
- Use one of:
  - copy `packages/adapters/*/package.json` via broad copy strategy, or
  - copy adapter folder tree needed for install-layer determinism.

### 2.2 Cache-conscious layering

- Keep lockfile/package-manifest-first layering so cache remains effective.
- Avoid coupling deps layer to frequently changing non-manifest source files unless required.

**Exit criteria**

- Adding/removing an adapter under `packages/adapters/*` no longer requires Dockerfile edits for workspace resolution.

## Phase 3 — Add deploy guardrails in CI (P0)

### 3.1 Add container-context preflight

- Add CI job that validates install/build in the same Dockerfile pathway used for deployment.
- At minimum validate deps stage and fail on workspace package resolution errors.

### 3.2 Fail fast on workspace drift

- Ensure errors like `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` block merge.
- Keep logs/artifacts visible in CI output for quick triage.

**Exit criteria**

- Broken workspace references are detected before deploy attempts.

## Phase 4 — Adapter contract consolidation (P1)

### 4.1 Centralize adapter registry

- Define a canonical adapter list/metadata source (e.g. in shared package).
- Remove duplicated hardcoded lists where feasible (UI/server/deploy scripts/docs).

### 4.2 Add drift validator

- Add a check that compares discovered `packages/adapters/*` against the canonical registry.
- Fail when adapter exists in one place but not the other.

**Exit criteria**

- Adapter enablement/visibility changes are single-source and validated.

## Phase 5 — Deployment documentation alignment (P1)

- Update deploy docs to match actual Docker/CI behavior and required inputs.
- Add troubleshooting section for pnpm workspace resolution failures in Docker deps stage.
- Document adapter add/remove workflow and expected checks.

**Exit criteria**

- Operators can follow one documented path without tribal knowledge.

## Phase 6 — Full verification gate (P0 before release)

Run full repository verification before marking remediation complete:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

Also run deployment-path checks:

```sh
docker build -t paperclip-local .
```

If CI uses an alternate Dockerfile/target, run that exact command too.

**Exit criteria**

- Typecheck, tests, build, and Docker deploy path all pass from clean checkout.

## Suggested Ownership & Sequence

1. **Platform/Infra**: Phase 1–3 (unblock + hardening in Docker/CI).
2. **App maintainers**: Phase 4 (adapter registry/drift checks).
3. **Docs owner**: Phase 5.
4. **Release captain**: Phase 6 + rollout sign-off.

## Rollback / Safety

- If Phase 2 refactor causes unexpected cache or build regressions, temporarily keep Phase 1 minimal fix and ship while Phase 2 is isolated behind follow-up PR.
- Do not merge adapter removals until Phase 3 preflight is live.

## Done Definition for this remediation

- Current deploy blocker fixed.
- Dockerfile no longer adapter-name brittle.
- CI preflight catches workspace/dependency drift.
- Adapter contract/documentation are consistent.
- Full verification and deployment build pass.
