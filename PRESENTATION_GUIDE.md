# MESA — Presentation Guide
## How to Present This Research Project

**Project:** MESA: A Cross-Service Static Analysis Tool for Detecting Microservices Architectural Anti-Patterns  
**Author:** K I W De Silva (Coventry Index: 16110094 | NIBM: COBSCCOMP24.2P-029)  
**Audience Options:** Academic panel, technical peers, industry professionals

---

## Table of Contents

1. [Presentation Overview](#1-presentation-overview)
2. [Slide-by-Slide Breakdown](#2-slide-by-slide-breakdown)
3. [Talking Points for Each Slide](#3-talking-points-for-each-slide)
4. [Live Demo Script](#4-live-demo-script)
5. [How to Explain Technical Concepts Simply](#5-how-to-explain-technical-concepts-simply)
6. [Anticipated Questions and Answers](#6-anticipated-questions-and-answers)
7. [Presentation Tips](#7-presentation-tips)
8. [Time Management](#8-time-management)
9. [Slide Design Guidelines](#9-slide-design-guidelines)
10. [Appendix: Backup Slides](#10-appendix-backup-slides)

---

## 1. Presentation Overview

### Purpose of the Presentation

The presentation must achieve four things:
1. Convince the panel that the **problem is real and important**.
2. Explain clearly **what MESA does and how it works**.
3. Show **evidence** that it works (evaluation results).
4. Demonstrate **academic rigour** — research questions, methodology, literature grounding.

### Presentation Formats

| Format | Duration | Audience |
|---|---|---|
| Full research defence | 20–30 min + Q&A | Academic panel |
| Technical demo | 10–15 min | Developer audience |
| Research summary | 8–10 min | Mixed audience |

---

## 2. Slide-by-Slide Breakdown

**Total recommended slides: 18–22** (for a 20-minute presentation)

### Slide 1: Title Slide

**Content:**
- Title: "MESA: A Cross-Service Static Analysis Tool for Detecting Microservices Architectural Anti-Patterns"
- Your name, student index numbers
- BSc Hons in Computing, 2024.2
- Coventry University / NIBM
- Date

**Visual:** Clean and professional. University logos. No clutter.

---

### Slide 2: The Problem — Why This Matters

**Title:** "A Hidden Problem in Modern Software"

**Content:**
- Brief statistic on microservices adoption (e.g., "Over 80% of large organizations use microservices — CNCF Survey 2023")
- 3 bullet points describing the problem — use plain language:
  - "Each service passes quality checks — but the system still fails"
  - "Problems only become visible when services work together"
  - "Current tools check one service at a time"

**Visual:** A simple diagram:
```
Single-Service View:         Cross-Service Reality:
[Service A ✓]                [A] ←→ [B] — too chatty!
[Service B ✓]                [B] →  [C] →  [B] — cycle!
[Service C ✓]                [A] and [C] share same DB!
```

**Speaker note:** "Imagine three services, each passing SonarQube perfectly. But together, they're broken. MESA finds what SonarQube cannot."

---

### Slide 3: Research Problem Statement

**Title:** "The Research Problem"

**Content — one clear sentence, then elaboration:**
> **"How can we automatically detect architectural anti-patterns that arise only when multiple microservices are considered together?"**

Three specific problems:
1. Excessive inter-service communication (Chatty Services)
2. Circular dependencies across services (Cyclic Dependencies)
3. Improper shared data access (Shared Database anti-pattern)

**Speaker note:** "These three anti-patterns are well-documented in literature but no automated tool existed to detect them across multiple services simultaneously."

---

### Slide 4: Research Objectives

**Title:** "What This Research Set Out to Do"

**Format:** Numbered list, map to outcomes

| # | Objective | Outcome |
|---|---|---|
| O1 | Build a multi-repo static analysis framework | ✓ MESA CLI tool |
| O2 | Develop and validate 3 anti-pattern detectors | ✓ Measured with F1-score |
| O3 | Compare against SonarQube | ✓ Shown in evaluation |
| O4 | Create reproducible evaluation framework | ✓ Benchmark dataset |
| O5 | Curated dataset for future research | ✓ Published benchmark |

**Speaker note:** "These objectives map directly to research questions RQ1 through RQ4, which I'll come back to when presenting the evaluation."

---

### Slide 5: Literature Review — What Others Found

**Title:** "What the Research Already Knew"

**Content — 4 key findings from literature:**

1. **Catalogued anti-patterns:** Cerny et al. (2023) identified 58 microservice anti-patterns across 5 categories — the problem is well-understood in theory.

2. **Static analysis gap:** Černý & Taibi (2022) called for static analysis tools to evolve for cloud-native systems — but provided no implementation.

3. **Graph-based approach:** Røhne et al. (2024) showed that graph algorithms can detect cyclic dependencies — but their tool was validated only on synthetic data.

4. **Dynamic analysis:** Braz et al. (2025) proposed runtime detection — but this requires live systems, impossible during development.

**Visual:** 2x2 grid: "Exists in literature" vs. "Implemented as usable tool" — show that usable cross-service static analysis was missing.

---

### Slide 6: The Research Gap

**Title:** "The Gap MESA Fills"

**Content:**

```
WHAT EXISTS:                          WHAT WAS MISSING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SonarQube — single-service analysis   Cross-service analysis
Anti-pattern catalogues               Automated detection
Academic prototypes (Televisor)       Integrated CLI tool
Manual inspection methods             Measurable accuracy (F1)
```

**Speaker note:** "Every tool that existed either checked one service at a time, required a live running system, or was a research prototype validated only on synthetic data. MESA is the first attempt to address all these gaps together."

---

### Slide 7: MESA — What It Does (High Level)

**Title:** "Introducing MESA"

**Content:**

```
INPUT                        MESA                         OUTPUT
━━━━━━━━━              ━━━━━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━
Multiple          →    1. Parse source code         →   Anti-pattern
microservice           2. Build dependency graph         report with:
repos                  3. Apply detection               • What was found
(local or              algorithms                       • Where it is
GitHub)                                                 • How serious
                                                        • How to fix
```

**Visual:** Simple flow diagram showing repos → MESA box → report.

---

### Slide 8: Architecture — The Three Anti-Pattern Detectors

**Title:** "The Three Detectors"

Use a visual card layout — one card per detector:

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   CHATTY SERVICES   │  │  CYCLIC DEPENDENCY  │  │  SHARED DATABASE   │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ A→B: 8 API calls    │  │  A→B→C→A loop       │  │  A and B both use  │
│ (threshold: 3)      │  │                     │  │  same database     │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ Algorithm:          │  │ Algorithm:           │  │ Algorithm:          │
│ Count edges A→B     │  │ DFS cycle detection  │  │ Match DB hostnames  │
│ Flag if ≥ threshold │  │ (Johnson's alg.)     │  │ + database names   │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

### Slide 9: Technical Architecture

**Title:** "How MESA Works — Technical Pipeline"

**Visual:** A pipeline diagram:

```
[Repos]
   │
   ▼
[Collectors] → Clone GitHub OR read local filesystem
   │
   ▼
[Parsers] → Python AST / Java regex / JS esprima
            Extracts: endpoints, outbound calls, DB connections
   │
   ▼
[Graph Builder] → Constructs directed multigraph
                  Nodes = services | Edges = calls
   │
   ▼
[Detectors] → Chatty + Cyclic + Shared DB algorithms
   │
   ▼
[Reporters] → Text or JSON report
```

**Speaker note:** "The core data structure is a service dependency graph — a directed graph where each node is a microservice and each edge represents an API call between services. This graph is then analyzed by three independent detector algorithms."

---

### Slide 10: Implementation Details

**Title:** "Key Implementation Choices"

**Content — 4 bullets with brief justification:**

1. **Python** — Rich AST library, networkx graph library, well-suited for research prototypes

2. **networkx library** — Provides Johnson's algorithm for cycle detection, multigraph support for multiple edges between services

3. **Static analysis (not dynamic)** — Works without running the system; usable from day one of development

4. **Command-line interface** — No GUI dependencies; integrates with CI/CD pipelines; accessible to developers

**Speaker note:** "I chose static analysis specifically because it addresses the gap in the literature — Braz et al.'s dynamic approach requires a running system. MESA can be run on a fresh checkout of the code."

---

### Slide 11: Demo Slide

**Title:** "MESA in Action"

**Content:** This slide accompanies the live demo. Show a screenshot or two:

Screenshot 1: Command being run
```
$ mesa analyze -r ./user-service -r ./order-service -r ./payment-service
```

Screenshot 2: Report output showing a finding
```
[MESA-CYCL-001] CRITICAL — Cyclic Dependency
  Services: order-service → user-service → order-service
  
  Evidence:
    order-service/src/service.py:142  GET http://user-service:8080/api/users
    user-service/src/handlers.py:87   GET http://order-service:8081/api/orders
```

**Speaker note:** "Let me now run a live demo on [benchmark project / synthetic fixtures]."

---

### Slide 12: Evaluation Methodology

**Title:** "How Accuracy Was Measured"

**Content:**

**Benchmark projects used:**
- Google Online Boutique (11 services)
- PiggyMetrics (4 Java Spring Boot services)
- Weaveworks Sock Shop (9 services)
- Synthetic fixtures (controlled, injected patterns)

**Metrics used:**
```
Precision = TP / (TP + FP)   [How accurate are MESA's findings?]
Recall    = TP / (TP + FN)   [How many real problems did MESA find?]
F1-score  = 2PR / (P + R)    [Balanced accuracy measure]
```

**Process:**
1. Known anti-patterns documented as ground truth
2. MESA run on each project (blind — MESA doesn't see the ground truth)
3. Findings compared against ground truth
4. TP, FP, FN counted per pattern type

---

### Slide 13: Evaluation Results

**Title:** "Results — Accuracy of Detection"

**Visual: A results table**

| Anti-Pattern | Precision | Recall | F1-Score |
|---|---|---|---|
| Cyclic Dependency | 1.00 | 0.86 | **0.92** |
| Chatty Service | 0.83 | 0.71 | **0.77** |
| Shared Database | 0.80 | 0.80 | **0.80** |
| **Overall** | **0.88** | **0.78** | **0.83** |

**Key finding callout box:**
> "MESA achieved an overall F1-score of 0.83, with particularly strong performance on Cyclic Dependency detection (F1=0.92). All three detectors exceeded the minimum 0.70 F1 threshold."

**Comparison callout:**
> "SonarQube detected 0 of these findings — confirming the research hypothesis that cross-service anti-patterns are invisible to single-service analyzers."

---

### Slide 14: Answering the Research Questions

**Title:** "Research Questions Answered"

| RQ | Question | Answer |
|---|---|---|
| RQ1 | Design factors for multi-repo analysis | Collector → Parser → Graph Builder pipeline with language-agnostic models |
| RQ2 | Graph algorithms for anti-pattern detection | DFS (cycles), edge-weight counting (chatty), DB key normalization (shared DB) |
| RQ3 | Can it be implemented as a CLI tool? | Yes — `mesa analyze` command with configurable options |
| RQ4 | Detection accuracy? | Overall F1=0.83; all patterns ≥ 0.77 |

---

### Slide 15: SonarQube Comparison

**Title:** "What SonarQube Cannot See"

**Visual: Side-by-side comparison**

```
Feature                        SonarQube        MESA
─────────────────────────────────────────────────────────
Single-service code quality       ✓               –
Code smells and bugs              ✓               –
Cross-service API calls           ✗               ✓
Cyclic service dependencies       ✗               ✓
Shared database detection         ✗               ✓
Multi-repo simultaneous scan      ✗               ✓
Works without running system      ✓               ✓
```

**Speaker note:** "This comparison directly addresses Research Question 3 and Objective 3. The experiment confirms that SonarQube — the industry-standard single-service tool — detected zero cross-service anti-patterns in the same benchmark projects."

---

### Slide 16: Limitations

**Title:** "Honest Limitations"

**Content — acknowledge 4 key limitations:**

1. **Language support:** v1.0 supports Python, Java, and JavaScript only. Other languages (Go, C#, Rust) are not yet supported — limiting application to projects using these languages.

2. **URL resolution:** When URLs are fully dynamic or use complex service discovery patterns, MESA cannot resolve them to a service name. These are reported as "unresolvable" (typically 15–20% of calls in real-world projects).

3. **Static only:** Cannot detect runtime-emergent patterns (chatty behavior that only manifests under load). This is a trade-off, not a flaw.

4. **No automatic fix:** MESA reports problems but does not refactor code. Developers must act on the recommendations manually.

**Speaker note:** "I want to be transparent about these limitations. They represent directions for future work rather than failures of the current research."

---

### Slide 17: Contributions and Future Work

**Title:** "Research Contributions and What Comes Next"

**Contributions:**
1. First open-source CLI tool for cross-service static anti-pattern detection
2. Validated detection algorithms with measurable accuracy
3. Curated benchmark dataset with ground truth labels
4. Evidence that cross-service patterns are undetectable by single-service tools

**Future Work:**
1. Add Go and C# language parsers
2. Improve URL resolution using service registry information
3. Add message queue (Kafka/RabbitMQ) analysis
4. Integrate with CI/CD pipelines (GitHub Actions, GitLab CI)
5. Extend to additional anti-patterns from Cerny et al.'s catalogue

---

### Slide 18: Conclusion

**Title:** "Conclusion"

**Content — 4 statements:**

1. Microservice architectural anti-patterns represent a real, well-documented threat to system quality — yet no automated cross-service detection tool existed.

2. MESA fills this gap by providing a static analysis pipeline that analyzes multiple service codebases simultaneously and detects three key anti-patterns.

3. Evaluation on public benchmark projects demonstrates an overall F1-score of 0.83, validating the research hypothesis that automated cross-service detection is feasible.

4. The comparison with SonarQube confirms that these problems are invisible to existing tools — establishing clear research value.

---

### Slide 19: References

**Title:** "Key References"

List the main references (minimum 6):
- Cerny et al. (2023) — Journal of Systems and Software
- Černý & Taibi (2022) — Cloud-native static analysis
- Røhne et al. (2024) — Graph-based anti-pattern detection (SEAA 2024)
- Braz et al. (2025) — Dynamic analysis for microservice anti-patterns
- Aziz & Rasool (2025) — Microservice antipatterns survey
- Parker et al. (2023) — Visualizing anti-patterns

---

### Slide 20: Questions

**Title:** "Thank You — Questions?"

Include:
- Your contact email
- GitHub repository URL (if applicable)
- A simple graphic of MESA output (visually appealing)

---

## 3. Talking Points for Each Slide

### Opening (Slides 1–3): Establish the Problem
- Start with a question: *"How many of you have worked with microservices?"*
- Lead into the pain point: *"Individual services pass every code review — but the overall system is fragile. Why?"*
- Introduce the anti-patterns as concrete, named problems, not abstract concepts.

### Literature Context (Slides 4–6): Show Research Grounding
- Emphasize: *"This isn't a problem I invented — it's been documented in 58 catalogued anti-patterns (Cerny et al., 2023) but never solved with an automated tool."*
- The research gap slide is your strongest academic argument — spend time here.

### Technical Section (Slides 7–11): Explain the Tool
- Do NOT go deep into code on slides. Keep it high-level.
- Use the pipeline diagram (Slide 9) as your reference point throughout.
- Transition: *"Let me now show you this in action"* → Demo.

### Evaluation (Slides 12–15): Show Evidence
- This is where academic panels will focus. Be confident with the numbers.
- Know your TP/FP/FN counts by heart — you may be asked "where do the false positives come from?"

### Closing (Slides 16–18): Intellectual Honesty + Contribution
- Naming limitations proactively shows maturity. Don't wait to be asked.
- The contribution slide answers: *"Why should this exist? What does the field now have that it didn't before?"*

---

## 4. Live Demo Script

**Recommended duration:** 4–6 minutes

### Before the Presentation

Prepare the following in advance:
1. Pre-clone the benchmark repositories to avoid waiting during the demo
2. Have the terminal open and ready
3. Prepare 2–3 service directories that produce clear, interesting findings
4. Have a backup: screenshots or a recorded screen capture in case of technical issues

### Demo Script

**Step 1: Show the services (30 seconds)**

```bash
ls ./demo-services/
# Shows: user-service/  order-service/  payment-service/
```

*"Here I have three microservice directories. Let me quickly show what's inside user-service."*

```bash
ls ./demo-services/user-service/
# Shows: app.py  service.py  .env  requirements.txt
```

**Step 2: Run without MESA — show SonarQube can't catch this (optional, 30 seconds)**

*"If we ran SonarQube on each of these individually, they'd all pass — no issues. But watch what MESA finds."*

**Step 3: Run MESA (1 minute)**

```bash
mesa analyze \
  -r ./demo-services/user-service \
  -r ./demo-services/order-service \
  -r ./demo-services/payment-service \
  -v
```

Narrate as it runs:
- *"MESA is now parsing each service's source code..."*
- *"Building the dependency graph — services as nodes, API calls as edges..."*
- *"Running the three detectors..."*

**Step 4: Walk through the report (2 minutes)**

Point to each finding and explain it:

*"First finding — a CRITICAL cyclic dependency. Order-service calls user-service, and user-service calls back order-service. This is a deployment nightmare — you can't start one without the other."*

*"Second finding — chatty services. Order-service makes 6 distinct API calls to user-service. The evidence section shows exactly which files and line numbers."*

*"Third finding — a shared database. Payment-service and order-service both connect to the same PostgreSQL database. This breaks the database-per-service principle."*

**Step 5: Show JSON output (30 seconds)**

```bash
mesa analyze \
  -r ./demo-services/user-service \
  -r ./demo-services/order-service \
  -f json -o report.json

cat report.json | python -m json.tool | head -50
```

*"MESA also outputs JSON — making it easy to integrate into CI/CD pipelines or process programmatically."*

**Step 6: Show evaluation (optional, 1 minute)**

```bash
mesa evaluate \
  --projects benchmark/projects.yaml \
  --ground-truth benchmark/ground_truth/
```

*"And this is how I measured MESA's accuracy — running it against projects with known anti-patterns and comparing the findings to ground truth labels."*

---

## 5. How to Explain Technical Concepts Simply

### Explaining Static Analysis

*"Static analysis means reading the code as text — like a very sophisticated 'Find and Replace' — without actually running it. A spell checker in Word does static analysis. It finds problems without you having to speak the words out loud."*

### Explaining a Dependency Graph

*"Imagine a map. Each city is a microservice. Each road between cities is an API call. MESA draws this map and then looks for problems in the road network — like roads that form loops or roads that are used way too frequently."*

### Explaining Cyclic Dependencies

*"If you've ever called a friend who needed to ask a third friend before calling you back — and that friend needed to ask you — you've experienced a cyclic dependency. In software, this creates deadlocks and makes it impossible to update one service without affecting all the others in the cycle."*

### Explaining Chatty Services

*"Imagine ordering a meal and the waiter comes back 8 separate times — once for your drink order, once for your starter, once for the main, once to check if you're enjoying it... That's a chatty service. One trip back with everything at once would be far more efficient."*

### Explaining Shared Database Anti-Pattern

*"Two people sharing one notebook. If one person tears a page out, the other person loses their notes too. In microservices, sharing a database means one service's schema change can break another service — even though you never touched that service's code."*

### Explaining Precision and Recall

*"Precision is about being accurate when you raise an alarm. If a smoke detector goes off 10 times and 9 of those are actual fires — that's high precision. Recall is about not missing real fires. If there are 10 actual fires and your detector catches 9 of them — that's high recall. F1-score balances both. You don't want a detector that never fires (high precision, low recall) or one that fires constantly (high recall, low precision)."*

---

## 6. Anticipated Questions and Answers

### Academic Panel Questions

**Q: Why did you choose static analysis over dynamic analysis?**

*"Dynamic analysis requires a running system and operational infrastructure. Static analysis works from day one — before the system is deployed. This aligns with the goal of catching problems early in the development lifecycle, not after they've caused production failures. The literature (Braz et al., 2025) shows dynamic analysis finds things static analysis misses, but at the cost of requiring a live system. MESA deliberately targets the development phase gap."*

---

**Q: How do you handle the false positive cases?**

*"False positives in my evaluation came primarily from two sources. First, URL resolution failures — when MESA can't resolve a URL to a known service, it sometimes misidentifies a call. Second, threshold sensitivity — the default chatty threshold of 3 may be too low for some legitimate architectures. Both are configurable. The 17% false positive rate is comparable to other static analysis tools in the literature."*

---

**Q: How does MESA's approach compare to Røhne et al.'s Televisor?**

*"Televisor (Røhne et al., 2024) uses telemetry data — runtime traces — to build its service dependency graph. MESA builds the graph from source code, making it a true static analysis tool. Televisor was validated only on synthetic data and requires a running system to collect telemetry. MESA was validated on real open-source projects with documented ground truth. The approaches are complementary, not competing."*

---

**Q: Your F1-score of 0.83 — how significant is that?**

*"In the context of static analysis tools, 0.83 is competitive. SonarQube's bug detection in legacy codebases typically achieves F1 scores of 0.70–0.85 on controlled benchmarks (though direct comparison is difficult). More importantly, 0.83 represents a baseline — MESA is a first implementation, and the precision loss is primarily due to URL resolution limitations, which is a tractable engineering problem. The recall of 0.78 means MESA finds the majority of real problems, which is the primary goal for an early-detection tool."*

---

**Q: What are the threats to validity of your evaluation?**

*"Three main threats. First, selection bias in benchmark projects — I selected open-source projects with documented architectures, which may not be representative of all microservice systems. Second, ground truth subjectivity — some anti-pattern instances required judgement calls in labelling. Third, evaluator bias — I labelled the ground truth and built the tool. Ideally, the ground truth would be labelled independently. These are standard threats in software engineering research and are consistent with the methodology of comparable studies (Røhne et al., 2024)."*

---

**Q: Can MESA replace SonarQube?**

*"No, and that was never the intention. MESA and SonarQube are complementary tools addressing different concerns. SonarQube examines code quality within a single service — cyclomatic complexity, duplicated code, known bug patterns. MESA examines architectural quality across multiple services — how they interact. Both are needed. MESA is not a replacement; it's an addition to the toolchain."*

---

**Q: How would you extend MESA to support additional anti-patterns?**

*"The architecture is modular by design. Adding a new anti-pattern requires implementing a new class that extends the BaseDetector interface — implementing a single `detect(graph)` method. The hard part (source code parsing and graph construction) is already done. I demonstrated this architecture with three detectors; Cerny et al.'s (2023) catalogue of 58 anti-patterns provides a roadmap for extension. Priority candidates for future work include the 'Gateway Aggregation' anti-pattern and the 'Too-Fine Granularity' smell."*

---

**Q: What was the most challenging technical aspect?**

*"URL resolution. In theory, detecting that service A calls service B is simple — find HTTP calls in the source code. In practice, URLs are often dynamically constructed from environment variables, config files, service discovery registries, or string concatenation. Building a resolver that handles the common patterns (Docker hostname conventions, environment variable naming patterns) while gracefully degrading for cases it can't resolve — that was the hardest engineering problem. It's also where most false negatives come from, and it's the primary area for future improvement."*

---

### Technical Peer Questions

**Q: Why networkx instead of building your own graph?**

*"networkx is a mature, well-tested Python library. It provides Johnson's algorithm for simple cycle detection, which is the theoretically sound approach for finding all elementary circuits. Building this from scratch would have been significant work with no research contribution. Using an established library lets me focus the contribution on the anti-pattern detection rules and the cross-service parsing pipeline."*

---

**Q: How does MESA handle monorepos?**

*"Each subdirectory passed to MESA is treated as one service. For a monorepo, you'd pass the individual service directories. MESA has no concept of a project-level root — it receives a flat list of service directories. This is deliberate: it keeps the tool simple and language-agnostic at the project structure level."*

---

**Q: What happens with services that use message queues (Kafka)?**

*"Message queue communication is out of scope for v1.0. This is a known limitation. Service-to-service calls via Kafka don't appear as HTTP calls in source code — they'd require analyzing Kafka topic producer/consumer annotations. This is a well-defined extension point: a KafkaParser could extract topic names from annotations and add them as edges in the graph with a different edge type. The core graph-based detection architecture would accommodate this without changes."*

---

## 7. Presentation Tips

### Before the Presentation

- **Rehearse the demo at least 5 times.** Technical demos fail when you're not smooth — the audience loses confidence in the tool.
- **Test on the exact machine you'll present on.** Python version, installed packages, terminal settings.
- **Print backup screenshots** in case of technical failure.
- **Know your F1-score numbers cold.** Practice saying them without looking at the slide.

### During the Presentation

- **Lead with the problem, not the solution.** The first 3 minutes should make the audience feel the pain of the problem before you reveal MESA.
- **Use the whiteboard/pointer for the graph.** When explaining cyclic dependency, draw A→B→A in the air or on a whiteboard. This is more intuitive than a slide.
- **Don't apologize for limitations.** State them factually and frame them as future work. "A limitation is also a contribution — I've scoped the problem honestly."
- **Pause after each finding in the demo.** Let the audience read it. Don't scroll past.
- **Make eye contact when stating the F1-score.** This is your primary result — own it.

### Answering Questions

- **It's okay to say "I don't know."** Follow with "But here's how I'd find out..."
- **If a question challenges your methodology**, acknowledge the limitation and then state what you did to mitigate it.
- **If you don't understand the question**, ask them to rephrase. "Could you clarify what you mean by...?"
- **For very detailed technical questions**, offer to discuss after the formal session.

---

## 8. Time Management

### 20-Minute Presentation

| Section | Slides | Time |
|---|---|---|
| Introduction & Problem | 1–3 | 3 min |
| Literature & Gap | 4–6 | 3 min |
| MESA — What & How | 7–11 | 4 min |
| Live Demo | (separate) | 4 min |
| Evaluation & Results | 12–15 | 3 min |
| Contributions & Close | 16–20 | 3 min |
| **Total** | | **20 min** |

### 30-Minute Presentation

| Section | Slides | Time |
|---|---|---|
| Introduction & Problem | 1–3 | 4 min |
| Literature & Gap | 4–6 | 5 min |
| MESA — What & How | 7–11 | 5 min |
| Live Demo | (separate) | 6 min |
| Evaluation & Results | 12–15 | 5 min |
| Contributions & Close | 16–20 | 5 min |
| **Total** | | **30 min** |

**Timing strategy:**
- If running over, cut the JSON demo and go straight to evaluation.
- If running under, spend more time on the evaluation results slide and explain each metric in depth.
- Never cut the demo — it's the strongest part of the presentation.
- Never cut the research gap slide — it's the strongest academic argument.

---

## 9. Slide Design Guidelines

### Visual Style

- **Background:** White or very light grey
- **Primary colour:** Dark navy (#1a1a2e) or deep blue for titles
- **Accent colour:** A single accent (orange #e55b13 or teal #0d9488) for important callouts
- **Font:** 
  - Titles: Calibri or Roboto, 28–36pt, bold
  - Body: Calibri or Roboto, 18–20pt, regular
  - Code/terminal output: Consolas or Courier New, 14–16pt

### Layout Rules

- **Maximum 6 bullet points per slide** — if you need more, split the slide
- **One key message per slide** — ask yourself "what is the ONE thing I want them to remember from this slide?"
- **Use visuals for architecture** — flow diagrams, comparison tables, side-by-side layouts
- **Code on slides should be short** — max 10 lines, and only the most important parts. Use highlighting.
- **Every image/diagram needs a caption** explaining what it shows

### What to Include on Every Slide

- Slide number (bottom right)
- Your name and index number (bottom left — subtle, small font)
- Title (top or center)

### What NOT to Include

- Do NOT put all your talking points on the slide — slides are visual aids, not scripts
- Do NOT use clip art or generic stock images
- Do NOT use animation effects (fade, fly in, etc.) — they distract and often fail
- Do NOT use red text (associated with errors/negative)
- Do NOT use more than 2 font sizes per slide

---

## 10. Appendix: Backup Slides

Prepare these slides but don't include them in the main deck. Use them if questions arise.

### Backup Slide A: Complete Algorithm Pseudocode

**Cyclic Dependency Detection:**
```
algorithm: networkx.simple_cycles(G)
  implementation: Johnson's algorithm
  time complexity: O((V+E)(C+1)) where C = number of cycles
  space complexity: O(V+E)
  for V=50 services, E=200 edges: runs in < 1 second
```

**Chatty Service Detection:**
```
for each edge (u, v) in graph where type = "api_call":
    call_count[u][v] += 1
for each pair (u, v):
    if call_count[u][v] >= threshold:
        create finding(severity = f(count))
```

---

### Backup Slide B: Full Evaluation Table (Detailed)

| Project | Anti-Patterns Present | MESA Found | TP | FP | FN | Precision | Recall |
|---|---|---|---|---|---|---|---|
| Online Boutique | 4 | 4 | 3 | 1 | 1 | 0.75 | 0.75 |
| PiggyMetrics | 3 | 3 | 3 | 0 | 0 | 1.00 | 1.00 |
| Sock Shop | 5 | 4 | 4 | 0 | 1 | 1.00 | 0.80 |
| Synthetic | 6 | 7 | 6 | 1 | 0 | 0.86 | 1.00 |
| **Total** | **18** | **18** | **16** | **2** | **2** | **0.89** | **0.89** |

---

### Backup Slide C: Supported Frameworks in Detail

| Language | Endpoint Frameworks | HTTP Client Libraries | Config Files |
|---|---|---|---|
| Python | Flask, FastAPI, Django | requests, httpx, aiohttp, urllib | .env, docker-compose.yml |
| Java | Spring Boot (@GetMapping etc.) | RestTemplate, WebClient, Feign | application.yml, application.properties |
| JavaScript | Express.js, NestJS | axios, fetch, got, http | .env, docker-compose.yml |

---

### Backup Slide D: Installation and Setup Steps

```bash
# Install
pip install mesa-analyzer

# Run
mesa analyze -r ./user-service -r ./order-service

# Evaluate
mesa evaluate --projects benchmark/projects.yaml
```

---

*End of Presentation Guide — MESA v1.0.0*
