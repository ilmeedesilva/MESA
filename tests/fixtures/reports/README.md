# Report test fixtures

- `*.input.json`: a gate result and the scan's findings, from `mesa ci` runs on small demo
  repositories (`PYTHONHASHSEED=0`).
- `*.md`, `*.sarif`, `*.annotations.txt`: the expected output for each input. After an
  intended change to a report, regenerate them with
  `MESA_UPDATE_GOLDEN=1 pytest tests/test_reporting.py` and review the diff.
- `sarif-schema-2.1.0.json`: the official SARIF 2.1.0 JSON schema from the OASIS SARIF TC
  repository (`oasis-tcs/sarif-spec`, `sarif-2.1/schema/sarif-schema-2.1.0.json`), used to
  validate MESA's SARIF output. Stored here so the tests do not need network access.
