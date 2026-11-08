# Reproducing the research results

This guide reproduces the detection and discovery results reported in the MESA research report
and conference paper: 76/76 seeded findings, and 30/30 hard-coded dependencies across
three public repositories with no false positives.

## Which version

Use the git tag **`v0.1.0-research`**. Its source code, tests, benchmark manifests and
committed results are identical to the commit the results came from.

> **Commit IDs changed on 2026-11-08.** The repository history was rewritten to change a
> commit author email address. File contents were not changed: every commit has the same tree
> hash as before. The results commit was **`fb2f3e6`** and is now
> **`2940dbd644294957b36eccdc5e53abf63884cb1c`**. Both have tree
> `5fe9a9e7ea6b573f62e03c920b034f2961e4e39b`.

## Steps

Requires Python 3.10 or later and internet access to download the benchmark repositories.
Total time is about 5 minutes. Most of it is the download; the four evaluations together
take a few seconds.

```bash
git clone https://github.com/ilmeedesilva/MESA.git
cd MESA
git checkout v0.1.0-research

python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

python -m pytest -q                       # expect: 116 passed
python scripts/fetch_benchmark_repos.py   # downloads the 10 pinned repos, checks hashes

export PYTHONHASHSEED=0                   # fixed ordering of findings (see note below)

mesa evaluate benchmarks/ground_truth.yml               -o benchmarks/results/latest/repro/synthetic
mesa evaluate benchmarks/real_repo_online_boutique.yml  -o benchmarks/results/latest/repro/online-boutique
mesa evaluate benchmarks/real_repo_spring_sample.yml    -o benchmarks/results/latest/repro/spring-sample
mesa evaluate benchmarks/real_repo_sockshop.yml         -o benchmarks/results/latest/repro/sockshop
```

Compare each `mesa_evaluation_results.json` with the committed file for the same benchmark.

> **Where the committed results are.** At the tag `v0.1.0-research` they are in
> `evaluation-results/` (`.` for synthetic, `real-repo-online-boutique`,
> `real-repo-spring-sample`, `real-repo-sockshop`). Later versions moved the same files,
> unchanged, to `benchmarks/results/v0.1.0-research/` (`synthetic/` plus the same three
> folders). Use the paths that match the version you checked out.

The fetch script downloads each repository at the commit listed in
`scripts/fetch_benchmark_repos.py` and lays it out under `benchmarks/real-repos/`. Only `src/`
is kept for Online Boutique. Each folder is checked against a pinned SHA-256 content hash, so
a wrong layout or a changed download fails loudly. Use `--verify` to check an existing copy
without downloading.

## Expected results

| Benchmark | TP | FP | FN | Precision | Recall | F1 | Discovery P / R / F1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Seeded (8 systems, 32 services) | 76 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | 0.9688 / 1.0000 / 0.9821 |
| Online Boutique | 2 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | 1.0000 / 0.9167 / 0.9565 |
| Spring Boot sample | 24 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | 0.7500 / 1.0000 / 0.8571 |
| Sock Shop | 4 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | 0.3478 / 1.0000 / 0.5161 |
| Real repositories, combined | 30 | 0 | 0 | 1.0000 | 1.0000 | 1.0000 | |

Verified on 2026-11-08 from a fresh fetch, in the environment recorded in
[`ENVIRONMENT.md`](../../benchmarks/results/v0.1.0-research/ENVIRONMENT.md)
(`evaluation-results/ENVIRONMENT.md` at the tag):

- **Seeded benchmark and Sock Shop** reproduce the committed result files byte for byte. With
  `PYTHONHASHSEED=0` this holds on every run.

> **Ordering of findings.** Python randomises string hashing per process unless
> `PYTHONHASHSEED` is set, and this changes the order in which cycle findings are listed (and
> the order of services within them) in the JSON file. The *set* of findings, every metric and
> every true/false positive is the same on every run: this was checked with six different seeds.
> Set `PYTHONHASHSEED=0` to get byte-identical files.
- **Online Boutique and the Spring Boot sample** reproduce every detector and discovery value
  in the committed files. The re-run also includes an *Explanation Quality* section that is
  empty in the committed files. Those files were generated in commit `30a6cc8` (now rewritten)
  shortly before `explanation_checks` were added to the two benchmark manifests, and were not
  regenerated afterwards. The re-run values match Table 5.8 of the research report:

  | Repository | Helpfulness | Grounding | Coverage |
  | --- | --- | --- | --- |
  | Online Boutique | 1.0000 | 1.0000 | 1.0000 |
  | Spring Boot sample | 0.9500 | 1.0000 | 1.0000 |
  | Sock Shop | 0.9500 | 1.0000 | 1.0000 |

  The committed result files are left unchanged as the original record.

These explanation scores come from MESA's built-in grounded explainer, which is
deterministic. No AI service is called unless `MESA_AI_MODE` is set to a live mode; leave it
unset when reproducing.

## AI-baseline comparison: recorded, not re-run

The LLM comparison (research report Section 5.6.4, paper Table IV) is **not** part of this
reproduction. Re-running it makes paid API calls, and model output varies between runs, which
is what the study measured. The recorded outputs are the record:

- Claude Sonnet 5, run 2026-09-24: `benchmarks/results/v0.1.0-research/ai-baseline/claude-sonnet-5/`
  (`evaluation-results/ai-baseline-comparison/` at the tag)
- Claude Opus 5, run 2026-10-13: `benchmarks/results/v0.1.0-research/ai-baseline/claude-opus-5/`
  (`evaluation-results/ai-baseline-comparison-opus5/` at the tag)

Each JSON file records the provider, the model identifier, the number of runs per system, and
the per-run and summary scores for every system. The prompt is in
`src/mesa/evaluation/ai_baseline.py`.

## Later versions

Later MESA versions change discovery, extraction and matching, and may give different numbers.
The results in the research report and paper always refer to `v0.1.0-research`. Results for later
versions are stored in their own folders under `benchmarks/results/` and never overwrite the
files above. New runs default to the gitignored `benchmarks/results/latest/`.
