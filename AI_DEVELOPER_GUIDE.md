# MESA — AI Developer Guide
## Complete Technical Specification for Building the Software from Scratch

**Project:** MESA: A Cross-Service Static Analysis Tool for Detecting Microservices Architectural Anti-Patterns  
**Author:** K I W DE Silva (Coventry Index: 16110094 | NIBM: COBSCCOMP24.2P-029)  
**Degree:** BSc Hons in Computing 2024.2 — Coventry University / NIBM  
**Document Purpose:** This document gives any AI assistant or developer enough context to build, extend, or debug MESA without any prior knowledge of the project. Every decision, every module, every algorithm, and every edge case is documented here.

---

## Table of Contents

1. [Project Context & Purpose](#1-project-context--purpose)
2. [Research Objectives and What "Done" Means](#2-research-objectives-and-what-done-means)
3. [Technology Stack](#3-technology-stack)
4. [Full Directory Structure](#4-full-directory-structure)
5. [Data Models — Every Field Explained](#5-data-models--every-field-explained)
6. [Module-by-Module Implementation Guide](#6-module-by-module-implementation-guide)
   - 6.1 CLI Entry Point
   - 6.2 Configuration System
   - 6.3 Repository Collectors
   - 6.4 Language Parsers
   - 6.5 Config File Parsers
   - 6.6 Dependency Graph Builder
   - 6.7 Anti-Pattern Detectors
   - 6.8 Reporters
   - 6.9 Evaluator
7. [Algorithm Specifications](#7-algorithm-specifications)
8. [Anti-Pattern Detection Rules (Exact Thresholds)](#8-anti-pattern-detection-rules-exact-thresholds)
9. [CLI Command Reference](#9-cli-command-reference)
10. [Configuration File Schema](#10-configuration-file-schema)
11. [Output Report Format](#11-output-report-format)
12. [Testing Strategy](#12-testing-strategy)
13. [Evaluation Framework](#13-evaluation-framework)
14. [Edge Cases and Known Limitations](#14-edge-cases-and-known-limitations)
15. [Benchmark Projects and Ground Truth](#15-benchmark-projects-and-ground-truth)
16. [Dependencies and Setup](#16-dependencies-and-setup)
17. [Build & Release](#17-build--release)

---

## 1. Project Context & Purpose

### What is MESA?

MESA is a **Python command-line tool** that performs **static analysis** across **multiple microservice source code repositories simultaneously**. It reads source code without executing it, constructs a graph of how services depend on each other, and then applies algorithms to detect three specific **architectural anti-patterns**:

1. **Chatty Services** — two services that call each other excessively (too many API calls between them).
2. **Cyclic Dependencies** — a loop where Service A depends on Service B, which depends on Service A (or longer chains: A→B→C→A).
3. **Shared Database Anti-Pattern** — multiple services connecting to the same database schema or table, which violates microservice isolation principles.

### Why Does This Tool Exist?

Existing tools like **SonarQube** analyze one service at a time. They can catch bugs, code smells, and single-service quality issues. However, they are **blind to cross-service problems** because they never look at two services together. MESA fills this exact gap.

The tool is a **research prototype** designed to:
- Prove that cross-service static analysis is feasible.
- Demonstrate measurable accuracy (precision, recall, F1-score) on benchmark projects.
- Produce an academic artifact that can be evaluated and extended.

### What MESA Does NOT Do

- It does NOT fix or refactor code automatically.
- It does NOT perform runtime or dynamic analysis.
- It does NOT analyze performance metrics, logs, or traces.
- It does NOT address security vulnerabilities.
- It does NOT support monolithic architectures.
- It does NOT provide a graphical user interface.
- It does NOT handle languages that are not in scope (see Section 3).

---

## 2. Research Objectives and What "Done" Means

Each objective maps to a concrete deliverable:

| Objective | What to Build | Done When |
|---|---|---|
| O1: Multi-repo static analysis framework | Core parser + graph builder that accepts N repos | Analysis runs on 2+ repos simultaneously |
| O2: Detection algorithms with metrics | Three detectors + evaluation framework | Precision, recall, F1 are measurable |
| O3: Comparative analysis vs SonarQube | Benchmark showing MESA finds what SonarQube misses | Results table in evaluation output |
| O4: Reproducible evaluation framework | Ground truth dataset + evaluation runner | Running `mesa evaluate` produces consistent numbers |
| O5: Curated dataset | A documented set of benchmark microservice projects | At least 3 public GitHub projects with known anti-patterns documented |

### Research Questions (RQs) and How Code Answers Them

- **RQ1** (design factors): Answered by the architecture — how `Collector → Parser → GraphBuilder` pipeline is structured to handle multiple repos.
- **RQ2** (graph algorithms): Answered by `detectors/cyclic_dependency.py` (DFS), `detectors/chatty_service.py` (edge weight counting), `detectors/shared_database.py` (string normalization + matching).
- **RQ3** (CLI tool): Answered by `cli.py` — the tool accepts repos as arguments and outputs a report.
- **RQ4** (accuracy measurement): Answered by `evaluator/metrics.py` + the benchmark runner.

---

## 3. Technology Stack

### Primary Language
- **Python 3.10+** (chosen for: rich AST library, networkx, click, GitPython — all well-supported)

### Key Libraries

| Library | Version | Purpose |
|---|---|---|
| `click` | >=8.1 | CLI argument parsing and command structure |
| `networkx` | >=3.1 | Graph data structure, DFS, cycle detection |
| `gitpython` | >=3.1 | Cloning and reading remote GitHub repositories |
| `pyyaml` | >=6.0 | Parsing YAML config files and docker-compose files |
| `ast` | stdlib | Python source code AST parsing (built-in) |
| `javalang` | >=0.13 | Java source code parsing |
| `esprima` | >=4.0 | JavaScript/Node.js source code parsing |
| `rich` | >=13.0 | Beautiful terminal output formatting |
| `tabulate` | >=0.9 | Table formatting for reports |
| `pytest` | >=7.0 | Unit and integration testing |
| `coverage` | >=7.0 | Test coverage measurement |
| `dataclasses` | stdlib | Data model definitions |
| `pathlib` | stdlib | Cross-platform file path handling |
| `re` | stdlib | Regular expressions for pattern matching |
| `json` | stdlib | JSON output format |
| `configparser` | stdlib | .env / .ini file parsing |
| `urllib.parse` | stdlib | URL parsing and normalization |
| `typing` | stdlib | Type hints throughout |

### What to NOT Use
- Do NOT use `subprocess` to run external analysis tools — MESA is pure static analysis.
- Do NOT use any runtime profiling libraries.
- Do NOT use GUI frameworks (tkinter, Qt, etc.).

---

## 4. Full Directory Structure

Every file listed here must exist. Comments explain the purpose of each file.

```
mesa/                                    ← Root of the repository
│
├── mesa/                                ← Main Python package
│   ├── __init__.py                      ← Package init; exposes version string
│   ├── cli.py                           ← Click-based CLI entry point (all commands)
│   ├── config.py                        ← Config loading: CLI args + mesa.yaml merger
│   ├── exceptions.py                    ← Custom exception classes
│   │
│   ├── collectors/                      ← Step 1: Obtain source code
│   │   ├── __init__.py
│   │   ├── base.py                      ← Abstract BaseCollector interface
│   │   ├── local_collector.py           ← Reads from local filesystem paths
│   │   └── git_collector.py             ← Clones/reads remote GitHub repos
│   │
│   ├── parsers/                         ← Step 2: Extract information from source code
│   │   ├── __init__.py
│   │   ├── base.py                      ← Abstract BaseParser interface
│   │   ├── python_parser.py             ← Python AST: endpoints + outbound calls + DB
│   │   ├── java_parser.py               ← Java: endpoints + RestTemplate/Feign + DB
│   │   ├── javascript_parser.py         ← JS/TS: Express routes + axios/fetch + DB
│   │   ├── config_parser.py             ← Master dispatcher — picks the right parser
│   │   ├── env_parser.py                ← Parses .env files for DB connection strings
│   │   ├── yaml_config_parser.py        ← Parses docker-compose.yml / k8s YAML / app.yaml
│   │   └── dockerfile_parser.py         ← Parses Dockerfile ENV and ARG for DB URLs
│   │
│   ├── models/                          ← Data models (dataclasses, no logic)
│   │   ├── __init__.py
│   │   ├── service.py                   ← Service dataclass
│   │   ├── endpoint.py                  ← APIEndpoint dataclass
│   │   ├── call.py                      ← ServiceCall dataclass
│   │   ├── database.py                  ← DatabaseConnection dataclass
│   │   ├── finding.py                   ← AntiPatternFinding dataclass (detection output)
│   │   └── graph.py                     ← ServiceDependencyGraph (wraps networkx)
│   │
│   ├── graph/                           ← Step 3: Build the dependency graph
│   │   ├── __init__.py
│   │   ├── builder.py                   ← Combines parsed data into the graph
│   │   ├── resolver.py                  ← Resolves raw URLs to service names
│   │   └── algorithms.py                ← Reusable graph algorithms (DFS, SCC, etc.)
│   │
│   ├── detectors/                       ← Step 4: Apply anti-pattern rules
│   │   ├── __init__.py
│   │   ├── base.py                      ← Abstract BaseDetector interface
│   │   ├── chatty_service.py            ← Chatty Services detector
│   │   ├── cyclic_dependency.py         ← Cyclic Dependencies detector
│   │   └── shared_database.py           ← Shared Database detector
│   │
│   ├── reporters/                       ← Step 5: Format and output results
│   │   ├── __init__.py
│   │   ├── base.py                      ← Abstract BaseReporter interface
│   │   ├── console_reporter.py          ← Rich-formatted terminal output
│   │   ├── text_reporter.py             ← Plain text file output
│   │   └── json_reporter.py             ← Structured JSON output
│   │
│   └── evaluator/                       ← Step 6: Measure accuracy
│       ├── __init__.py
│       ├── metrics.py                   ← Precision, recall, F1 calculation
│       ├── ground_truth.py              ← Load and validate ground truth labels
│       └── benchmark_runner.py          ← Run evaluation on benchmark projects
│
├── tests/                               ← All automated tests
│   ├── __init__.py
│   ├── fixtures/                        ← Synthetic microservice code for testing
│   │   ├── clean_services/              ← Services with NO anti-patterns
│   │   │   ├── service_a/
│   │   │   └── service_b/
│   │   ├── chatty_services/             ← Services WITH chatty pattern injected
│   │   │   ├── service_a/
│   │   │   └── service_b/
│   │   ├── cyclic_services/             ← Services WITH cyclic dependency injected
│   │   │   ├── service_a/
│   │   │   ├── service_b/
│   │   │   └── service_c/
│   │   └── shared_db_services/          ← Services WITH shared DB injected
│   │       ├── service_a/
│   │       └── service_b/
│   ├── unit/
│   │   ├── test_python_parser.py
│   │   ├── test_java_parser.py
│   │   ├── test_js_parser.py
│   │   ├── test_graph_builder.py
│   │   ├── test_graph_algorithms.py
│   │   ├── test_chatty_detector.py
│   │   ├── test_cyclic_detector.py
│   │   ├── test_shared_db_detector.py
│   │   └── test_metrics.py
│   └── integration/
│       ├── test_full_pipeline.py        ← End-to-end: repos → report
│       └── test_cli.py                  ← CLI invocation tests
│
├── benchmark/                           ← Evaluation datasets
│   ├── projects.yaml                    ← List of benchmark GitHub projects
│   └── ground_truth/
│       ├── online_boutique.yaml         ← Known anti-patterns in Google's Online Boutique
│       ├── sock_shop.yaml               ← Known anti-patterns in Weaveworks' Sock Shop
│       └── piggymetrics.yaml            ← Known anti-patterns in PiggyMetrics
│
├── docs/                                ← Documentation
│   ├── AI_DEVELOPER_GUIDE.md            ← This file
│   ├── USER_GUIDE.md
│   └── PRESENTATION_GUIDE.md
│
├── setup.py                             ← Package installation script
├── setup.cfg                            ← Package metadata
├── requirements.txt                     ← Pinned production dependencies
├── requirements-dev.txt                 ← Dev/test dependencies
├── mesa.yaml.example                    ← Example configuration file
├── .gitignore
└── README.md
```

---

## 5. Data Models — Every Field Explained

All models live in `mesa/models/`. They are pure Python dataclasses — no methods with side effects, no I/O. They are the data contracts between modules.

### 5.1 `models/service.py` — The `Service` Model

```python
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from .endpoint import APIEndpoint
from .call import ServiceCall
from .database import DatabaseConnection

@dataclass
class Service:
    name: str
    # Human-readable service name. Derived from directory name unless overridden in config.
    # Example: "user-service", "order-service"

    path: str
    # Absolute path to the service's root directory on the local filesystem.
    # Example: "/tmp/mesa_repos/user-service"

    language: str
    # Detected or specified programming language.
    # Values: "python", "java", "javascript", "unknown"

    endpoints: List[APIEndpoint] = field(default_factory=list)
    # All HTTP/REST API endpoints this service EXPOSES (i.e., routes it defines).
    # Populated by the language parser.

    outbound_calls: List[ServiceCall] = field(default_factory=list)
    # All outbound HTTP calls this service MAKES to other services.
    # Populated by the language parser.

    databases: List[DatabaseConnection] = field(default_factory=list)
    # All database connections this service uses.
    # Populated by env_parser + yaml_config_parser + language parser.

    metadata: Dict[str, Any] = field(default_factory=dict)
    # Catch-all for extra info: docker image name, port, environment name, etc.
    # Not used in detection logic. Used for reporting context.
```

### 5.2 `models/endpoint.py` — The `APIEndpoint` Model

```python
@dataclass
class APIEndpoint:
    service_name: str
    # The service that exposes this endpoint.

    method: str
    # HTTP method: "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"
    # Uppercase always.

    path: str
    # URL path template. Example: "/api/users/{id}" or "/orders"
    # Path parameters use {param} or :param notation (normalize to {param}).

    file_path: str
    # Absolute path to the file where this endpoint is defined.

    line_number: int
    # Line number within the file where the route decorator/annotation begins.

    handler_name: Optional[str] = None
    # The function/method name that handles this endpoint, if determinable.
    # Example: "get_user", "createOrder"
```

### 5.3 `models/call.py` — The `ServiceCall` Model

```python
@dataclass
class ServiceCall:
    caller_service: str
    # Name of the service making this call.

    raw_url: str
    # The URL as it appears in the source code.
    # Example: "http://user-service:8080/api/users/", "os.getenv('USER_SVC_URL') + '/users'"
    # May be a string literal, environment variable reference, or concatenation.

    resolved_service: Optional[str] = None
    # The name of the target service after URL resolution.
    # Populated by graph/resolver.py.
    # None if the target cannot be determined.

    resolved_path: Optional[str] = None
    # The resolved endpoint path being called.
    # Example: "/api/users"

    http_method: str = "GET"
    # HTTP method of the outbound call. Default GET if not determinable.

    file_path: str = ""
    # Absolute path to the file where this call is made.

    line_number: int = 0
    # Line number of the call.

    call_site_function: Optional[str] = None
    # The function name containing this call, if determinable.
```

### 5.4 `models/database.py` — The `DatabaseConnection` Model

```python
@dataclass
class DatabaseConnection:
    service_name: str
    # The service that owns this connection.

    raw_connection_string: str
    # The connection string exactly as found in the source.
    # Example: "postgresql://user:pass@db-host:5432/mydb"
    # May be an env var reference like "${DATABASE_URL}"

    db_type: str
    # Database type. Values: "postgresql", "mysql", "mongodb", "redis",
    # "sqlite", "mssql", "oracle", "unknown"

    host: Optional[str] = None
    # Hostname or IP of the database server.
    # Example: "localhost", "db-host", "postgres"

    port: Optional[int] = None
    # Port number.
    # Defaults: PostgreSQL=5432, MySQL=3306, MongoDB=27017, Redis=6379

    database_name: Optional[str] = None
    # Name of the database/schema.
    # Example: "mydb", "users_db"

    schema_name: Optional[str] = None
    # Schema name within the database, if specified.

    table_names: List[str] = field(default_factory=list)
    # Table names referenced in ORM models or SQL queries, if detectable.

    source_file: str = ""
    # File path where this connection string was found.

    line_number: int = 0
    # Line number in source_file.
```

### 5.5 `models/finding.py` — The `AntiPatternFinding` Model

This is the OUTPUT of each detector.

```python
from enum import Enum

class Severity(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AntiPatternType(Enum):
    CHATTY_SERVICE = "CHATTY_SERVICE"
    CYCLIC_DEPENDENCY = "CYCLIC_DEPENDENCY"
    SHARED_DATABASE = "SHARED_DATABASE"

@dataclass
class AntiPatternFinding:
    pattern_type: AntiPatternType
    # Which anti-pattern was detected.

    severity: Severity
    # How serious is this finding.

    services_involved: List[str]
    # List of service names involved in this finding.
    # Chatty: ["service-a", "service-b"]
    # Cyclic: ["service-a", "service-b", "service-c"] (in cycle order)
    # Shared DB: ["service-a", "service-b"]

    description: str
    # Human-readable description of what was found.
    # Example: "Services 'order-service' and 'user-service' have 7 API calls between them,
    #           exceeding the threshold of 3. This indicates excessive coupling."

    evidence: List[Dict[str, Any]]
    # Concrete evidence: file paths, line numbers, call counts, connection strings.
    # Structure varies by pattern type (see Section 8 for exact format).

    recommendation: str
    # What to do to fix this.
    # Example: "Consider aggregating these calls into a single composite API call or
    #           introducing an event-driven communication pattern."

    finding_id: str = ""
    # Auto-generated unique ID for this finding.
    # Format: "MESA-{TYPE_CODE}-{SEQUENTIAL_NUMBER}"
    # Example: "MESA-CHAT-001", "MESA-CYCL-001", "MESA-SHDB-001"
```

### 5.6 `models/graph.py` — The `ServiceDependencyGraph` Model

```python
import networkx as nx

@dataclass
class ServiceDependencyGraph:
    # This class wraps a networkx MultiDiGraph.
    # MultiDiGraph = directed graph that allows multiple edges between the same pair of nodes.
    # This is needed because service A might call service B at many different endpoints.

    _graph: nx.MultiDiGraph = field(default_factory=nx.MultiDiGraph)
    # The underlying networkx graph. Access via self.graph property.

    services: Dict[str, Service] = field(default_factory=dict)
    # service_name → Service object registry

    # Node attributes stored in the graph:
    #   node["service"] = Service object
    #   node["language"] = str
    #
    # Edge attributes stored in the graph:
    #   edge["type"] = "api_call" | "shared_db"
    #   edge["call"] = ServiceCall object (for api_call edges)
    #   edge["db"] = DatabaseConnection object (for shared_db edges)
    #   edge["weight"] = int (number of calls for api_call edges)
```

---

## 6. Module-by-Module Implementation Guide

### 6.1 `mesa/cli.py` — CLI Entry Point

This is the main entry point. Uses the `click` library.

**Structure:**

```python
import click
from .config import load_config
from .collectors.local_collector import LocalCollector
from .collectors.git_collector import GitCollector
from .parsers.config_parser import dispatch_parser
from .graph.builder import GraphBuilder
from .detectors.chatty_service import ChattyServiceDetector
from .detectors.cyclic_dependency import CyclicDependencyDetector
from .detectors.shared_database import SharedDatabaseDetector
from .reporters.console_reporter import ConsoleReporter
from .reporters.json_reporter import JsonReporter
from .reporters.text_reporter import TextReporter
from .evaluator.benchmark_runner import BenchmarkRunner

@click.group()
@click.version_option(version="1.0.0", prog_name="MESA")
def cli():
    """MESA: Cross-Service Static Analysis Tool for Microservices Anti-Patterns."""
    pass

@cli.command()
@click.option("--repo", "-r", multiple=True, help="Path to local service dir OR GitHub URL. Can be repeated.")
@click.option("--config", "-c", type=click.Path(exists=True), help="Path to mesa.yaml config file.")
@click.option("--output", "-o", type=click.Path(), help="Output file path. Prints to console if omitted.")
@click.option("--format", "-f", "output_format", type=click.Choice(["text", "json"]), default="text")
@click.option("--threshold-chatty", type=int, default=3, help="Min call count to flag as chatty. Default: 3.")
@click.option("--no-chatty", is_flag=True, default=False)
@click.option("--no-cyclic", is_flag=True, default=False)
@click.option("--no-shared-db", is_flag=True, default=False)
@click.option("--verbose", "-v", is_flag=True, default=False)
def analyze(repo, config, output, output_format, threshold_chatty, no_chatty, no_cyclic, no_shared_db, verbose):
    """Analyze microservice repos for architectural anti-patterns."""
    # Full implementation in Section 6.1 below

@cli.command()
@click.option("--projects", "-p", type=click.Path(exists=True), default="benchmark/projects.yaml")
@click.option("--ground-truth", "-g", type=click.Path(exists=True), default="benchmark/ground_truth/")
@click.option("--output", "-o", type=click.Path(), default="evaluation_results.json")
def evaluate(projects, ground_truth, output):
    """Run evaluation on benchmark projects and compute precision/recall/F1."""
    pass

if __name__ == "__main__":
    cli()
```

**The `analyze` command pipeline (in order):**

1. Load config (merge CLI args + mesa.yaml if provided).
2. For each repo argument: determine if it's a local path or a GitHub URL.
3. Collect service directories (LocalCollector or GitCollector).
4. For each collected service directory: run the appropriate language parser.
5. Also run env_parser and yaml_config_parser on each service directory.
6. Pass all parsed Service objects to GraphBuilder.
7. Run enabled detectors on the resulting graph.
8. Collect all AntiPatternFinding objects.
9. Feed to the appropriate Reporter.
10. Write output to file or console.

**GitHub URL detection logic:**
```python
def is_github_url(s: str) -> bool:
    return s.startswith("https://github.com/") or s.startswith("git@github.com:")
```

**Language auto-detection (used if not specified in config):**
```python
def detect_language(service_path: str) -> str:
    path = Path(service_path)
    if list(path.glob("**/*.py")):
        return "python"
    if list(path.glob("**/*.java")) or (path / "pom.xml").exists() or (path / "build.gradle").exists():
        return "java"
    if list(path.glob("**/*.js")) or list(path.glob("**/*.ts")) or (path / "package.json").exists():
        return "javascript"
    return "unknown"
```

---

### 6.2 `mesa/config.py` — Configuration System

Merges configuration from two sources (CLI args have priority over mesa.yaml):

```python
@dataclass
class MesaConfig:
    repositories: List[Dict]          # [{path or url, name, language}]
    chatty_enabled: bool = True
    chatty_threshold: int = 3         # Min edge weight to flag as chatty
    cyclic_enabled: bool = True
    cyclic_min_length: int = 2        # Minimum cycle length to report
    shared_db_enabled: bool = True
    output_format: str = "text"       # "text" | "json"
    output_file: Optional[str] = None
    verbose: bool = False
    temp_dir: str = "/tmp/mesa_repos" # Where to clone remote repos
```

**Loading logic:**

```python
def load_config(cli_args: dict, config_file: Optional[str] = None) -> MesaConfig:
    base = MesaConfig(repositories=[])
    if config_file:
        with open(config_file) as f:
            yaml_data = yaml.safe_load(f)
        # Apply yaml_data to base (yaml has lower priority)
    # CLI args override yaml values
    return base
```

---

### 6.3 `mesa/collectors/` — Repository Collectors

**`base.py`:**

```python
from abc import ABC, abstractmethod
from typing import List
from ..models.service import Service

class BaseCollector(ABC):
    @abstractmethod
    def collect(self, source: str, name: Optional[str] = None) -> str:
        """
        Given a source (path or URL), returns the local filesystem path
        to the service's root directory.
        """
        pass
```

**`local_collector.py`:**

```python
class LocalCollector(BaseCollector):
    def collect(self, source: str, name: Optional[str] = None) -> str:
        path = Path(source).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Service path does not exist: {source}")
        if not path.is_dir():
            raise NotADirectoryError(f"Expected a directory: {source}")
        return str(path)
```

**`git_collector.py`:**

```python
import git
import tempfile
import shutil

class GitCollector(BaseCollector):
    def __init__(self, temp_dir: str = "/tmp/mesa_repos"):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def collect(self, source: str, name: Optional[str] = None) -> str:
        """
        Clones the repo to a temp directory and returns the local path.
        If the repo is already cloned (same URL), reuse it.
        Uses shallow clone (depth=1) to minimize download size.
        """
        repo_name = name or self._url_to_name(source)
        target = self.temp_dir / repo_name
        if target.exists():
            # Pull latest changes
            repo = git.Repo(str(target))
            repo.remotes.origin.pull()
        else:
            git.Repo.clone_from(source, str(target), depth=1)
        return str(target)

    def _url_to_name(self, url: str) -> str:
        # Extract repo name from URL
        # "https://github.com/org/user-service" → "user-service"
        return url.rstrip("/").split("/")[-1].replace(".git", "")
```

---

### 6.4 `mesa/parsers/` — Language Parsers

Each parser's job: given a service directory path, return a `Service` object populated with endpoints, outbound calls, and (where detectable in source) database connections.

#### 6.4.1 `python_parser.py` — Python AST Parser

This is the most important parser and is the reference implementation. It uses Python's built-in `ast` module.

**What it detects:**

**ENDPOINTS (routes the service exposes):**

Supported frameworks:
- **Flask:** `@app.route("/path", methods=["GET"])` and `@blueprint.route(...)`
- **FastAPI:** `@app.get("/path")`, `@app.post("/path")`, `@router.get("/path")` etc.
- **Django:** `urlpatterns = [path("endpoint/", view)]` in `urls.py`

Detection logic for Flask/FastAPI (AST approach):
```python
import ast

def _find_endpoints_in_file(self, filepath: str, source: str) -> List[APIEndpoint]:
    tree = ast.parse(source)
    endpoints = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            for decorator in node.decorator_list:
                # Check if decorator matches route pattern
                if self._is_route_decorator(decorator):
                    path, methods = self._extract_route_info(decorator)
                    for method in methods:
                        endpoints.append(APIEndpoint(
                            service_name=self.service_name,
                            method=method.upper(),
                            path=path,
                            file_path=filepath,
                            line_number=node.lineno,
                            handler_name=node.name
                        ))
    return endpoints

def _is_route_decorator(self, node) -> bool:
    # Matches: @app.route, @router.get, @router.post, etc.
    # ast.Attribute: node.value.id in ("app", "router", "blueprint", ...)
    # and node.attr in ("route", "get", "post", "put", "delete", "patch")
    http_methods = {"route", "get", "post", "put", "delete", "patch", "head", "options"}
    if isinstance(node, ast.Call):
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr in http_methods:
            return True
    return False

def _extract_route_info(self, decorator_node) -> Tuple[str, List[str]]:
    # Returns (path_string, [list_of_http_methods])
    # For @app.get("/path") → ("/path", ["GET"])
    # For @app.route("/path", methods=["GET","POST"]) → ("/path", ["GET","POST"])
    func = decorator_node.func
    method_name = func.attr  # "get", "post", "route", etc.
    
    # Extract path (first positional argument)
    path = "/"
    if decorator_node.args:
        arg = decorator_node.args[0]
        if isinstance(arg, ast.Constant):
            path = arg.value
    
    # Determine methods
    if method_name == "route":
        methods = ["GET"]  # Default for Flask route
        for keyword in decorator_node.keywords:
            if keyword.arg == "methods":
                methods = [elt.value for elt in keyword.value.elts
                          if isinstance(elt, ast.Constant)]
    else:
        methods = [method_name.upper()]
    
    return path, methods
```

**OUTBOUND CALLS (HTTP calls this service makes):**

Look for:
- `requests.get(url)`, `requests.post(url)`, etc.
- `httpx.get(url)`, `httpx.AsyncClient().get(url)`
- `aiohttp.ClientSession().get(url)`
- `urllib.request.urlopen(url)`

Detection logic:
```python
def _find_outbound_calls_in_file(self, filepath: str, source: str) -> List[ServiceCall]:
    tree = ast.parse(source)
    calls = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if self._is_http_call(node):
                url = self._extract_url(node)
                method = self._extract_http_method(node)
                calls.append(ServiceCall(
                    caller_service=self.service_name,
                    raw_url=url,
                    http_method=method,
                    file_path=filepath,
                    line_number=node.lineno
                ))
    return calls

def _is_http_call(self, node: ast.Call) -> bool:
    # Check if this is requests.get/post/put/delete/patch/request
    # or httpx.get/post etc.
    http_libs = {"requests", "httpx", "urllib"}
    http_methods = {"get", "post", "put", "delete", "patch", "request", "head"}
    if isinstance(node.func, ast.Attribute):
        if node.func.attr in http_methods:
            if isinstance(node.func.value, ast.Name):
                return node.func.value.id in http_libs
            # Handle chained: httpx.AsyncClient().get(url)
            if isinstance(node.func.value, ast.Call):
                return True  # Be liberal here; URL extraction will validate
    return False

def _extract_url(self, call_node: ast.Call) -> str:
    # Try to get the first positional argument as a string
    if call_node.args:
        arg = call_node.args[0]
        if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
            return arg.value
        # Handle f-strings, string concatenation, variable references
        return ast.unparse(arg)  # Return source representation
    # Check keyword argument 'url='
    for kw in call_node.keywords:
        if kw.arg == "url":
            if isinstance(kw.value, ast.Constant):
                return kw.value.value
            return ast.unparse(kw.value)
    return "UNKNOWN_URL"
```

**DATABASE CONNECTIONS (in Python source):**

Look for:
- `psycopg2.connect("postgresql://...")`
- `create_engine("postgresql://...")`
- `MongoClient("mongodb://...")`
- `redis.Redis(host=..., port=..., db=...)`
- `pymysql.connect(host=..., db=...)`

Also check `DATABASE_URL = os.getenv("DATABASE_URL")` references (but the actual value comes from env_parser).

#### 6.4.2 `java_parser.py` — Java Parser

Uses `javalang` library (or regex-based fallback for robustness).

**ENDPOINTS:**

Detect Spring Boot annotations:
- `@GetMapping("/path")`, `@PostMapping("/path")`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
- `@RequestMapping(value="/path", method=RequestMethod.GET)`
- Class-level `@RequestMapping("/prefix")` must be combined with method-level annotations

**Strategy:** Regex-based scan is acceptable since full Java AST parsing is complex.

```python
import re

SPRING_METHOD_ANNOTATIONS = {
    "GetMapping": "GET",
    "PostMapping": "POST",
    "PutMapping": "PUT",
    "DeleteMapping": "DELETE",
    "PatchMapping": "PATCH",
}

def _scan_file_for_endpoints(self, filepath: str, content: str):
    # Find class-level prefix
    class_prefix = ""
    class_mapping = re.search(r'@RequestMapping\("([^"]+)"\)', content)
    if class_mapping:
        class_prefix = class_mapping.group(1)
    
    # Find method-level mappings
    for annotation, method in SPRING_METHOD_ANNOTATIONS.items():
        pattern = rf'@{annotation}\("([^"]+)"\)'
        for match in re.finditer(pattern, content):
            path = class_prefix + match.group(1)
            line = content[:match.start()].count('\n') + 1
            # yield APIEndpoint(...)
```

**OUTBOUND CALLS:**

Detect Spring Boot HTTP clients:
- `RestTemplate`: `restTemplate.getForObject(url, ...)`, `restTemplate.postForObject(url, ...)`
- `WebClient`: `webClient.get().uri(url)`
- `FeignClient`: `@FeignClient(name="user-service", url="...")` — this is both declaration and call

```python
REST_TEMPLATE_PATTERN = re.compile(
    r'restTemplate\.(get|post|put|delete|exchange|getForObject|postForObject|'
    r'putForObject|getForEntity|postForEntity)\('
    r'\s*"([^"]+)"'
)
WEB_CLIENT_PATTERN = re.compile(r'\.uri\("([^"]+)"\)')
FEIGN_CLIENT_PATTERN = re.compile(r'@FeignClient\(.*?url\s*=\s*"([^"]+)"')
```

#### 6.4.3 `javascript_parser.py` — JavaScript/TypeScript Parser

Uses `esprima` for pure JS, or regex for TypeScript.

**ENDPOINTS — Express.js:**

```python
EXPRESS_PATTERNS = [
    re.compile(r'(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]'),
    re.compile(r'@(Get|Post|Put|Delete|Patch)\s*\(\s*[\'"]([^\'"]+)[\'"]'),  # NestJS
]
```

**OUTBOUND CALLS:**

```python
HTTP_CALL_PATTERNS = [
    re.compile(r'axios\.(get|post|put|delete|patch)\s*\(\s*[\'"`]([^\'"` ]+)[\'"`]'),
    re.compile(r'fetch\s*\(\s*[\'"`]([^\'"` ]+)[\'"`]'),
    re.compile(r'http\.(get|post|request)\s*\('),
    re.compile(r'got\.(get|post|put|delete)\s*\(\s*[\'"`]([^\'"` ]+)[\'"`]'),
]
```

---

### 6.5 Config File Parsers

#### `env_parser.py`

Parses `.env` files for database connection strings.

Files to look for (in order of preference):
- `.env`
- `.env.local`
- `.env.production`
- `application.properties` (Java Spring Boot)
- `application.yml` (Java Spring Boot)

```python
DB_URL_KEYS = [
    "DATABASE_URL", "DB_URL", "POSTGRES_URL", "MYSQL_URL",
    "MONGO_URL", "MONGODB_URI", "REDIS_URL", "DATABASE_URI",
    "DB_HOST", "DB_NAME", "DB_DATABASE", "SPRING_DATASOURCE_URL",
]

def parse_env_file(filepath: str, service_name: str) -> List[DatabaseConnection]:
    connections = []
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip().upper()
            value = value.strip().strip('"').strip("'")
            if key in DB_URL_KEYS and value:
                conn = parse_connection_string(value, service_name, filepath)
                if conn:
                    connections.append(conn)
    return connections
```

**`parse_connection_string` function:**

This is critical. It must parse strings like:
- `postgresql://user:password@hostname:5432/dbname`
- `mongodb://user:pass@host:27017/mydb`
- `mysql+pymysql://user:pass@host/dbname`
- `redis://hostname:6379/0`
- `jdbc:postgresql://host:5432/dbname`

```python
from urllib.parse import urlparse

def parse_connection_string(conn_str: str, service_name: str, source_file: str) -> Optional[DatabaseConnection]:
    # Handle JDBC prefix
    conn_str_clean = conn_str.replace("jdbc:", "")
    
    try:
        parsed = urlparse(conn_str_clean)
    except Exception:
        return None
    
    db_type_map = {
        "postgresql": "postgresql", "postgres": "postgresql",
        "mysql": "mysql", "mysql+pymysql": "mysql",
        "mongodb": "mongodb", "redis": "redis", "sqlite": "sqlite",
    }
    
    db_type = db_type_map.get(parsed.scheme.lower(), "unknown")
    host = parsed.hostname
    port = parsed.port or DEFAULT_PORTS.get(db_type)
    # Database name is the first path component
    db_name = parsed.path.lstrip("/").split("/")[0] if parsed.path else None
    
    return DatabaseConnection(
        service_name=service_name,
        raw_connection_string=conn_str,
        db_type=db_type,
        host=host,
        port=port,
        database_name=db_name,
        source_file=source_file,
    )
```

#### `yaml_config_parser.py`

Parses `docker-compose.yml` and `application.yml`.

**For docker-compose.yml, find:**
```yaml
services:
  user-service:
    environment:
      - DATABASE_URL=postgresql://db:5432/users
      - POSTGRES_DB=users
    depends_on:
      - postgres
```

Extract environment variables and treat them like .env file entries.

**For application.yml (Spring Boot):**
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: user
```
Parse `spring.datasource.url` as a connection string.

---

### 6.6 `mesa/graph/builder.py` — Dependency Graph Builder

This is Step 3 of the pipeline. Takes a list of `Service` objects and builds a `ServiceDependencyGraph`.

```python
from ..models.graph import ServiceDependencyGraph
from .resolver import URLResolver

class GraphBuilder:
    def __init__(self, services: List[Service]):
        self.services = services
        self.graph = ServiceDependencyGraph()
        self.resolver = URLResolver(services)

    def build(self) -> ServiceDependencyGraph:
        # 1. Add all services as nodes
        for service in self.services:
            self.graph.add_service_node(service)

        # 2. Resolve and add API call edges
        for service in self.services:
            for call in service.outbound_calls:
                target = self.resolver.resolve(call.raw_url)
                if target and target != service.name:
                    call.resolved_service = target
                    self.graph.add_api_call_edge(service.name, target, call)

        # 3. Add shared database edges
        self._add_shared_db_edges()

        return self.graph

    def _add_shared_db_edges(self):
        # Group database connections by normalized connection key
        # Two connections are "the same" if they share host + database_name
        from itertools import combinations
        db_groups: Dict[str, List[DatabaseConnection]] = {}
        for service in self.services:
            for db in service.databases:
                key = self._normalize_db_key(db)
                if key not in db_groups:
                    db_groups[key] = []
                db_groups[key].append(db)
        
        for key, connections in db_groups.items():
            if len(connections) >= 2:
                # Mark all pairs of services sharing this DB
                for conn_a, conn_b in combinations(connections, 2):
                    if conn_a.service_name != conn_b.service_name:
                        self.graph.add_shared_db_edge(
                            conn_a.service_name, conn_b.service_name,
                            conn_a, conn_b
                        )

    def _normalize_db_key(self, db: DatabaseConnection) -> str:
        # Create a canonical key for comparing database connections.
        # Ignore username, password, port variations for same-host databases.
        host = (db.host or "localhost").lower()
        db_name = (db.database_name or "").lower()
        db_type = db.db_type.lower()
        return f"{db_type}://{host}/{db_name}"
```

#### `mesa/graph/resolver.py` — URL Resolver

The hardest part of the project. Given a raw URL string from source code, determine which service it refers to.

**Resolution strategies (try in order):**

1. **Direct hostname match:** If URL contains a hostname that matches a known service name exactly.
   - `http://user-service:8080/api/users` → hostname is `user-service` → matches service named `user-service`.

2. **Environment variable pattern:** If URL is like `${USER_SERVICE_URL}/path` or `os.getenv("USER_SERVICE_URL")`, extract the variable name and match it to known services.
   - Pattern: `USER_SERVICE_URL` → strip `_URL`/`_HOST`/`_BASE_URL` suffix → `USER_SERVICE` → normalize → `user-service`.

3. **String constant with service name fragment:** If the URL is a string literal that contains a known service name as a substring.
   - `"http://localhost:8081/api/orders"` — check if port 8081 is registered to a service (from docker-compose port mappings).

4. **Fallback:** If none of the above works, `resolved_service = None`. Log a warning.

```python
class URLResolver:
    def __init__(self, services: List[Service]):
        self.services = {s.name: s for s in services}
        self._build_lookup_tables()

    def _build_lookup_tables(self):
        # Build: hostname → service_name
        self.host_to_service: Dict[str, str] = {}
        for name, service in self.services.items():
            # Service name itself as hostname (Docker network convention)
            normalized = name.lower().replace("_", "-")
            self.host_to_service[normalized] = name
            self.host_to_service[name.lower()] = name
            # Also register from metadata (docker service name, k8s service name)
        
        # Build: env_var_name → service_name
        self.env_var_to_service: Dict[str, str] = {}
        for name in self.services:
            # "user-service" → possible env vars: USER_SERVICE_URL, USER_SVC_URL, etc.
            normalized = name.upper().replace("-", "_")
            for suffix in ["_URL", "_HOST", "_BASE_URL", "_SERVICE_URL", ""]:
                self.env_var_to_service[normalized + suffix] = name

    def resolve(self, raw_url: str) -> Optional[str]:
        if not raw_url or raw_url == "UNKNOWN_URL":
            return None
        
        # Strategy 1: Parse hostname from URL literal
        try:
            from urllib.parse import urlparse
            parsed = urlparse(raw_url)
            if parsed.hostname:
                hostname = parsed.hostname.lower()
                if hostname in self.host_to_service:
                    return self.host_to_service[hostname]
        except Exception:
            pass
        
        # Strategy 2: Environment variable reference
        env_var_pattern = re.compile(r'\$\{([^}]+)\}|os\.getenv\([\'"]([^\'"]+)[\'"]\)')
        match = env_var_pattern.search(raw_url)
        if match:
            var_name = (match.group(1) or match.group(2)).upper()
            if var_name in self.env_var_to_service:
                return self.env_var_to_service[var_name]
        
        # Strategy 3: Service name substring match in URL
        for service_name in self.services:
            normalized = service_name.lower().replace("_", "-")
            if normalized in raw_url.lower():
                return service_name
        
        return None
```

---

### 6.7 `mesa/detectors/` — Anti-Pattern Detectors

#### `base.py`

```python
from abc import ABC, abstractmethod
from ..models.finding import AntiPatternFinding
from ..models.graph import ServiceDependencyGraph

class BaseDetector(ABC):
    @abstractmethod
    def detect(self, graph: ServiceDependencyGraph) -> List[AntiPatternFinding]:
        """Run detection and return all findings."""
        pass
```

#### `chatty_service.py` — Chatty Services Detector

**Definition:** Two services are "chatty" when the number of distinct API call sites from service A to service B (plus B to A) exceeds a configurable threshold.

**Algorithm:**

```python
class ChattyServiceDetector(BaseDetector):
    def __init__(self, threshold: int = 3):
        self.threshold = threshold  # Default: 3 call edges = flag as chatty

    def detect(self, graph: ServiceDependencyGraph) -> List[AntiPatternFinding]:
        findings = []
        g = graph.graph
        
        # For each pair of services (directed: A→B and B→A counted separately)
        # Count edges between them
        pair_call_counts: Dict[Tuple[str, str], List[ServiceCall]] = {}
        
        for u, v, data in g.edges(data=True):
            if data.get("type") == "api_call":
                key = (u, v)
                if key not in pair_call_counts:
                    pair_call_counts[key] = []
                pair_call_counts[key].append(data["call"])
        
        for (caller, callee), calls in pair_call_counts.items():
            count = len(calls)
            if count >= self.threshold:
                severity = self._compute_severity(count)
                findings.append(AntiPatternFinding(
                    pattern_type=AntiPatternType.CHATTY_SERVICE,
                    severity=severity,
                    services_involved=[caller, callee],
                    description=(
                        f"Service '{caller}' makes {count} distinct API call(s) to "
                        f"'{callee}', exceeding the threshold of {self.threshold}. "
                        f"This level of inter-service communication indicates tight "
                        f"coupling and potential performance degradation."
                    ),
                    evidence=[
                        {
                            "caller": caller,
                            "callee": callee,
                            "call_count": count,
                            "calls": [
                                {
                                    "url": c.raw_url,
                                    "method": c.http_method,
                                    "file": c.file_path,
                                    "line": c.line_number
                                }
                                for c in calls
                            ]
                        }
                    ],
                    recommendation=(
                        "Consider: (1) Consolidating multiple API calls into a single "
                        "composite endpoint, (2) Introducing a message queue or event "
                        "bus to decouple the services, (3) Evaluating whether the "
                        f"services '{caller}' and '{callee}' should be merged."
                    )
                ))
        
        return findings

    def _compute_severity(self, count: int) -> Severity:
        if count >= 10:
            return Severity.HIGH
        elif count >= 6:
            return Severity.MEDIUM
        else:
            return Severity.LOW
```

#### `cyclic_dependency.py` — Cyclic Dependencies Detector

**Definition:** A cycle exists when following API call dependencies forms a closed loop. E.g., A calls B, B calls C, C calls A.

**Algorithm:** Uses networkx `simple_cycles()` which implements Johnson's algorithm (O((V+E)(C+1)) where C is number of cycles).

```python
import networkx as nx

class CyclicDependencyDetector(BaseDetector):
    def __init__(self, min_cycle_length: int = 2):
        self.min_cycle_length = min_cycle_length  # Minimum services in a cycle

    def detect(self, graph: ServiceDependencyGraph) -> List[AntiPatternFinding]:
        findings = []
        g = graph.graph
        
        # Build a simple directed graph (not multigraph) for cycle detection
        # Only include api_call edges (not shared_db edges)
        call_graph = nx.DiGraph()
        for u, v, data in g.edges(data=True):
            if data.get("type") == "api_call":
                call_graph.add_edge(u, v)
        
        # Find all simple cycles
        all_cycles = list(nx.simple_cycles(call_graph))
        
        # Deduplicate cycles (rotate to canonical form)
        unique_cycles = self._deduplicate_cycles(all_cycles)
        
        for cycle in unique_cycles:
            if len(cycle) >= self.min_cycle_length:
                severity = self._compute_severity(len(cycle))
                cycle_str = " → ".join(cycle) + f" → {cycle[0]}"
                
                findings.append(AntiPatternFinding(
                    pattern_type=AntiPatternType.CYCLIC_DEPENDENCY,
                    severity=severity,
                    services_involved=cycle,
                    description=(
                        f"Cyclic dependency detected: {cycle_str}. "
                        f"This {len(cycle)}-service cycle creates tight coupling "
                        f"and can cause deployment ordering issues, cascading failures, "
                        f"and infinite loops if not handled carefully."
                    ),
                    evidence=[
                        {
                            "cycle": cycle,
                            "cycle_length": len(cycle),
                            "cycle_string": cycle_str,
                        }
                    ],
                    recommendation=(
                        "Break the cycle by: (1) Introducing an event-driven approach "
                        "where one service publishes events instead of calling back, "
                        "(2) Extracting shared logic into a new service, "
                        "(3) Reversing the direction of one dependency."
                    )
                ))
        
        return findings

    def _deduplicate_cycles(self, cycles: List[List[str]]) -> List[List[str]]:
        seen = set()
        unique = []
        for cycle in cycles:
            # Canonical form: sort to find rotation minimum
            canonical = tuple(sorted(set(cycle)))
            if canonical not in seen:
                seen.add(canonical)
                unique.append(cycle)
        return unique

    def _compute_severity(self, cycle_length: int) -> Severity:
        if cycle_length == 2:
            return Severity.CRITICAL  # Direct bidirectional dependency — worst case
        elif cycle_length == 3:
            return Severity.HIGH
        else:
            return Severity.MEDIUM    # Long cycles are still bad but less immediate
```

#### `shared_database.py` — Shared Database Detector

**Definition:** Two or more services connect to the same database (same host + same database name). This violates the database-per-service principle.

```python
class SharedDatabaseDetector(BaseDetector):
    def detect(self, graph: ServiceDependencyGraph) -> List[AntiPatternFinding]:
        findings = []
        g = graph.graph
        
        # Collect all shared_db edges
        # (These were pre-computed by the GraphBuilder)
        shared_db_pairs: Dict[str, List[Tuple]] = {}
        
        for u, v, data in g.edges(data=True):
            if data.get("type") == "shared_db":
                db_key = self._get_db_key(data.get("db_a"))
                if db_key not in shared_db_pairs:
                    shared_db_pairs[db_key] = []
                shared_db_pairs[db_key].append((u, v, data))
        
        for db_key, pairs in shared_db_pairs.items():
            # Collect all unique services involved
            services = list(set([p[0] for p in pairs] + [p[1] for p in pairs]))
            severity = Severity.CRITICAL if len(services) == 2 else Severity.HIGH
            
            # Build evidence
            evidence_items = []
            for u, v, data in pairs:
                db_a = data.get("db_a")
                db_b = data.get("db_b")
                evidence_items.append({
                    "service_a": u,
                    "service_b": v,
                    "database": db_key,
                    "connection_a": {
                        "file": db_a.source_file if db_a else "",
                        "raw": db_a.raw_connection_string if db_a else ""
                    },
                    "connection_b": {
                        "file": db_b.source_file if db_b else "",
                        "raw": db_b.raw_connection_string if db_b else ""
                    }
                })
            
            findings.append(AntiPatternFinding(
                pattern_type=AntiPatternType.SHARED_DATABASE,
                severity=severity,
                services_involved=services,
                description=(
                    f"Services {', '.join(repr(s) for s in services)} share the same "
                    f"database '{db_key}'. This violates the database-per-service "
                    f"principle of microservice architecture, creating tight data coupling "
                    f"and preventing independent deployment and scaling."
                ),
                evidence=evidence_items,
                recommendation=(
                    "Separate the databases: each service should own its data. "
                    "Use one of: (1) Service A queries Service B's data via its API, "
                    "(2) Maintain separate DB copies synchronized via events, "
                    "(3) Use CQRS pattern to provide read models without DB sharing."
                )
            ))
        
        return findings

    def _get_db_key(self, db: Optional[DatabaseConnection]) -> str:
        if not db:
            return "unknown"
        host = (db.host or "localhost").lower()
        db_name = (db.database_name or "").lower()
        return f"{db.db_type}://{host}/{db_name}"
```

---

### 6.8 `mesa/reporters/` — Reporters

#### `console_reporter.py` — Rich Terminal Output

Uses the `rich` library for colored, formatted output.

**Output structure:**

```
╔══════════════════════════════════════════════════════╗
║           MESA Analysis Report                       ║
║  Analyzed: 3 services | Found: 5 findings            ║
╚══════════════════════════════════════════════════════╝

SERVICES ANALYZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • user-service       (Python)  3 endpoints  2 outbound calls
  • order-service      (Java)    5 endpoints  4 outbound calls
  • payment-service    (Python)  2 endpoints  1 outbound call

FINDINGS  (5 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[MESA-CYCL-001] ● CRITICAL  Cyclic Dependency
  Services: order-service → user-service → order-service
  ...

[MESA-CHAT-001] ● MEDIUM    Chatty Service
  Services: user-service ↔ order-service (6 calls)
  ...

SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CRITICAL: 1   HIGH: 1   MEDIUM: 2   LOW: 1
```

#### `json_reporter.py` — JSON Output

```json
{
  "mesa_version": "1.0.0",
  "analysis_timestamp": "2025-04-15T10:30:00Z",
  "services_analyzed": [
    {
      "name": "user-service",
      "language": "python",
      "endpoint_count": 3,
      "outbound_call_count": 2
    }
  ],
  "findings": [
    {
      "finding_id": "MESA-CYCL-001",
      "pattern_type": "CYCLIC_DEPENDENCY",
      "severity": "CRITICAL",
      "services_involved": ["order-service", "user-service"],
      "description": "...",
      "evidence": [...],
      "recommendation": "..."
    }
  ],
  "summary": {
    "total_findings": 5,
    "by_severity": {"CRITICAL": 1, "HIGH": 1, "MEDIUM": 2, "LOW": 1},
    "by_type": {"CYCLIC_DEPENDENCY": 1, "CHATTY_SERVICE": 2, "SHARED_DATABASE": 2}
  }
}
```

---

### 6.9 `mesa/evaluator/` — Evaluation Framework

#### `metrics.py`

```python
def calculate_precision(true_positives: int, false_positives: int) -> float:
    if true_positives + false_positives == 0:
        return 0.0
    return true_positives / (true_positives + false_positives)

def calculate_recall(true_positives: int, false_negatives: int) -> float:
    if true_positives + false_negatives == 0:
        return 0.0
    return true_positives / (true_positives + false_negatives)

def calculate_f1(precision: float, recall: float) -> float:
    if precision + recall == 0:
        return 0.0
    return 2 * (precision * recall) / (precision + recall)

def evaluate_findings(
    detected: List[AntiPatternFinding],
    ground_truth: List[Dict]
) -> Dict:
    """
    Compare detected findings against ground truth labels.
    
    Ground truth format:
    [
      {"type": "CYCLIC_DEPENDENCY", "services": ["a", "b"]},
      {"type": "CHATTY_SERVICE", "services": ["a", "c"]},
    ]
    
    A finding is a True Positive if:
    - Same pattern_type as a ground truth entry
    - All services_involved are present in the ground truth entry's services list
    
    Returns dict with per-type and overall precision, recall, F1.
    """
```

#### `ground_truth.py`

Ground truth YAML format:

```yaml
# benchmark/ground_truth/online_boutique.yaml
project: "Online Boutique"
url: "https://github.com/GoogleCloudPlatform/microservices-demo"
anti_patterns:
  - type: CHATTY_SERVICE
    services:
      - frontend
      - productcatalogservice
    description: "Frontend calls productcatalog on every page load for product details"
    call_sites:
      - file: "src/frontend/handlers.go"
        line: 142
  - type: CYCLIC_DEPENDENCY
    services:
      - checkoutservice
      - cartservice
    description: "checkout calls cart; cart history is queried back"
```

---

## 7. Algorithm Specifications

### 7.1 DFS-based Cycle Detection (Johnson's Algorithm via networkx)

`networkx.simple_cycles(G)` implements Johnson's algorithm. It finds all elementary circuits (simple cycles — no repeated vertices except start=end).

**Time Complexity:** O((V + E)(C + 1)) where C is the number of simple cycles.
**Space Complexity:** O(V + E)

For typical microservice architectures (V ≤ 50 services, E ≤ 200 edges), this runs in milliseconds.

### 7.2 Shared Database Detection Algorithm

```
Input: List of DatabaseConnection objects from all services
Output: Groups of services sharing a database

Algorithm:
1. For each DatabaseConnection d:
   a. Compute key = normalize(d.host) + "/" + normalize(d.database_name)
   b. Add (d.service_name, d) to groups[key]

2. For each group with 2+ distinct services:
   a. Create a SharedDatabase finding
   b. Record evidence: service names, files, line numbers

Normalization:
- host: lowercase, strip whitespace, resolve "localhost" and "127.0.0.1" to "localhost"
- database_name: lowercase, strip whitespace
- If host is blank/null and db_name is blank/null: skip (can't determine)
```

### 7.3 Chatty Service Detection Algorithm

```
Input: ServiceDependencyGraph (directed multigraph with api_call edges)
Output: List of service pairs exceeding call threshold

Algorithm:
1. For each directed edge (u, v) of type "api_call" in graph:
   a. Increment call_count[u][v]

2. For each pair (u, v) where call_count[u][v] >= THRESHOLD:
   a. Create a ChattyService finding

Threshold: configurable, default = 3

Note: Each DISTINCT call site (file + line number) counts as 1 edge.
If the same call site appears in a loop, it is still counted once.
The threshold refers to distinct call definitions, not runtime frequency.
```

---

## 8. Anti-Pattern Detection Rules (Exact Thresholds)

### Chatty Services

| Call Count | Severity | Recommendation |
|---|---|---|
| 3–5 | LOW | Consider consolidating |
| 6–9 | MEDIUM | Strong refactoring needed |
| ≥10 | HIGH | Immediate action required |

### Cyclic Dependencies

| Cycle Length | Severity | Reason |
|---|---|---|
| 2 (A↔B) | CRITICAL | Direct bidirectional coupling — worst case |
| 3 (A→B→C→A) | HIGH | Common triangle pattern — very problematic |
| ≥4 | MEDIUM | Long chain cycle — still bad but less acute |

### Shared Database

| Situation | Severity |
|---|---|
| 2 services share same DB name on same host | CRITICAL |
| 3+ services share same DB | HIGH |
| Same host, different DB but same schema pattern | MEDIUM |

---

## 9. CLI Command Reference

### `mesa analyze`

```
mesa analyze [OPTIONS]

Options:
  -r, --repo TEXT          Local path or GitHub URL. Repeat for multiple services.
                           Example: -r ./services/user-svc -r https://github.com/org/order-svc
  -c, --config FILE        Path to mesa.yaml configuration file.
  -o, --output FILE        Write report to FILE instead of console.
  -f, --format [text|json] Output format. Default: text
  --threshold-chatty INT   Call count threshold for Chatty Services. Default: 3
  --no-chatty              Disable Chatty Service detection.
  --no-cyclic              Disable Cyclic Dependency detection.
  --no-shared-db           Disable Shared Database detection.
  -v, --verbose            Show parsing progress, graph stats, debug info.
  --help                   Show help message.

Exit codes:
  0  Analysis completed, no findings
  1  Analysis completed, findings detected
  2  Error (invalid input, parse failure, etc.)

Examples:
  # Analyze two local service directories
  mesa analyze -r ./user-service -r ./order-service

  # Analyze from GitHub with JSON output
  mesa analyze -r https://github.com/org/svc-a -r https://github.com/org/svc-b -f json -o report.json

  # Use config file
  mesa analyze -c mesa.yaml

  # Custom chatty threshold
  mesa analyze -r ./svc-a -r ./svc-b --threshold-chatty 5
```

### `mesa evaluate`

```
mesa evaluate [OPTIONS]

Options:
  -p, --projects FILE      Path to projects.yaml file. Default: benchmark/projects.yaml
  -g, --ground-truth DIR   Path to ground truth directory. Default: benchmark/ground_truth/
  -o, --output FILE        Write evaluation results to FILE. Default: evaluation_results.json
  --help                   Show help message.

Output:
  JSON file with precision, recall, F1-score per pattern type and overall.
```

---

## 10. Configuration File Schema

`mesa.yaml` — full example with all options:

```yaml
version: "1.0"

# List of microservice repositories to analyze
repositories:
  - path: ./services/user-service    # Local path (relative or absolute)
    name: user-service               # Override auto-detected name
    language: python                 # Override auto-detected language
  - path: ./services/order-service
    name: order-service
    language: java
  - url: https://github.com/org/payment-service   # Remote GitHub repo
    name: payment-service
    language: python
    branch: main                     # Optional: specific branch (default: default branch)

# Analysis configuration
analysis:
  chatty_service:
    enabled: true
    threshold: 3                     # Min distinct call sites to flag

  cyclic_dependency:
    enabled: true
    min_cycle_length: 2              # Minimum services in a cycle to report

  shared_database:
    enabled: true

# Output configuration
output:
  format: text                       # text | json
  file: mesa_report.txt              # Optional: write to file

# Temp directory for cloned repos
temp_dir: /tmp/mesa_repos
```

---

## 11. Output Report Format

### Text Report (console and file)

```
================================================================================
MESA v1.0.0 — Microservices Architectural Anti-Pattern Analysis Report
Analysis Date: 2025-04-15 10:30:45
================================================================================

ANALYZED SERVICES (3)
  Name                 Language    Endpoints    Outbound Calls    DB Connections
  ─────────────────────────────────────────────────────────────────────────────
  user-service         Python            4                 2                 1
  order-service        Java              6                 5                 1
  payment-service      Python            2                 3                 1

DEPENDENCY GRAPH SUMMARY
  Nodes (services):  3
  Edges (API calls): 7
  Unresolved calls:  2 (calls where target service could not be determined)

================================================================================
FINDINGS (4)
================================================================================

[MESA-CYCL-001] CRITICAL — Cyclic Dependency
  Services Involved: order-service, user-service
  
  Description:
    Cyclic dependency detected: order-service → user-service → order-service.
    This 2-service cycle creates tight coupling and can cause deployment
    ordering issues and cascading failures.
  
  Evidence:
    • order-service calls user-service at:
        src/orders/service.py:142  GET http://user-service:8080/api/users/{id}
        src/orders/service.py:198  POST http://user-service:8080/api/notifications
    • user-service calls order-service at:
        src/users/handlers.py:87   GET http://order-service:8081/api/orders/pending
  
  Recommendation:
    Break the cycle by: (1) Introducing an event-driven approach where one
    service publishes events instead of calling back, (2) Extracting shared
    logic into a new service, (3) Reversing the direction of one dependency.

────────────────────────────────────────────────────────────────────────────────

[MESA-CHAT-001] MEDIUM — Chatty Service
  Services Involved: order-service → user-service
  
  Description:
    Service 'order-service' makes 6 distinct API calls to 'user-service',
    exceeding the threshold of 3. This indicates tight coupling.
  
  Evidence:
    Call sites in order-service:
    1. src/orders/service.py:142      GET  /api/users/{id}
    2. src/orders/service.py:198      POST /api/notifications
    3. src/orders/checkout.py:67      GET  /api/users/{id}/address
    4. src/orders/checkout.py:89      GET  /api/users/{id}/payment-methods
    5. src/orders/history.py:34       GET  /api/users/{id}
    6. src/orders/analytics.py:112    GET  /api/users/count
  
  Recommendation:
    Consider consolidating multiple API calls into a single composite endpoint...

────────────────────────────────────────────────────────────────────────────────

[MESA-SHDB-001] CRITICAL — Shared Database
  Services Involved: order-service, payment-service
  
  Description:
    Services 'order-service' and 'payment-service' share the same database
    'postgresql://db-host/transactions'. This violates the database-per-service
    principle.
  
  Evidence:
    • order-service:   .env:3       DATABASE_URL=postgresql://user:pass@db-host:5432/transactions
    • payment-service: .env:5       DB_URL=postgresql://svc:pass@db-host:5432/transactions
  
  Recommendation:
    Separate the databases. Each service should own its data store...

================================================================================
SUMMARY
================================================================================
  Total Findings:  3
  
  By Severity:     CRITICAL: 2   HIGH: 0   MEDIUM: 1   LOW: 0
  By Type:         Cyclic Dependency: 1   Chatty Service: 1   Shared Database: 1

  Note: 2 outbound call(s) could not be resolved to a known service.
        Run with --verbose for details.
================================================================================
```

---

## 12. Testing Strategy

### Unit Tests

Each module has its own test file. Tests use synthetic fixture microservices (stored in `tests/fixtures/`).

**Critical tests to implement:**

1. `test_python_parser.py`:
   - Test endpoint detection for Flask, FastAPI, Django
   - Test outbound call detection for requests, httpx
   - Test DB connection extraction from source code
   - Test files with no routes return empty endpoint list

2. `test_graph_builder.py`:
   - Test that API call edges are created when target is resolvable
   - Test that shared DB edges are created when two services use same DB
   - Test that unresolvable URLs don't create edges

3. `test_chatty_detector.py`:
   - Test: 2 calls between A→B → no finding (below threshold 3)
   - Test: 3 calls between A→B → finding (at threshold)
   - Test: 5 calls between A→B → LOW severity
   - Test: 8 calls between A→B → MEDIUM severity
   - Test: 12 calls between A→B → HIGH severity

4. `test_cyclic_detector.py`:
   - Test: A→B, B→A (2-cycle) → CRITICAL finding
   - Test: A→B, B→C, C→A (3-cycle) → HIGH finding
   - Test: A→B, B→C, C→D, D→A (4-cycle) → MEDIUM finding
   - Test: A→B, B→C (no cycle) → no finding

5. `test_shared_db_detector.py`:
   - Test: service A and B both connect to postgresql://host/mydb → finding
   - Test: service A connects to postgresql://host/db1, service B to postgresql://host/db2 → no finding
   - Test: different hosts, same DB name → no finding

### Integration Tests

`tests/integration/test_full_pipeline.py`:
- Load `tests/fixtures/chatty_services/` → run full analysis → assert ChattyService finding detected
- Load `tests/fixtures/cyclic_services/` → run full analysis → assert CyclicDependency finding detected
- Load `tests/fixtures/shared_db_services/` → run full analysis → assert SharedDatabase finding detected
- Load `tests/fixtures/clean_services/` → run full analysis → assert NO findings

### Fixture Structure

Each fixture is a minimal but realistic microservice. Example for `tests/fixtures/chatty_services/service_a/`:

```
tests/fixtures/chatty_services/service_a/
├── app.py          ← Flask app with 2 routes
├── service.py      ← Makes 4+ calls to service_b
└── requirements.txt
```

`service.py` content (designed to trigger chatty detection):
```python
import requests

SERVICE_B_URL = "http://service-b:8080"

def get_user_data(user_id):
    return requests.get(f"{SERVICE_B_URL}/users/{user_id}")   # call 1

def get_user_profile(user_id):
    return requests.get(f"{SERVICE_B_URL}/users/{user_id}/profile")  # call 2

def get_user_orders(user_id):
    return requests.get(f"{SERVICE_B_URL}/users/{user_id}/orders")   # call 3

def get_user_preferences(user_id):
    return requests.get(f"{SERVICE_B_URL}/users/{user_id}/prefs")    # call 4 → triggers chatty at threshold=3
```

---

## 13. Evaluation Framework

### Benchmark Projects

| Project | GitHub URL | Language | Services | Known Anti-Patterns |
|---|---|---|---|---|
| Online Boutique | GoogleCloudPlatform/microservices-demo | Go/Python | 11 | Chatty (frontend→catalog), some cyclic |
| Sock Shop | microservices-demo/microservices-demo | Java/Go | 9 | Shared DB (orders/users on same DB) |
| PiggyMetrics | sqshq/piggymetrics | Java Spring | 4 | Cyclic (auth↔account services) |
| eShopOnContainers | dotnet-architecture/eShopOnContainers | .NET/C# | 8 | Various |
| Synthetic (custom) | tests/fixtures/ | Python | 2-4 | Injected, fully known |

### Ground Truth Format

```yaml
# benchmark/ground_truth/piggymetrics.yaml
project: "PiggyMetrics"
anti_patterns:
  - type: CYCLIC_DEPENDENCY
    services:
      - account-service
      - auth-service
    confirmed: true
    notes: "Account service calls auth to validate tokens; auth calls account to update last_login"
  - type: CHATTY_SERVICE
    services:
      - statistics-service
      - account-service
    confirmed: true
    notes: "Statistics polls account service endpoint 5 times per request"
```

### Evaluation Run Process

```
mesa evaluate -p benchmark/projects.yaml -g benchmark/ground_truth/ -o results.json
```

This will:
1. For each project in `projects.yaml`: clone it (if URL) or use local path.
2. Run `mesa analyze` on it.
3. Compare findings against ground truth YAML.
4. Compute TP, FP, FN per pattern type.
5. Calculate and report precision, recall, F1 per type and overall.

### Expected Minimum Accuracy Targets

For the research to be considered successful:
- **Cyclic Dependency:** F1 ≥ 0.80 (graph algorithms are deterministic, high precision expected)
- **Chatty Service:** F1 ≥ 0.70 (depends on URL resolution accuracy)
- **Shared Database:** F1 ≥ 0.75 (depends on .env/config file coverage)
- **Overall F1:** ≥ 0.75

---

## 14. Edge Cases and Known Limitations

### URL Resolution Limitations

1. **Dynamic URL construction:** `url = base_url + path + param` — MESA cannot always resolve these. Log as "unresolvable" and count in report.
2. **Service discovery URLs:** `http://eureka-registry/user-service/...` — MESA detects service name from path component after registry host.
3. **Load balancer URLs:** `http://nginx.internal/api/...` — Cannot resolve without additional config. Warn in report.
4. **Environment variable indirection:** `os.getenv("SVC_URL")` where value is not in `.env` — log as unresolvable.

### Parser Limitations

1. **Dynamically generated routes:** Flask views registered programmatically in loops. Only static decorators are detected.
2. **gRPC calls:** Not supported in v1.0. REST/HTTP only.
3. **Message queues (Kafka, RabbitMQ):** Not analyzed. These are communication channels too, but out of scope.
4. **C#, Go, Ruby:** Not supported in v1.0.

### Database Detection Limitations

1. **Encrypted connection strings:** Can't parse if encrypted at rest in the repo.
2. **Secrets managers:** `db_url = secrets_manager.get("DATABASE_URL")` — cannot retrieve the actual value.
3. **Terraform/Helm values:** Infrastructure-as-code may define DB connections. Only `docker-compose.yml` and `.env` are supported.

### False Positive Scenarios (Note in Report)

- **Intentional chatty pattern:** Some services are designed to call another service many times in one request. A NOTE in the recommendation advises human review.
- **Test doubles:** If test files contain mock URLs to the same service names, these may generate false chatty findings. MESA should exclude `test_*` directories from analysis by default (configurable).

---

## 15. Benchmark Projects and Ground Truth

### Setting Up Benchmark

Create `benchmark/projects.yaml`:

```yaml
projects:
  - name: "Online Boutique"
    url: "https://github.com/GoogleCloudPlatform/microservices-demo"
    services_subdirectory: "src"    # Services are in subdirectories of src/
    language_map:
      frontend: "go"
      productcatalogservice: "go"
      cartservice: "go"
      checkoutservice: "go"
      recommendationservice: "python"
      emailservice: "python"
  
  - name: "PiggyMetrics"
    url: "https://github.com/sqshq/piggymetrics"
    services_subdirectory: ""
    language_map:
      account-service: "java"
      auth-service: "java"
      statistics-service: "java"
      notification-service: "java"
  
  - name: "Synthetic (Injected)"
    path: "tests/fixtures/"
    ground_truth: "benchmark/ground_truth/synthetic.yaml"
```

---

## 16. Dependencies and Setup

### `requirements.txt`

```
click>=8.1.7
networkx>=3.2.1
gitpython>=3.1.41
pyyaml>=6.0.1
javalang>=0.13.0
esprima>=4.0.1
rich>=13.7.0
tabulate>=0.9.0
```

### `requirements-dev.txt`

```
pytest>=7.4.0
pytest-cov>=4.1.0
pytest-mock>=3.12.0
coverage>=7.3.0
black>=23.0.0
isort>=5.12.0
mypy>=1.7.0
```

### `setup.py`

```python
from setuptools import setup, find_packages

setup(
    name="mesa",
    version="1.0.0",
    description="Cross-Service Static Analysis Tool for Microservices Anti-Patterns",
    author="K I W De Silva",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "click>=8.1.7",
        "networkx>=3.2.1",
        "gitpython>=3.1.41",
        "pyyaml>=6.0.1",
        "rich>=13.7.0",
    ],
    entry_points={
        "console_scripts": [
            "mesa=mesa.cli:cli",
        ],
    },
)
```

### Installation

```bash
# Clone and install in development mode
git clone https://github.com/your-repo/mesa.git
cd mesa
pip install -e .
pip install -r requirements-dev.txt

# Or install directly
pip install .

# Verify
mesa --version
```

---

## 17. Build & Release

### Running Tests

```bash
# All tests
pytest

# With coverage
pytest --cov=mesa --cov-report=html

# Specific module
pytest tests/unit/test_cyclic_detector.py -v
```

### Code Quality

```bash
# Format
black mesa/ tests/

# Sort imports
isort mesa/ tests/

# Type check
mypy mesa/
```

### Release Checklist

1. All tests pass: `pytest`
2. Coverage ≥ 80%: `pytest --cov=mesa`
3. No type errors: `mypy mesa/`
4. `CHANGELOG.md` updated
5. Version bumped in `mesa/__init__.py` and `setup.py`
6. Benchmark evaluation run and results documented

---

## Appendix A: Complete Data Flow

```
User runs: mesa analyze -r ./user-service -r ./order-service

Step 1: collect()
  LocalCollector.collect("./user-service") → "/abs/path/user-service"
  LocalCollector.collect("./order-service") → "/abs/path/order-service"

Step 2: detect language
  detect_language("/abs/path/user-service") → "python"
  detect_language("/abs/path/order-service") → "java"

Step 3: parse()
  PythonParser.parse("/abs/path/user-service") →
    Service(name="user-service", endpoints=[...], outbound_calls=[...])
  JavaParser.parse("/abs/path/order-service") →
    Service(name="order-service", endpoints=[...], outbound_calls=[...])

  EnvParser.parse_all("/abs/path/user-service") →
    [DatabaseConnection(service="user-service", host="db", db="users")]

Step 4: build graph
  GraphBuilder([user_service, order_service]).build() →
    ServiceDependencyGraph with:
      nodes: ["user-service", "order-service"]
      edges: [("order-service", "user-service", type="api_call", weight=6),
              ("user-service", "order-service", type="api_call", weight=2)]

Step 5: detect
  ChattyServiceDetector(threshold=3).detect(graph) →
    [Finding(CHATTY, MEDIUM, ["order-service","user-service"])]
  CyclicDependencyDetector().detect(graph) →
    [Finding(CYCLIC, CRITICAL, ["user-service","order-service"])]
  SharedDatabaseDetector().detect(graph) → []

Step 6: report
  ConsoleReporter().report(services, findings) → prints to terminal
```

---

## Appendix B: Glossary

| Term | Definition |
|---|---|
| Anti-pattern | A commonly recurring architectural decision that is problematic |
| Chatty service | Two services that have excessive API calls between them |
| Cyclic dependency | A circular chain of service dependencies (A→B→C→A) |
| Shared database | Multiple services connecting to the same database, violating isolation |
| Static analysis | Code analysis without executing the code |
| Service dependency graph | A directed graph where nodes=services, edges=inter-service calls |
| AST | Abstract Syntax Tree — structural representation of source code |
| Precision | TP / (TP + FP) — of what MESA flags, how much is correct |
| Recall | TP / (TP + FN) — of all real problems, how many MESA finds |
| F1-score | Harmonic mean of precision and recall (2 × P × R / (P+R)) |
| True Positive (TP) | MESA flagged it AND it is a real anti-pattern |
| False Positive (FP) | MESA flagged it BUT it is NOT a real anti-pattern |
| False Negative (FN) | MESA missed it AND it IS a real anti-pattern |

---

*End of AI Developer Guide — MESA v1.0.0*
