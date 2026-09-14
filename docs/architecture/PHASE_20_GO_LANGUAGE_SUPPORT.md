# Phase 20: Go Language Support (MVP)

Status: Implemented.

## Goal

Close the largest real-world coverage gap found in Phase 15: MESA's extractor only parsed Python, JavaScript/TypeScript, and Java, so on Online Boutique — where 6 of 12 real services are Go or C# — most of the system's real logic was invisible to MESA. This phase adds Go, matching the effort/style of existing language support rather than introducing a new parsing architecture.

## Design Decision: Regex, Not a New Parser

An important finding from this session: **`tree-sitter` and `libcst` are listed as project dependencies but neither is actually used anywhere in the code.** Python/JS/Java extraction in `src/mesa/analysis/extractor.py` (`_extract_python_file`, `_extract_javascript_file`, `_extract_java_file`) is already regex/AST-on-literals based, not full semantic parsing. Go support follows the same pattern for consistency and effort-proportionality — introducing a real AST-based parser for one language while the other three remain regex-based would be an inconsistent, disproportionate architecture change for an MVP. Wiring up `tree-sitter`/`libcst` properly (for more robust parsing across *all* languages) is flagged as separate future work, not done here.

## What Was Added

`src/mesa/analysis/extractor.py`:

- `_extract_go_file()`: new regex patterns for `net/http` endpoint registration (`http.HandleFunc`), gin/echo/mux-style routes (`router.GET(...)`, etc.), `net/http` client calls (`http.Get`/`Post`/`Head`/`PostForm`), and `grpc.Dial`/`grpc.NewClient`/`grpc.DialContext` — all literal-string-argument only, matching how the other three languages already work.
- `detect_language()`: recognizes `.go` files.
- `.go` added to `ANALYZED_TEXT_SUFFIXES`, so the existing generic `HARD_CODED_SERVICE_DEPENDENCY` scanning (already language-agnostic) now also runs on Go source — no new code needed for this part.

`src/mesa/discovery/service_candidates.py`:

- `go.mod` added to `_MANIFEST_WEIGHTS` (0.28, matching `requirements.txt`'s weight for a dependency-manifest-only file), `_LANGUAGE_BY_FILENAME`, and `_SERVICE_ROOT_MARKERS`. `.go` added to `_LANGUAGE_BY_SUFFIX`.

## Verified Result — and an Honest Limitation It Surfaced

**Verified on dedicated fixtures** (`tests/fixtures/go-services/`): a 2-service pair with `net/http` and `grpc.Dial` literal calls correctly produces endpoints, calls, a `CYCLIC_DEPENDENCY` finding spanning a *mixed* HTTP+gRPC call graph, and `HARD_CODED_SERVICE_DEPENDENCY` findings — the extraction mechanism works exactly as intended.

**Re-running against the real Online Boutique repository** (`benchmarks/real_repo_online_boutique.yml`) gave a genuinely mixed, honestly-reported result:

| Metric | Before | After |
|---|---:|---:|
| Discovery recall | 0.8333 (10/12) | 0.9167 (11/12) |
| Discovery F1 | 0.9091 | 0.9565 |
| Detector precision/recall/F1 | 1.0/1.0/1.0 | 1.0/1.0/1.0 (unchanged) |

- **Discovery genuinely improved**: `frontend` (previously missing entirely) is now discovered at confidence 0.50; `checkoutservice`, `productcatalogservice`, `shippingservice` (previously 0.35/language=unknown) are now discovered at 0.63/language=go. `cartservice` (C#) is unaffected — out of scope for this Go-only step.
- **Detector findings did not change.** Checked directly: `checkoutservice`, `frontend`, `productcatalogservice`, and `shippingservice` each extract to 0 endpoints and 0 calls even with Go support enabled. The reason is visible in the real source (e.g. `src/frontend/main.go`): `addr := os.Getenv("LISTEN_ADDR")` then `grpc.NewClient(addr, ...)` — the address is a **variable**, not a literal string, so no literal-string-based extractor (Go's new one, or the existing Python/JS/Java ones) can see it. This is a general, pre-existing MESA limitation already named in `docs/research/THREATS_TO_VALIDITY.md`'s Internal Validity section ("dynamically generated URLs... runtime configuration may be missed"), not something specific to Go or to this fix. Confirmed Online Boutique's Go files also contain no literal hard-coded addresses at all (only Apache license header URLs), so the hard-coded-dependency scanning genuinely had nothing new to find here either.

This is reported as-is rather than reframed as a bigger win than it is: Go support is real and independently verified, and it closed the discovery gap, but on this specific repository it did not close the detection gap, because the repository's own coding convention (env-var-sourced addresses) sits outside what static, literal-value extraction can ever see — a limitation of the general approach, not of this implementation.

## Verification

- `tests/test_pipeline.py::test_go_extraction_detects_endpoints_calls_and_cross_service_cycle` — endpoints, calls, and a cross-service cycle formed from mixed HTTP+gRPC calls.
- `tests/test_pipeline.py::test_go_mod_manifest_is_discoverable_and_selects_go_language` — `go.mod` recognized, confidence clears the minimum cutoff, language correctly resolved to `go`.
- Full suite: 82 passed, `ruff check` clean.
- Real-repo re-evaluation cross-checked directly against extracted `ServiceFacts` (endpoint/call counts) and the JSON evaluation export, not just the summary numbers.

## Limitations

- Literal-string arguments only — the same constraint as Python/JS/Java extraction, and the reason this step did not change Online Boutique's detector findings.
- Endpoint/call framework coverage is intentionally minimal (`net/http`, gin/echo/mux-style routes, `grpc.Dial`/`NewClient`/`DialContext`) — not an exhaustive catalog of Go web/RPC frameworks.
- C# is still entirely unsupported; `cartservice` remains undiscovered. A `.csproj`/`.sln`-based discovery fix would be the direct analogue of this step for C#, not attempted here.
