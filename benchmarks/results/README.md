# Benchmark results

| Folder | Contents |
| --- | --- |
| [`v0.1.0-research/`](v0.1.0-research/) | The results published in the MESA research report and conference paper. Committed, and never rewritten. |
| `latest/` | Where `mesa evaluate` and `mesa evaluate-ai-baseline` write by default. Gitignored. |

Results for a future release go in a new folder named after that release (for example
`v1.0.0/`), so the research numbers stay intact.

## Regenerate

```bash
python scripts/fetch_benchmark_repos.py      # once: download the pinned real repositories
mesa evaluate benchmarks/ground_truth.yml               -o benchmarks/results/latest/synthetic
mesa evaluate benchmarks/real_repo_online_boutique.yml  -o benchmarks/results/latest/real-repo-online-boutique
mesa evaluate benchmarks/real_repo_spring_sample.yml    -o benchmarks/results/latest/real-repo-spring-sample
mesa evaluate benchmarks/real_repo_sockshop.yml         -o benchmarks/results/latest/real-repo-sockshop
```

To reproduce the published numbers exactly, check out the tag `v0.1.0-research` and follow
[docs/research/REPRODUCE.md](../../docs/research/REPRODUCE.md).

The AI-baseline results are recorded outputs and are not meant to be re-run: re-running makes
paid API calls and model output varies. See [docs/research/ai-baseline.md](../../docs/research/ai-baseline.md).

## Old paths

These files were moved here unchanged from `evaluation-results/`. The research report and the
tag `v0.1.0-research` use the old paths.

| Old path (at `v0.1.0-research`) | Current path |
| --- | --- |
| `evaluation-results/mesa_evaluation_results.{json,csv}`, `mesa_evaluation_summary.md` | `v0.1.0-research/synthetic/` |
| `evaluation-results/real-repo-online-boutique/` | `v0.1.0-research/real-repo-online-boutique/` |
| `evaluation-results/real-repo-spring-sample/` | `v0.1.0-research/real-repo-spring-sample/` |
| `evaluation-results/real-repo-sockshop/` | `v0.1.0-research/real-repo-sockshop/` |
| `evaluation-results/ai-baseline-comparison/` | `v0.1.0-research/ai-baseline/claude-sonnet-5/` |
| `evaluation-results/ai-baseline-comparison-opus5/` | `v0.1.0-research/ai-baseline/claude-opus-5/` |
| `evaluation-results/ENVIRONMENT.md` | `v0.1.0-research/ENVIRONMENT.md` |
| `docs/research/EVALUATION_SETUP_AND_RESULTS.md` | [`docs/research/evaluation.md`](../../docs/research/evaluation.md) |
| `docs/research/AI_BASELINE_COMPARISON.md` | [`docs/research/ai-baseline.md`](../../docs/research/ai-baseline.md) |
| `docs/research/METHODOLOGY.md`, `THREATS_TO_VALIDITY.md` | [`docs/research/methodology.md`](../../docs/research/methodology.md) |
| `docs/research/DETECTION_ALGORITHMS.md` | [`docs/detectors.md`](../../docs/detectors.md) |
| `docs/architecture/PHASE_*.md` (per-phase build notes) | Summarised in [`CHANGELOG.md`](../../CHANGELOG.md); the originals remain readable at the tag `v0.1.0-research` |

Benchmark IDs, benchmark manifest files (`benchmarks/*.yml`) and test fixture paths are unchanged.
The notes inside the manifests still mention some of the old document paths above; the manifests
are part of the research record, so they are left as they were.
