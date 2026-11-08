# Reproduction environment

Recorded on 2026-11-08 when the research results were re-run from a fresh fetch (see
[`docs/research/REPRODUCE.md`](../../../docs/research/REPRODUCE.md)). All four benchmarks reproduced
the paper's detection and discovery numbers in this environment.

| Item | Value |
| --- | --- |
| Machine | Apple M1 (arm64), 8 GB RAM |
| OS | macOS 27.2 (build 26B123) |
| Python | 3.12.16 |
| pip | 26.3 |
| MESA | `mesa-analyzer` 0.1.0, installed editable (`pip install -e ".[dev]"`) |

The performance figures in the research report (Section 5.5) were measured on 2026-09-24 on the
same model of machine with **Python 3.13.9** and macOS 27.0.1. This re-run used Python
3.12.16. Detection and discovery results are identical across the two; timings were not
re-measured.

## Installed packages (`pip freeze`)

```text
annotated-doc==0.0.5
annotated-types==0.8.0
anthropic==2.5.0
anyio==4.16.0
certifi==2026.10.23
click==8.5.0
coverage==7.17.2
docstring_parser==0.18.0
fastapi==0.162.0
h11==0.16.0
httpcore==1.0.9
httpcore2==2.16.0
httptools==0.9.0
httpx==0.28.1
httpx2==2.16.0
idna==3.20
iniconfig==2.3.1
jiter==0.18.0
markdown-it-py==4.2.0
mdurl==0.1.2
neo4j==6.4.1
networkx==3.7
opentelemetry-api==1.45.2
packaging==26.3
pluggy==1.7.0
psycopg==3.3.8
psycopg-binary==3.3.8
pydantic==2.14.3
pydantic_core==2.50.4
Pygments==2.21.0
pytest==9.2.0
pytest-cov==7.1.0
python-dotenv==1.2.4
pytz==2026.6
PyYAML==6.0.3
rich==15.0.0
ruff==0.16.10
shellingham==1.5.4
sniffio==1.3.1
starlette==1.10.0
truststore==0.10.5
typer==0.27.3
typing-inspection==0.4.5
typing_extensions==4.16.0
uvicorn==0.54.0
uvloop==0.23.0
watchfiles==1.3.0
websockets==17.4
```
