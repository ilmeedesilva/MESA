# Changelog

All notable changes to MESA are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

The first release for everyday use: MESA now checks pull requests in CI, can be installed as a
Python package, and the web app is simpler. Compared with `v0.1.0-research`.

### Added

- **`mesa scan`** finds the services in a repository by itself and analyses them together.
  Tests, fixtures, examples, docs and vendored folders are skipped.
- **`mesa ci`** compares a branch with its base commit and fails only on *new* problems
  (new-only mode): a new finding at or above a chosen severity (default `HIGH`), a health
  score drop larger than allowed (default 5), a new cycle or a new policy violation. Exit codes:
  `0` passed, `1` failed, `2` usage or configuration error.
- **`.mesa.yml`** configuration file: which folders are services, gate mode and thresholds,
  chatty threshold and policies. Unknown keys are reported as errors.
- **Pull request report:** a Markdown comment with each new problem, its file and line, why it
  matters and how to fix it; fixed and existing problems collapsed; kept under GitHub's comment
  size limit. Also SARIF 2.1.0 for GitHub code scanning, annotations and the job summary.
- **GitHub Action** (`action.yml`): scans the pull request and its base commit, posts one
  comment and updates it on later pushes, uploads the reports, and fails the check on new
  problems. Inputs for the folder, thresholds, report-only mode and SARIF upload.
- **File and line for every finding.** Chatty, cyclic and shared-database findings now point
  at each call or connection setting; god-service findings at the file with most of the
  service's routes and at its largest files. Each finding has one `primary_location`.
- **Finding fingerprints** that ignore line numbers and file moves, so moving code does not
  make an old problem look new.
- **Python package** `mesa-analyzer` with the commands `mesa` and `mesa-analyzer`. The core
  install only needs what the command line uses; the web API (`[api]`), the AI explainer
  (`[ai]`) and everything (`[all]`) are optional extras. Python 3.10 to 3.13.
- **Web app:** Simple and Technical explanation levels; clear empty, loading and error states;
  a footer with the server version; an AI status line that names the provider in use.
- Pre-commit hooks, ruff, mypy, ESLint and a coverage floor in CI; Dependabot updates.

### Changed

- **Recommendation usefulness on the seeded benchmark: 0.8558 → 0.8750.** Chatty, cyclic and
  shared-database findings now record the file and line of each call or connection setting
  (see "File and line for every finding" above), so their recommendations can list the
  affected files. Recommendations that list affected files score higher for structure in the
  benchmark's usefulness measure. This is the only benchmark number that changed: detector
  precision, recall and F1, service discovery and explanation scores are the same on all four
  benchmarks, and the three public-project result files are identical. The `v0.1.0-research`
  results are kept unchanged; the change is recorded in
  [REPRODUCE.md](docs/research/REPRODUCE.md#later-versions).
- **The web app is for developers.** The Benchmarks, Evaluation and AI Baseline pages and the
  research documents are no longer in the app; they remain in the repository under
  [`docs/research/`](docs/research/). The in-app documentation has four groups: Get started,
  Scanning, Understand results and Automate.
- The web app works on phones and tablets, from 360 px wide.
- The large frontend entry file and stylesheet were split into components, with shared design
  tokens.
- Plainer wording in the app and guides ("demo data", "your MESA server", sentence case).
- The README was rewritten; the old phase-by-phase text is in [docs/HISTORY.md](docs/HISTORY.md).

### Fixed

- Chatty, cyclic and shared-database findings had no file or line in their evidence.
- The package did not import on Python 3.10.
- Opening Graph from the menu showed an empty graph.
- The first requests to a new database could fail with HTTP 500 when they arrived together.
- The scan summary repeated the same kind of finding ("a hard-coded service dependency, a
  hard-coded service dependency").

### Security

- API scans of local folders, archives and repository sources are limited to allowed scan
  roots, so a request cannot read other paths on the server.

## [0.1.0-research] - 2026-11-08

The research version. Its code, tests, benchmark definitions and result files are frozen under
the git tag `v0.1.0-research`, and every number in [REPRODUCE.md](docs/research/REPRODUCE.md)
refers to it. How it was built is described in [docs/HISTORY.md](docs/HISTORY.md).

[1.0.0]: https://github.com/ilmeedesilva/MESA/compare/v0.1.0-research...HEAD
[0.1.0-research]: https://github.com/ilmeedesilva/MESA/tree/v0.1.0-research
