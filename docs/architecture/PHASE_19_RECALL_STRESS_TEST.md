# Phase 19: Recall Stress-Test Fixture

Status: Implemented.

## Goal

Both real-repository evaluations (Phase 15) tested mostly precision: they measured how many of MESA's findings were correct, on repositories that happen to be comparatively well-architected. Neither was chosen because it contains known, intentional anti-patterns, so recall (does MESA find everything that is really there?) had not been specifically stress-tested. Real repositories with well-documented intentional anti-patterns are hard to source reliably, so this builds a synthetic one instead, fully under ground-truth control — and specifically tests something the existing synthetic fixtures also didn't: whether multiple anti-patterns **co-occurring in one scan** interfere with or mask each other.

## What Was Built

`tests/fixtures/recall-stress/`: 8 services, 5 anti-pattern types deliberately interleaved in a single scan (existing seeded fixtures mostly isolate one pattern per system):

- **3-node cyclic dependency**: `checkout-service → billing-gateway-service → fulfillment-service → checkout-service`.
- **Chatty pair**: `alert-service → profile-service`, 4 static call sites.
- **3-service shared database**: `checkout-service`, `billing-gateway-service`, and `ledger-service` all reference `platform_ledger_db`.
- **God Service hotspot**: `platform-hub-service` — 10 endpoints, 7 distinct outbound call targets (one to every other service in the system), plus 20 filler files for file-volume/domain-breadth, mirroring the already-validated `tests/fixtures/god/platform-service` pattern. Scores exactly `70.0` — right at `HIGH_RISK_THRESHOLD` — a deliberate boundary-condition case.
- **Source-level hard-coded dependencies**: `legacy-bridge-service` hard-codes 2 private-IP addresses.

Added as a new `recall-stress-test` system in `benchmarks/ground_truth.yml`.

## Methodology

Ground truth was **hand-predicted from the fixture's design before running MESA**, using the exact matching logic already validated by the existing `chatty-services`/`cyclic-dependencies`/`shared-database`/`god-service` ground-truth entries (each service-to-service call URL also produces its own `HARD_CODED_SERVICE_DEPENDENCY` finding, confirmed by inspecting those existing entries first). This avoids the circularity of deriving ground truth from MESA's own output, which would make a recall test meaningless by construction.

Two predictions didn't match on the first run, both explained rather than silently absorbed:

- `checkout-service` and `billing-gateway-service` each produced one more `HARD_CODED_SERVICE_DEPENDENCY` finding than predicted, and `ledger-service` produced one where none was predicted. Root cause: the literal substring `db-host:5432` inside each service's `platform_ledger_db` connection string independently matches the extractor's generic host:port pattern, in addition to being parsed as a database connection (which produces the separate `SHARED_DATABASE` finding). This is existing, general extractor behavior, not specific to this fixture — recorded as an `evaluator_note` rather than treated as a fixture bug.

After accounting for that, MESA's actual output matched the prediction exactly: 26/26 findings, zero false positives, zero false negatives, both for detection and for service discovery.

## Result

```
detector:  precision 1.0000 | recall 1.0000 | F1 1.0000  (26/26, 0 FP, 0 FN)
discovery: precision 1.0000 | recall 1.0000
```

This is an honest, informative "no gap found" result: it demonstrates MESA's detectors compose correctly on a harder, multi-pattern system and that a God Service score sitting exactly at the HIGH-risk threshold still produces a finding — not that MESA has no recall limitations at all. It complements, rather than replaces, the still-open need for real (not synthetic) repositories chosen specifically for containing intentional anti-patterns.

## Verification

- `tests/test_pipeline.py::test_recall_stress_fixture_finds_every_interleaved_anti_pattern` — asserts the exact finding-type set, the 3-way cycle, the chatty pair, the 3-way shared database, the God Service score `>= 70.0`, and the total finding count (26).
- `mesa evaluate benchmarks/ground_truth.yml` — full suite including this system: 1.0/1.0/1.0 overall, cross-checked against the JSON export for the `recall-stress-test` system specifically.
- Full suite: 80 passed, `ruff check` clean.

## Limitations

- Still a synthetic, hand-authored fixture — it demonstrates MESA can find multiple co-occurring, deliberately-planted anti-patterns in one scan, not that real messy systems look like this or that MESA has no recall gaps on real code.
- Doesn't address language-coverage-driven recall loss (Go/C#/etc.) — that's Step 10 (Go language support) in the remediation plan, a separate concern.
