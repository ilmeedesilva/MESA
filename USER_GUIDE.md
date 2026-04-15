# MESA — User Guide
## Cross-Service Static Analysis Tool for Microservices Architectural Anti-Patterns

**Version:** 1.0.0  
**Author:** K I W De Silva  
**Project:** BSc Hons Computing — Coventry University / NIBM

---

## Table of Contents

1. [What is MESA?](#1-what-is-mesa)
2. [What Problems Does MESA Find?](#2-what-problems-does-mesa-find)
3. [System Requirements](#3-system-requirements)
4. [Installation](#4-installation)
5. [Quick Start (Your First Analysis)](#5-quick-start-your-first-analysis)
6. [Preparing Your Services for Analysis](#6-preparing-your-services-for-analysis)
7. [Running an Analysis](#7-running-an-analysis)
8. [Using a Configuration File](#8-using-a-configuration-file)
9. [Understanding the Report](#9-understanding-the-report)
10. [Output Formats](#10-output-formats)
11. [Analyzing GitHub Repositories](#11-analyzing-github-repositories)
12. [Running the Evaluation (Researchers)](#12-running-the-evaluation-researchers)
13. [Common Patterns and Examples](#13-common-patterns-and-examples)
14. [Troubleshooting](#14-troubleshooting)
15. [FAQ](#15-faq)

---

## 1. What is MESA?

MESA (**M**icroservice **E**architectural **S**tatic **A**nalyzer) is a command-line tool that scans the source code of your microservices and finds **hidden design problems** that only appear when multiple services work together.

Think of it this way: current tools like SonarQube check whether **one** service is well-written. MESA checks whether **your services work together correctly**.

**MESA reads your source code** — it does NOT run your services, does NOT connect to any database, and does NOT send any data to the internet.

---

## 2. What Problems Does MESA Find?

MESA detects three specific architectural anti-patterns:

### Chatty Services
**What it is:** Service A calls Service B an excessive number of times — for example, making 10 separate API calls to fetch data that could be retrieved in 1-2 calls.

**Why it matters:** Too many inter-service calls slow down your application, increase network load, and make services tightly coupled.

**Example MESA would flag:**
```
order-service calls user-service 8 times per request:
  GET /users/{id}           (to get name)
  GET /users/{id}/address   (to get address)
  GET /users/{id}/phone     (to get phone)
  ...and 5 more
```

### Cyclic Dependencies
**What it is:** Service A depends on Service B, and Service B depends back on Service A (directly or through a chain: A→B→C→A).

**Why it matters:** Cycles make it impossible to deploy services independently, can cause infinite loops, and make the system fragile — if one service is down, it takes the others down with it.

**Example MESA would flag:**
```
order-service → user-service → order-service  (A calls B, B calls back A)
```

### Shared Database Anti-Pattern
**What it is:** Two or more services connect to the exact same database (same host, same database name).

**Why it matters:** This creates a hidden tight coupling at the data layer. Services cannot be deployed independently, schema changes in one service break others, and it prevents independent scaling.

**Example MESA would flag:**
```
order-service:   DATABASE_URL=postgresql://db-host:5432/app_db
payment-service: DATABASE_URL=postgresql://db-host:5432/app_db
← Both services use the same database!
```

---

## 3. System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| Operating System | macOS, Linux, Windows 10+ | macOS or Linux |
| Python | 3.10 | 3.11 or 3.12 |
| RAM | 512 MB | 2 GB |
| Disk Space | 500 MB | 2 GB (for cloning repos) |
| Internet | Not required for local analysis | Required for GitHub repos |
| Git | Required only for GitHub repos | Latest version |

**Supported service languages:**
- Python (Flask, FastAPI, Django)
- Java (Spring Boot)
- JavaScript / Node.js (Express, NestJS)

---

## 4. Installation

### Option A: Install with pip (Recommended)

```bash
pip install mesa-analyzer
```

Verify installation:
```bash
mesa --version
```

Expected output:
```
MESA version 1.0.0
```

### Option B: Install from Source

```bash
# 1. Clone the repository
git clone https://github.com/your-username/mesa.git
cd mesa

# 2. Install in development mode
pip install -e .

# 3. Verify
mesa --version
```

### Option C: Install in a Virtual Environment (Recommended for Projects)

```bash
# Create a virtual environment
python -m venv venv

# Activate it (macOS/Linux)
source venv/bin/activate

# Activate it (Windows)
venv\Scripts\activate

# Install MESA
pip install mesa-analyzer

# Verify
mesa --version
```

---

## 5. Quick Start (Your First Analysis)

The fastest way to use MESA:

```bash
# Analyze two local microservice directories
mesa analyze -r ./my-user-service -r ./my-order-service
```

That's it. MESA will:
1. Scan both service directories
2. Parse all source code files
3. Build a dependency graph
4. Check for all three anti-patterns
5. Print a report to your terminal

**Example output:**
```
MESA Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Services Analyzed: 2
Findings: 2

[MESA-CYCL-001] CRITICAL — Cyclic Dependency
  order-service → user-service → order-service

[MESA-CHAT-001] MEDIUM — Chatty Service
  order-service calls user-service 6 times

Summary: CRITICAL: 1   MEDIUM: 1
```

---

## 6. Preparing Your Services for Analysis

MESA works best when your service directories are organized as follows:

### What MESA looks for

MESA automatically scans your service directories for:

**In Python services:**
- `*.py` files — for routes and outbound HTTP calls
- `.env`, `.env.local`, `.env.production` — for database URLs

**In Java services:**
- `*.java` files — for Spring Boot annotations and RestTemplate calls
- `application.properties`, `application.yml` — for database config
- `pom.xml` — to confirm it's a Java project

**In JavaScript/Node.js services:**
- `*.js`, `*.ts` files — for Express routes and axios/fetch calls
- `.env` files — for database URLs
- `package.json` — to confirm it's a JS project

**For all services:**
- `docker-compose.yml` — for database and service configuration
- `Dockerfile` — for environment variables

### Typical directory structure MESA handles well

```
your-project/
├── user-service/
│   ├── app.py          ← Flask/FastAPI routes defined here
│   ├── services.py     ← HTTP calls to other services
│   ├── models.py
│   └── .env            ← DATABASE_URL=postgresql://...
│
├── order-service/
│   ├── src/
│   │   └── main/java/com/example/
│   │       └── OrderController.java    ← Spring @GetMapping etc.
│   ├── application.yml ← spring.datasource.url
│   └── pom.xml
│
└── docker-compose.yml  ← MESA also reads this for service config
```

### Tips for Better Detection

1. **Keep `.env` files in your repository** (with non-sensitive placeholder values) — this dramatically improves shared database detection.

2. **Use service names as hostnames** in your URLs. For example, in docker-compose environments, services typically call each other using the service name:
   ```python
   # Good — MESA can resolve this
   response = requests.get("http://user-service:8080/api/users")
   
   # Harder for MESA — URL is dynamic
   response = requests.get(os.getenv("USER_SERVICE_URL") + "/api/users")
   ```

3. **Include docker-compose.yml** if you have one — it helps MESA understand service names and database configurations.

---

## 7. Running an Analysis

### Basic Usage

```bash
# Single service (limited — MESA works best with 2+ services)
mesa analyze -r ./user-service

# Two local services (most common)
mesa analyze -r ./user-service -r ./order-service

# Three or more services
mesa analyze -r ./user-service -r ./order-service -r ./payment-service

# Mix of local and GitHub
mesa analyze -r ./user-service -r https://github.com/org/order-service
```

### All Command Options

```
mesa analyze [OPTIONS]

OPTIONS:
  -r, --repo TEXT           Path to a service directory, OR a GitHub URL.
                            Repeat this option for each service.
                            
  -c, --config FILE         Path to a mesa.yaml configuration file.
                            If provided, repos from the config file are also analyzed.
                            
  -o, --output FILE         Save the report to a file instead of printing to console.
                            Example: -o report.txt
                            
  -f, --format [text|json]  Report format.
                            text = human-readable (default)
                            json = machine-readable JSON
                            
  --threshold-chatty INT    Number of call sites before a pair is flagged as chatty.
                            Default: 3. Increase if you have many intentional calls.
                            
  --no-chatty               Skip Chatty Service detection entirely.
  --no-cyclic               Skip Cyclic Dependency detection entirely.
  --no-shared-db            Skip Shared Database detection entirely.
  
  -v, --verbose             Show detailed progress: which files are being parsed,
                            how many endpoints found, URL resolution results, etc.
                            
  --help                    Show help.
```

### Practical Examples

```bash
# Analyze and save to a text file
mesa analyze -r ./user-svc -r ./order-svc -o analysis_report.txt

# Analyze and save to JSON (for programmatic processing)
mesa analyze -r ./user-svc -r ./order-svc -f json -o report.json

# Only check for cyclic dependencies
mesa analyze -r ./user-svc -r ./order-svc --no-chatty --no-shared-db

# Be more lenient about chatty services (raise threshold to 5)
mesa analyze -r ./user-svc -r ./order-svc --threshold-chatty 5

# Verbose output to see what MESA found during parsing
mesa analyze -r ./user-svc -r ./order-svc -v
```

---

## 8. Using a Configuration File

For projects with many services, or to save your analysis settings, use a `mesa.yaml` configuration file.

### Creating a Configuration File

Create `mesa.yaml` in your project root:

```yaml
version: "1.0"

repositories:
  - path: ./services/user-service
    name: user-service
    language: python

  - path: ./services/order-service
    name: order-service
    language: java

  - path: ./services/payment-service
    name: payment-service
    language: python

analysis:
  chatty_service:
    enabled: true
    threshold: 3

  cyclic_dependency:
    enabled: true

  shared_database:
    enabled: true

output:
  format: text
  file: mesa_report.txt
```

### Running with a Configuration File

```bash
mesa analyze -c mesa.yaml
```

### Overriding Config File Settings on the Command Line

Command-line flags always override the config file:

```bash
# Use config file but change output format to JSON
mesa analyze -c mesa.yaml -f json -o report.json

# Use config file but disable chatty detection for this run
mesa analyze -c mesa.yaml --no-chatty
```

### Configuration File — All Options

```yaml
version: "1.0"

repositories:
  # Local directory
  - path: ./services/my-service     # Required if not using 'url'
    name: my-service                 # Optional: overrides auto-detected name from directory name
    language: python                 # Optional: python | java | javascript
                                     # If omitted, MESA auto-detects

  # Remote GitHub repo
  - url: https://github.com/org/repo  # Required if not using 'path'
    name: repo-name                    # Optional
    language: java                     # Optional
    branch: main                       # Optional: which branch to clone (default: default branch)

analysis:
  chatty_service:
    enabled: true                   # Default: true
    threshold: 3                    # Default: 3

  cyclic_dependency:
    enabled: true                   # Default: true
    min_cycle_length: 2             # Default: 2 (smallest possible cycle)

  shared_database:
    enabled: true                   # Default: true

output:
  format: text                      # Default: text
  file: mesa_report.txt             # Optional: if omitted, prints to console

temp_dir: /tmp/mesa_repos           # Where to store cloned GitHub repos
                                    # Default: /tmp/mesa_repos
```

---

## 9. Understanding the Report

### Report Header

```
================================================================================
MESA v1.0.0 — Microservices Architectural Anti-Pattern Analysis Report
Analysis Date: 2025-04-15 10:30:45
================================================================================
```

Shows the MESA version and when the analysis was run.

### Services Analyzed Table

```
ANALYZED SERVICES (3)
  Name                 Language    Endpoints    Outbound Calls    DB Connections
  user-service         Python            4                 2                 1
  order-service        Java              6                 5                 1
  payment-service      Python            2                 3                 1
```

- **Endpoints:** How many API routes MESA found this service exposing.
- **Outbound Calls:** How many HTTP calls MESA found this service making to other services.
- **DB Connections:** How many database connection strings MESA found.

**If Endpoints = 0:** MESA could not find any routes. Check if the service uses a framework MESA supports (Flask, FastAPI, Spring Boot, Express).

**If Outbound Calls = 0:** MESA could not find any HTTP calls. The service may use an unsupported HTTP library, or calls may be dynamically constructed.

### Finding Entries

Each finding looks like this:

```
[MESA-CYCL-001] CRITICAL — Cyclic Dependency
  Services Involved: order-service, user-service

  Description:
    Cyclic dependency detected: order-service → user-service → order-service.
    ...

  Evidence:
    • order-service calls user-service at:
        src/orders/service.py:142  GET http://user-service:8080/api/users/{id}
    • user-service calls order-service at:
        src/users/handlers.py:87   GET http://order-service:8081/api/orders/pending

  Recommendation:
    Break the cycle by introducing an event-driven approach...
```

**Finding ID Format:** `MESA-[TYPE]-[NUMBER]`
- `CYCL` = Cyclic Dependency
- `CHAT` = Chatty Service
- `SHDB` = Shared Database

**Severity levels:**

| Level | Color | Meaning |
|---|---|---|
| CRITICAL | Red | Fix immediately. High risk of system failure or data problems. |
| HIGH | Orange | Fix soon. Significant architectural debt. |
| MEDIUM | Yellow | Address in next sprint. Clear architectural problem. |
| LOW | Blue | Worth noting. Consider refactoring when convenient. |

**Evidence:** Shows exactly which file and line number triggered the finding. Use these to navigate directly to the problematic code.

**Recommendation:** Concrete suggestions for how to fix the problem.

### Summary

```
SUMMARY
  Total Findings: 4
  
  By Severity:     CRITICAL: 1   HIGH: 1   MEDIUM: 1   LOW: 1
  By Type:         Cyclic Dependency: 1   Chatty Service: 2   Shared Database: 1

  Note: 2 outbound call(s) could not be resolved to a known service.
```

The **"could not be resolved"** note means MESA found HTTP calls in the source code but could not determine which of your services they target. This is normal for calls to external APIs or when URLs are heavily dynamic. Add `-v` to see details.

---

## 10. Output Formats

### Text Format (Default)

Human-readable. Good for reading in the terminal or sending to your supervisor/team.

```bash
mesa analyze -r ./svc-a -r ./svc-b -f text -o report.txt
```

### JSON Format

Machine-readable. Good for parsing results programmatically, integrating with CI/CD, or importing into spreadsheets.

```bash
mesa analyze -r ./svc-a -r ./svc-b -f json -o report.json
```

Sample JSON output structure:

```json
{
  "mesa_version": "1.0.0",
  "analysis_timestamp": "2025-04-15T10:30:00Z",
  "services_analyzed": [
    {
      "name": "user-service",
      "language": "python",
      "endpoint_count": 4,
      "outbound_call_count": 2,
      "db_connection_count": 1
    }
  ],
  "findings": [
    {
      "finding_id": "MESA-CYCL-001",
      "pattern_type": "CYCLIC_DEPENDENCY",
      "severity": "CRITICAL",
      "services_involved": ["order-service", "user-service"],
      "description": "Cyclic dependency detected...",
      "evidence": [...],
      "recommendation": "Break the cycle by..."
    }
  ],
  "summary": {
    "total_findings": 2,
    "by_severity": {"CRITICAL": 1, "HIGH": 0, "MEDIUM": 1, "LOW": 0},
    "by_type": {
      "CYCLIC_DEPENDENCY": 1,
      "CHATTY_SERVICE": 1,
      "SHARED_DATABASE": 0
    },
    "unresolved_calls": 2
  }
}
```

---

## 11. Analyzing GitHub Repositories

MESA can clone and analyze public GitHub repositories directly.

### Requirements

- Git must be installed (`git --version` to check)
- Internet access
- Sufficient disk space (repositories are cloned locally)

### Usage

```bash
# Analyze two GitHub repos
mesa analyze \
  -r https://github.com/your-org/user-service \
  -r https://github.com/your-org/order-service
```

### What Happens

1. MESA clones each repository to a temporary directory (`/tmp/mesa_repos/` by default).
2. Analysis is performed on the local clone.
3. Cloned repos are kept for reuse (subsequent runs pull the latest changes).

### Custom Temporary Directory

If disk space is limited or you want repos in a specific location:

```yaml
# mesa.yaml
temp_dir: /path/to/my/workspace/mesa_repos
```

Or delete temporary repos after analysis:

```bash
rm -rf /tmp/mesa_repos
```

### Private Repositories

MESA uses GitPython for cloning. For private repositories, ensure your Git credentials are configured:

```bash
# Option 1: SSH key (recommended)
git clone git@github.com:your-org/private-service.git  # Confirm SSH works first

# Option 2: Personal Access Token
# Set in Git credential manager, or use HTTPS URL with token:
mesa analyze -r https://YOUR_TOKEN@github.com/org/private-service
```

---

## 12. Running the Evaluation (Researchers)

This section is for research purposes — measuring MESA's accuracy against known anti-patterns.

### Setup

1. Ensure benchmark projects are listed in `benchmark/projects.yaml`
2. Ensure ground truth files exist in `benchmark/ground_truth/`

### Running Evaluation

```bash
mesa evaluate \
  --projects benchmark/projects.yaml \
  --ground-truth benchmark/ground_truth/ \
  --output evaluation_results.json
```

### Understanding Evaluation Results

```json
{
  "overall": {
    "precision": 0.82,
    "recall": 0.75,
    "f1_score": 0.78
  },
  "by_pattern": {
    "CHATTY_SERVICE": {
      "true_positives": 8,
      "false_positives": 2,
      "false_negatives": 3,
      "precision": 0.80,
      "recall": 0.73,
      "f1_score": 0.76
    },
    "CYCLIC_DEPENDENCY": {
      "true_positives": 5,
      "false_positives": 0,
      "false_negatives": 1,
      "precision": 1.00,
      "recall": 0.83,
      "f1_score": 0.91
    },
    "SHARED_DATABASE": {
      "true_positives": 4,
      "false_positives": 1,
      "false_negatives": 1,
      "precision": 0.80,
      "recall": 0.80,
      "f1_score": 0.80
    }
  }
}
```

**Reading the metrics:**
- **Precision:** Of the findings MESA reported, what fraction were real problems. (High precision = few false alarms)
- **Recall:** Of all the real problems, what fraction did MESA find. (High recall = few missed problems)
- **F1-score:** The balance between precision and recall. 1.0 is perfect; 0.75+ is considered good for static analysis.

---

## 13. Common Patterns and Examples

### Example 1: E-commerce Microservices

**Project structure:**
```
ecommerce/
├── user-service/     (Flask, Python)
├── product-service/  (FastAPI, Python)
├── order-service/    (Spring Boot, Java)
└── payment-service/  (Express, Node.js)
```

**Analysis:**
```bash
cd ecommerce/
mesa analyze \
  -r ./user-service \
  -r ./product-service \
  -r ./order-service \
  -r ./payment-service \
  -o ecommerce_report.txt
```

### Example 2: Analysis on a CI/CD Pipeline

Add to your `.github/workflows/mesa.yml`:

```yaml
name: MESA Architectural Analysis
on: [push, pull_request]
jobs:
  mesa-analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install mesa-analyzer
      - run: |
          mesa analyze \
            -r ./services/user-service \
            -r ./services/order-service \
            -f json -o mesa_report.json
      - uses: actions/upload-artifact@v3
        with:
          name: mesa-report
          path: mesa_report.json
```

### Example 3: Raising the Chatty Threshold

If your services intentionally call each other many times (e.g., a workflow engine), raise the threshold:

```bash
# Flag as chatty only if 8+ calls
mesa analyze -r ./svc-a -r ./svc-b --threshold-chatty 8
```

### Example 4: Only Check for Cycles

If you just want a quick cycle check:

```bash
mesa analyze -r ./svc-a -r ./svc-b --no-chatty --no-shared-db
```

---

## 14. Troubleshooting

### "No findings" but I know there are problems

**Check 1: Verbose output**
```bash
mesa analyze -r ./svc-a -r ./svc-b -v
```
Look for:
- "0 endpoints found" — MESA could not parse routes (check framework support)
- "0 outbound calls found" — MESA could not find HTTP calls
- "X calls unresolved" — MESA found calls but could not match them to a service

**Check 2: Is the framework supported?**
- Python: Flask, FastAPI, Django supported
- Java: Spring Boot (annotations) supported
- JS: Express, NestJS supported

**Check 3: Are URLs static or dynamic?**

MESA works best with static URLs:
```python
# GOOD — MESA resolves this
requests.get("http://user-service:8080/api/users")

# HARDER — URL is dynamically built
url = build_url(config)
requests.get(url)
```

**Check 4: Are .env files present?**
Shared database detection requires `.env` files with `DATABASE_URL` or similar keys.

---

### "Error: Could not parse file"

The file may contain syntax errors or use a Python 3.12+ syntax feature. MESA uses Python's built-in `ast` module which requires valid syntax.

```bash
# Check if the file has syntax errors
python -m py_compile path/to/file.py
```

---

### "Could not clone repository"

For GitHub repositories:
1. Check your internet connection
2. Verify the URL is correct and the repo is public
3. For private repos, ensure SSH keys or tokens are configured
4. Check disk space: `df -h`

---

### "ModuleNotFoundError: No module named 'mesa'"

MESA is not installed or not in your Python path.

```bash
# Re-install
pip install mesa-analyzer

# Or if using a virtual environment, activate it first
source venv/bin/activate
```

---

### Findings seem wrong (false positives)

**Chatty service false positive:** If two services intentionally call each other many times, raise the threshold:
```bash
mesa analyze -r ./svc-a -r ./svc-b --threshold-chatty 10
```

**Shared database false positive:** MESA flags two services as sharing a database when they both have `DATABASE_URL=postgresql://localhost:5432/mydb` in their `.env` files. If this is intentional (not recommended in production), you can disable shared DB detection:
```bash
mesa analyze -r ./svc-a -r ./svc-b --no-shared-db
```

**Cyclic dependency false positive:** Some architectures intentionally have bidirectional communication (though it is generally discouraged). MESA will flag it — this is correct behavior. Consider whether the cycle should be broken.

---

### Report shows "0 services analyzed"

You may have passed a wrong path:

```bash
# Wrong — passing a file instead of a directory
mesa analyze -r ./user-service/app.py

# Right — pass the directory
mesa analyze -r ./user-service
```

Also check that the directory contains source code files (`.py`, `.java`, or `.js`/`.ts`).

---

## 15. FAQ

**Q: Does MESA run my code?**
No. MESA performs **static analysis** — it reads the source code as text and analyzes it without executing anything.

**Q: Does MESA send my code to the internet?**
No. All analysis is performed locally on your machine. The only internet activity is cloning remote repositories when you provide GitHub URLs.

**Q: Can MESA analyze proprietary/private code?**
Yes. MESA runs entirely locally. For private GitHub repos, ensure your Git credentials are set up.

**Q: What if my service uses gRPC instead of REST?**
MESA v1.0 supports REST/HTTP communication only. gRPC support is out of scope for this version.

**Q: Can MESA analyze microservices in Docker or Kubernetes?**
MESA analyzes source code, not running containers. You can point MESA at the source code directories of your containerized services.

**Q: My services use service mesh (Istio/Linkerd) — does that affect MESA?**
No. MESA analyzes source-level HTTP calls, not network traffic. Service mesh configuration is not parsed.

**Q: How long does analysis take?**
For most microservices projects (5–20 services):
- Local directories: a few seconds to 1 minute
- Cloning from GitHub: depends on repo size, typically 30 seconds to 5 minutes

**Q: Can I analyze all services in a monorepo?**
Yes. If your monorepo has services in subdirectories, pass each subdirectory:
```bash
mesa analyze \
  -r ./services/user-service \
  -r ./services/order-service \
  -r ./services/payment-service
```
Or use a `mesa.yaml` config file to list all of them.

**Q: What does "unresolved call" mean?**
MESA found an HTTP call in the source code but could not determine which of your analyzed services it targets. This often happens with calls to external APIs (payment gateways, email services) or when URLs are fully dynamic. These are not counted in anti-pattern detection.

**Q: Can MESA analyze a single microservice?**
Yes, but most detectors require at least 2 services. If you analyze one service alone:
- Chatty Service: No findings (needs pairs)
- Cyclic Dependency: No findings (no other services to form a cycle with)
- Shared Database: No findings (needs another service with the same DB)

**Q: How do I interpret an F1-score?**
F1-score ranges from 0.0 to 1.0. For context:
- 0.9+ is excellent
- 0.8–0.9 is very good
- 0.7–0.8 is good (acceptable for static analysis tools)
- Below 0.7 indicates the tool needs improvement

---

*MESA v1.0.0 — User Guide*  
*For issues and contributions, see the project repository.*
