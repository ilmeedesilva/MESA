# Real-World Evaluation Repositories

Local copies of real, third-party open-source repositories used for MESA's Phase 7 real-repository evaluation (see `docs/research/EVALUATION_SETUP_AND_RESULTS.md` and `docs/guides/IMPLEMENTATION_PHASE_TRACKER.md`). This directory is gitignored: third-party source is not committed into MESA's history.

## Repositories

| Directory | Source | Commit evaluated | Fetched |
| --- | --- | --- | --- |
| `online-boutique/src/` | https://github.com/GoogleCloudPlatform/microservices-demo | `b9a978db9e01f4ad3dca9494a22cb9edc17548fe` | 2026-09-14 |
| `spring-sample/` | https://github.com/piomin/sample-spring-microservices-new | `cc5c9fbe771772eb40d091ee2371286ecd099083` | 2026-09-14 |

Only `online-boutique/src/` (the actual service source) is kept; the rest of that repository (Terraform, Helm charts, CI workflows) was not needed for MESA's static analysis and was excluded to keep this directory small. `spring-sample/` is kept in full since it is already small.

## How to regenerate

These were fetched using MESA's own `GITHUB_URL` ingestion, then the resulting extracted workspace was copied here for a stable path the `benchmarks/real_repo_*.yml` files can reference (MESA's own repo-cache workspaces are per-run, UUID-suffixed, and swept on a TTL — not stable enough to reference directly from a committed benchmark file):

```python
from mesa.ingestion.repository import prepare_repository
from mesa.models import RepoScanRunRequest, RepoSourceType

prepared = prepare_repository(RepoScanRunRequest(
    source_type=RepoSourceType.GITHUB_URL,
    location="https://github.com/GoogleCloudPlatform/microservices-demo",
))
print(prepared.root_path)  # copy this directory's src/ here as online-boutique/src
```

Re-running against a newer commit will very likely change the exact findings (line numbers, file counts, any new/removed hard-coded URLs, dependency additions). The `ground_truth` labels in `benchmarks/real_repo_online_boutique.yml` and `benchmarks/real_repo_spring_sample.yml` were reviewed against the commits above; re-review them if these directories are refreshed to a newer commit.
