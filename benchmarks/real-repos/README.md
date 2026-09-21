# Real-World Evaluation Repositories

Local copies of real, third-party open-source repositories used for MESA's Phase 7 real-repository evaluation (see `docs/research/EVALUATION_SETUP_AND_RESULTS.md` and `docs/guides/IMPLEMENTATION_PHASE_TRACKER.md`). This directory is gitignored: third-party source is not committed into MESA's history.

## Repositories

| Directory | Source | Commit evaluated | Fetched |
| --- | --- | --- | --- |
| `online-boutique/src/` | https://github.com/GoogleCloudPlatform/microservices-demo | `b9a978db9e01f4ad3dca9494a22cb9edc17548fe` | 2026-09-14 |
| `spring-sample/` | https://github.com/piomin/sample-spring-microservices-new | `cc5c9fbe771772eb40d091ee2371286ecd099083` | 2026-09-14 |
| `sock-shop/catalogue/` | https://github.com/microservices-demo/catalogue | `925e08ee17c28b94b87160e1ae5e03da7f61cf84` | 2026-09-21 |
| `sock-shop/carts/` | https://github.com/microservices-demo/carts | `f4e80051668c6a83359c41b03a27baefa590adc8` | 2026-09-21 |
| `sock-shop/orders/` | https://github.com/microservices-demo/orders | `546a10c92d1ff9998c21f3849f5b95a0f14430a0` | 2026-09-21 |
| `sock-shop/payment/` | https://github.com/microservices-demo/payment | `384e33447dda5334187517dda09566c9a17fd6af` | 2026-09-21 |
| `sock-shop/shipping/` | https://github.com/microservices-demo/shipping | `9c0fbfa31895dd029d44d3434de93f64cd71f87b` | 2026-09-21 |
| `sock-shop/user/` | https://github.com/microservices-demo/user | `e1a79e77860734cacc3f64cabff1487e22a442a4` | 2026-09-21 |
| `sock-shop/queue-master/` | https://github.com/microservices-demo/queue-master | `7dc33721c765e5af415c9d244d84637ff2d510cd` | 2026-09-21 |
| `sock-shop/front-end/` | https://github.com/microservices-demo/front-end | `52dee656f4423be041619bbb090205f912e00113` | 2026-09-21 |

Only `online-boutique/src/` (the actual service source) is kept; the rest of that repository (Terraform, Helm charts, CI workflows) was not needed for MESA's static analysis and was excluded to keep this directory small. `spring-sample/` is kept in full since it is already small. The `microservices-demo` GitHub org (including all 8 `sock-shop/*` repos above) was archived by its owner on 2023-12-29 and is now read-only - no drift risk from re-fetching these commits.

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
