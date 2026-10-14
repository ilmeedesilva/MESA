"""Regenerate the Chapter 4 thesis diagrams (Figures 4.1-4.4, 4.11, 4.12).

Figures are drawn at their printed size in inches, so a 9 pt font in the
figure is 9 pt on the page. Output: PNG (300 dpi) and SVG in
dissertation_output/figures/.

    python tools/thesis_diagrams.py
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle

OUT = Path(__file__).resolve().parents[1] / "dissertation_output" / "figures"

FONT = "Arial"
BODY = 9
TITLE = 9.5
LABEL = 8.5
LINE_H = BODY * 1.28 / 72  # inches per text line

INK = "#1f2933"
MUTED = "#52606d"
LANE_BG = "#f5f7fa"
FILL = {
    "input": "#e3effb",
    "process": "#e4f4e7",
    "model": "#fff1d6",
    "analysis": "#efe6fa",
    "store": "#eceff3",
    "external": "#ffffff",
}

plt.rcParams.update({"font.family": FONT, "svg.fonttype": "none"})


class Diagram:
    def __init__(self, width: float, height: float):
        self.w, self.h = width, height
        self.fig = plt.figure(figsize=(width, height))
        self.ax = self.fig.add_axes([0, 0, 1, 1])
        self.ax.set_xlim(0, width)
        self.ax.set_ylim(0, height)
        self.ax.axis("off")

    # y is measured from the top of the figure for readability
    def Y(self, y: float) -> float:
        return self.h - y

    def lane(self, top: float, height: float, label: str, x0: float = 0.08, x1: float | None = None,
             vertical_label: bool = True):
        x1 = self.w - 0.08 if x1 is None else x1
        self.ax.add_patch(Rectangle((x0, self.Y(top + height)), x1 - x0, height,
                                    facecolor=LANE_BG, edgecolor="#cbd2d9", lw=0.8, zorder=0))
        if vertical_label:
            self.ax.text(x0 + 0.15, self.Y(top + height / 2), label, rotation=90, ha="center",
                         va="center", fontsize=TITLE, fontweight="bold", color=INK)
        else:
            self.ax.text((x0 + x1) / 2, self.Y(top + 0.17), label, ha="center", va="center",
                         fontsize=TITLE, fontweight="bold", color=INK)

    def box(self, x: float, y: float, w: float, h: float, title: str, body: str = "",
            kind: str = "process", dashed: bool = False, number: str | None = None):
        self.ax.add_patch(FancyBboxPatch(
            (x, self.Y(y + h)), w, h, boxstyle="round,pad=0,rounding_size=0.06",
            facecolor=FILL[kind], edgecolor=INK, lw=0.9, ls=(0, (4, 2)) if dashed else "-", zorder=2))
        chars = max(8, int((w - 0.14) * 72 / (BODY * 0.52)))
        t_lines = textwrap.wrap(title, chars, break_long_words=False, break_on_hyphens=False)
        b_lines = textwrap.wrap(body, chars, break_long_words=False) if body else []
        n = len(t_lines) + len(b_lines)
        needed = n * LINE_H + 0.12 + (0.04 if b_lines else 0)
        if needed > h + 1e-6:
            print(f"  ! box '{title}' needs {needed:.2f} in, has {h:.2f} in")
        cy = y + h / 2 - (n * LINE_H + (0.04 if b_lines else 0)) / 2 + LINE_H / 2
        for line in t_lines:
            self.ax.text(x + w / 2, self.Y(cy), line, ha="center", va="center", fontsize=TITLE,
                         fontweight="bold", color=INK, zorder=3)
            cy += LINE_H
        cy += 0.04 if b_lines else 0
        for line in b_lines:
            self.ax.text(x + w / 2, self.Y(cy), line, ha="center", va="center", fontsize=BODY,
                         color=INK, zorder=3)
            cy += LINE_H
        if number:
            self.ax.text(x + 0.05, self.Y(y + 0.05), number, ha="left", va="top", fontsize=8,
                         fontweight="bold", color="white", zorder=4,
                         bbox=dict(boxstyle="circle,pad=0.18", fc=INK, ec="none"))
        return (x, y, w, h)

    def line(self, pts, label: str | None = None, label_at: int = 0, arrow: bool = True,
             dashed: bool = False, label_side: str = "center"):
        """Polyline through pts (x, y-from-top); arrowhead on the last segment."""
        P = [(px, self.Y(py)) for px, py in pts]
        ls = (0, (4, 2)) if dashed else "-"
        for (ax_, ay), (bx, by) in zip(P[:-2], P[1:-1]):
            self.ax.plot([ax_, bx], [ay, by], color=INK, lw=1.0, ls=ls, zorder=1,
                         solid_capstyle="butt")
        (sx, sy), (ex, ey) = P[-2], P[-1]
        if arrow:
            self.ax.annotate("", xy=(ex, ey), xytext=(sx, sy), zorder=1,
                             arrowprops=dict(arrowstyle="-|>,head_length=0.45,head_width=0.22",
                                             color=INK, lw=1.0, ls=ls, shrinkA=0, shrinkB=0))
        else:
            self.ax.plot([sx, ex], [sy, ey], color=INK, lw=1.0, ls=ls, zorder=1)
        if label:
            (lx0, ly0), (lx1, ly1) = P[label_at], P[label_at + 1]
            mx, my = (lx0 + lx1) / 2, (ly0 + ly1) / 2
            if label_side == "above":
                self.ax.text(mx, my + 0.05, label, ha="center", va="bottom", fontsize=LABEL,
                             style="italic", color=INK, zorder=5)
                return
            ha = {"center": "center", "right": "left", "left": "right"}[label_side]
            dx = {"center": 0, "right": 0.06, "left": -0.06}[label_side]
            self.ax.text(mx + dx, my, label, ha=ha, va="center", fontsize=LABEL, style="italic",
                         color=INK, zorder=5,
                         bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none")
                         if label_side == "center" else None)

    def legend(self, items, y: float, x: float = 0.2):
        """items: list of (kind | 'arrow' | 'dashed', text)."""
        for kind, text in items:
            if kind in ("arrow", "dashed"):
                self.ax.annotate("", xy=(x + 0.4, self.Y(y)), xytext=(x, self.Y(y)),
                                 arrowprops=dict(arrowstyle="-|>,head_length=0.45,head_width=0.22",
                                                 color=INK, lw=1.0,
                                                 ls=(0, (4, 2)) if kind == "dashed" else "-"))
                tx = x + 0.48
            else:
                self.ax.add_patch(FancyBboxPatch((x, self.Y(y) - 0.08), 0.3, 0.16,
                                                 boxstyle="round,pad=0,rounding_size=0.03",
                                                 facecolor=FILL[kind], edgecolor=INK, lw=0.8))
                tx = x + 0.38
            t = self.ax.text(tx, self.Y(y), text, ha="left", va="center", fontsize=LABEL, color=INK)
            self.fig.canvas.draw()
            bb = t.get_window_extent().transformed(self.ax.transData.inverted())
            x = bb.x1 + 0.3

    def save(self, name: str):
        OUT.mkdir(parents=True, exist_ok=True)
        self.fig.savefig(OUT / f"{name}.png", dpi=300)
        self.fig.savefig(OUT / f"{name}.svg")
        plt.close(self.fig)
        print(f"wrote {name}")


# Shared four-column grid for portrait figures
COL_X = [0.55, 2.03, 3.51, 4.99]
COL_W = 1.36


def cx(i: int) -> float:
    return COL_X[i] + COL_W / 2


def fig_4_1():
    d = Diagram(6.5, 7.8)
    # lanes: (top, height)
    L1, L2, L3, L4 = (0.1, 1.35), (1.95, 1.75), (4.2, 1.0), (5.7, 1.75)
    d.lane(*L1, "Input")
    d.lane(*L2, "Processing")
    d.lane(*L3, "Representation")
    d.lane(*L4, "Analysis and evaluation")

    r1 = L1[0] + 0.2
    d.box(COL_X[0], r1, COL_W, 1.0, "Microservice repository", "local path, ZIP archive or GitHub URL", "input")
    d.box(COL_X[1], r1, COL_W, 1.0, "Repository preview", "manifest counts, warnings, candidates", "input")
    d.line([(COL_X[0] + COL_W, r1 + 0.5), (COL_X[1], r1 + 0.5)])

    r2 = L2[0] + 0.2
    titles = [("Repository ingestion", "validation, extraction, path resolution"),
              ("Service discovery", "confidence-scored service candidates"),
              ("Static fact extraction", "endpoints, calls, databases, libraries, env vars, brokers"),
              ("Relationship construction", "API-call and shared-database relationships")]
    for i, (t, b) in enumerate(titles):
        d.box(COL_X[i], r2, COL_W, 1.35, t, b, "process")
        if i:
            d.line([(COL_X[i - 1] + COL_W, r2 + 0.675), (COL_X[i], r2 + 0.675)])
    d.line([(cx(0), r1 + 1.0), (cx(0), r2)], "selected source")
    d.line([(cx(1), r1 + 1.0), (cx(1), r2)], "confirmed services")

    r3 = L3[0] + 0.2
    d.box(COL_X[0], r3, COL_W * 2 - 0.25, 0.6, "In-memory architecture graph", "NetworkX MultiDiGraph", "model")
    d.box(COL_X[2] + 0.37, r3, COL_W * 2 - 0.25, 0.6, "Persistent graph", "Neo4j, one graph per scan", "model")
    d.line([(COL_X[0] + COL_W * 2 - 0.25, r3 + 0.3), (COL_X[2] + 0.37, r3 + 0.3)], "persisted", label_side="above")
    mid = (L2[0] + L2[1] + L3[0]) / 2
    d.line([(cx(3), r2 + 1.35), (cx(3), mid), (cx(0) + 0.3, mid), (cx(0) + 0.3, r3)], "service graph",
           label_at=1)

    r4 = L4[0] + 0.2
    titles = [("Anti-pattern detection", "chatty, cyclic, shared database, hard-coded, God Service"),
              ("Evidence and confidence", "evidence chains, why-valid reasoning, confidence"),
              ("Governance and fitness", "policies, health scores, architecture gate"),
              ("Outputs", "findings, scores, roadmap, evolution, research records")]
    for i, (t, b) in enumerate(titles):
        d.box(COL_X[i], r4, COL_W, 1.35, t, b, "analysis")
        if i:
            d.line([(COL_X[i - 1] + COL_W, r4 + 0.675), (COL_X[i], r4 + 0.675)])
    d.line([(cx(0), r3 + 0.6), (cx(0), r4)], "detector input")
    d.legend([("input", "Input"), ("process", "Processing"), ("model", "Representation"),
              ("analysis", "Analysis"), ("arrow", "Data flow")], y=7.62)
    d.save("figure_4_1_solution_overview")


def fig_4_2():
    # Landscape: columns are layers, rows align the arrows so none cross a box.
    d = Diagram(9.3, 7.7)
    cols = ["External inputs", "Presentation", "API and orchestration", "Analysis core", "Data stores"]
    cw, gap, x0 = 1.34, 0.6, 0.12
    X = [x0 + i * (cw + gap) for i in range(5)]
    top, row_h, row_gap = 0.55, 0.98, 0.15
    R = [top + i * (row_h + row_gap) for i in range(6)]
    for i, name in enumerate(cols):
        d.lane(0.1, 7.15, name, x0=X[i] - 0.06, x1=X[i] + cw + 0.06, vertical_label=False)

    def span(r0, r1):
        return R[r0], R[r1] + row_h - R[r0]

    # External inputs
    d.box(X[0], R[0], cw, row_h, "Researcher / user", "", "external")
    d.box(X[0], R[1], cw, row_h, "Repository inputs", "local path, archive, GitHub URL, service paths", "input")
    d.box(X[0], R[4], cw, row_h, "Benchmark fixtures", "ground_truth.yml, tests/fixtures", "input")
    # Presentation
    y, h = span(0, 1)
    d.box(X[1], y, cw, h, "React + TypeScript frontend",
          "project selection, scan workflow, findings, graph, roadmap, research views", "process")
    d.box(X[1], R[4], cw, row_h, "Typer CLI", "mesa analyze, gate, evaluate", "process")
    # API
    y, h = span(0, 1)
    d.box(X[2], y, cw, h, "FastAPI REST API",
          "projects, scans, policies, graph queries, research records", "process")
    d.box(X[2], R[2], cw, row_h, "Scan orchestration", "prepare, preview, resolve paths, async jobs", "process")
    d.box(X[2], R[3], cw, row_h, "Assessment orchestration", "policies, roadmap, gate, evolution", "process")
    d.box(X[2], R[5], cw, row_h, "AI explainer endpoints", "optional, advisory only", "process")
    # Analysis core: container + vertical chain
    d.ax.add_patch(FancyBboxPatch((X[3] - 0.04, d.Y(R[4] + row_h + 0.06)), cw + 0.08, R[4] + row_h + 0.06 - (R[1] - 0.06),
                                  boxstyle="round,pad=0,rounding_size=0.06", facecolor="none",
                                  edgecolor=MUTED, lw=0.8, ls=(0, (2, 2)), zorder=1))
    chain = [("Ingestion and discovery", "prepare repository, find services"),
             ("Static extraction", "Python AST, JS/TS and Java patterns, config scanning"),
             ("Graph builder", "NetworkX MultiDiGraph"),
             ("Detection and scoring", "5 detectors, health, recommendations")]
    for i, (t, b) in enumerate(chain):
        d.box(X[3], R[i + 1], cw, row_h, t, b, "analysis")
        if i:
            d.line([(X[3] + cw / 2, R[i] + row_h), (X[3] + cw / 2, R[i + 1])])
    # Persistence and external
    d.box(X[4], R[0], cw, row_h, "PostgreSQL", "projects, scans, findings, scores, snapshots", "store")
    d.box(X[4], R[3], cw, row_h, "Neo4j", "scan-scoped architecture graph", "store")
    d.box(X[4], R[5], cw, row_h, "LLM API", "OpenAI or Anthropic, optional", "external", dashed=True)

    def mid(r):
        return R[r] + row_h / 2

    d.line([(X[0] + cw, mid(0)), (X[1], mid(0))], "uses", label_side="above")
    d.line([(X[0] + cw, mid(1)), (X[1], mid(1))], "source", label_side="above")
    d.line([(X[0] + cw, mid(4)), (X[1], mid(4))], "evaluate", label_side="above")
    d.line([(X[1] + cw, R[0] + 0.5 * (2 * row_h + row_gap)), (X[2], R[0] + 0.5 * (2 * row_h + row_gap))],
           "HTTP /\nJSON", label_side="above")
    d.line([(X[2] + cw, mid(0)), (X[4], mid(0))], "store and read records")
    d.line([(X[2] + cw / 2, R[1] + row_h), (X[2] + cw / 2, R[2])])
    d.line([(X[2] + cw, mid(2)), (X[3] - 0.04, mid(2))], "service\npaths", label_side="above")
    d.line([(X[3] - 0.04, mid(3)), (X[2] + cw, mid(3))], "result", label_side="above")
    d.line([(X[1] + cw, mid(4)), (X[3] - 0.04, mid(4))], "direct call")
    d.line([(X[3] + cw, mid(3)), (X[4], mid(3))], "scan\ngraph", label_side="above")
    d.line([(X[2] + cw, mid(5)), (X[4], mid(5))], "evidence package", dashed=True)
    d.legend([("input", "Input"), ("process", "Presentation / API"), ("analysis", "Analysis"),
              ("store", "Data store"), ("arrow", "Request or data flow"),
              ("dashed", "Optional external call")], y=7.5)
    d.save("figure_4_2_system_architecture")


def fig_4_3():
    d = Diagram(6.5, 6.9)
    lanes = [(0.1, 1.85, "Input and preparation"), (2.3, 1.85, "Extraction and graph"),
             (4.5, 1.85, "Analysis and results")]
    for t, h, name in lanes:
        d.lane(t, h, name)
    bh = 1.45
    row1 = [("Repository source", "local path, ZIP archive or GitHub URL"),
            ("Prepare repository", "validate source, clone or extract, resolve sub-directory"),
            ("Discover services", "manifests, entry points, frameworks, Docker, OpenAPI"),
            ("Preview and confirm services", "user confirms or edits the discovered services")]
    row2 = [("extract_service_facts", "endpoints, HTTP calls, database strings, env vars, brokers, hard-coded URLs"),
            ("ServiceFacts", "language, root path, files, calls, endpoints, databases"),
            ("build_graph", "service and database nodes; api_call, uses_database, shared_database edges")]
    row3 = [("Detectors", "chatty, cyclic, shared database, hard-coded, God Service"),
            ("Health scoring", "service, domain and system scores"),
            ("Governance and recommendations", "policy violations, remediation, roadmap"),
            ("Outputs", "AnalysisResult, API responses, CLI report, stored scans")]
    y1 = lanes[0][0] + 0.2
    for i, (t, b) in enumerate(row1):
        d.box(COL_X[i], y1, COL_W, bh, t, b, "input", number=str(i + 1))
        if i:
            d.line([(COL_X[i - 1] + COL_W, y1 + bh / 2), (COL_X[i], y1 + bh / 2)])
    # row 2 runs right-to-left over three wider boxes
    w2 = (COL_X[3] + COL_W - COL_X[0] - 2 * 0.25) / 3
    X2 = [COL_X[3] + COL_W - w2 - i * (w2 + 0.25) for i in range(3)]
    y2 = lanes[1][0] + 0.2
    for i, (t, b) in enumerate(row2):
        d.box(X2[i], y2, w2, bh, t, b, "process", number=str(i + 5))
        if i:
            d.line([(X2[i - 1], y2 + bh / 2), (X2[i] + w2, y2 + bh / 2)])
    d.line([(cx(3), y1 + bh), (cx(3), y2)], "selected service paths", label_side="center")
    y3 = lanes[2][0] + 0.2
    for i, (t, b) in enumerate(row3):
        d.box(COL_X[i], y3, COL_W, bh, t, b, "analysis", number=str(i + 8))
        if i:
            d.line([(COL_X[i - 1] + COL_W, y3 + bh / 2), (COL_X[i], y3 + bh / 2)])
    d.line([(cx(0), y2 + bh), (cx(0), y3)], "architecture graph")
    d.legend([("input", "Preparation"), ("process", "Extraction"), ("analysis", "Analysis"),
              ("arrow", "Order of steps (numbered)")], y=6.65)
    d.save("figure_4_3_analysis_pipeline")


def fig_4_4():
    d = Diagram(6.5, 8.3)
    n, gap = 5, 0.13
    x0, x1 = 0.55, 6.35
    w = (x1 - x0 - (n - 1) * gap) / n
    X = [x0 + i * (w + gap) for i in range(n)]
    lanes = [(0.1, 1.45, "Repository evidence"), (2.0, 1.45, "Extracted elements"),
             (3.9, 1.95, "Graph model"), (6.3, 1.5, "Analysis uses")]
    for t, h, name in lanes:
        d.lane(t, h, name)

    def row(lane, items, kind, h):
        y = lane[0] + 0.2
        for i, (t, b) in enumerate(items):
            d.box(X[i], y, w, h, t, b, kind)
        return y

    y1 = row(lanes[0], [("Source code", "Python, JS/TS, Java, Go"),
                         ("Configuration", ".env, YAML, properties, Docker Compose"),
                         ("API descriptions", "OpenAPI / Swagger"),
                         ("Dependency manifests", "requirements.txt, package.json, pom.xml"),
                         ("Text evidence", "URLs, hosts, ports, DB strings")], "input", 1.05)
    y2 = row(lanes[1], [("Services", "name, language, root path, files"),
                         ("Endpoints", "method, path, file and line"),
                         ("Service calls", "caller, target hint, URL"),
                         ("Databases and brokers", "normalised key, type"),
                         ("Metadata", "libraries, env vars, domain keywords, hard-coded URLs")], "process", 1.15)

    def bus(y_from, y_to, label, into_x=None, into_y=None, fan_out=False):
        yb = (y_from + y_to) / 2
        if not fan_out:
            for i in range(n):
                d.line([(X[i] + w / 2, y_from), (X[i] + w / 2, yb)], arrow=False)
            d.line([(X[0] + w / 2, yb), (X[-1] + w / 2, yb)], arrow=False)
            d.line([(into_x, yb), (into_x, into_y)], label, label_side="right")
        else:
            d.line([(into_x, y_from), (into_x, yb)], label, arrow=False, label_side="right")
            d.line([(X[0] + w / 2, yb), (X[-1] + w / 2, yb)], arrow=False)
            for i in range(n):
                d.line([(X[i] + w / 2, yb), (X[i] + w / 2, y_to)])

    yb = (y1 + 1.05 + y2) / 2
    for i in range(n):
        d.line([(X[i] + w / 2, y1 + 1.05), (X[i] + w / 2, yb)], arrow=False)
    d.line([(X[0] + w / 2, yb), (X[-1] + w / 2, yb)], arrow=False)
    for i in range(n):
        d.line([(X[i] + w / 2, yb), (X[i] + w / 2, y2)])
    d.ax.text(X[0] + w + gap / 2, d.Y(yb - 0.05), "static extraction", ha="center", va="bottom", fontsize=LABEL,
              style="italic", color=INK)
    y3 = lanes[2][0] + 0.2
    gw = X[3] - 0.15 - x0
    d.box(x0, y3, gw, 1.55, "NetworkX MultiDiGraph (in memory)",
          "Nodes: service, database.  Edges: api_call, uses_database, shared_database.  "
          "Attributes: endpoint_count, database_count, file_count, domain_keywords, "
          "hard_coded_dependencies, source_location.", "model")
    d.box(X[3] + 0.4, y3 + 0.35, x1 - X[3] - 0.4, 0.85, "Neo4j scan graph",
          "persistent, queryable digital twin", "store")
    d.line([(x0 + gw, y3 + 0.775), (X[3] + 0.4, y3 + 0.775)], "persist", label_side="above")
    bus(y2 + 1.15, y3, "build_graph", into_x=X[1] + w / 2, into_y=y3)
    y4 = lanes[3][0] + 0.2
    row(lanes[3], [("Detector input", "graph plus service evidence"),
                   ("Graph queries", "paths, cycles, centrality, shared DBs"),
                   ("Health scoring", "service, domain, system"),
                   ("Governance", "policy metrics per system and service"),
                   ("Scan outputs", "findings, scores, roadmap, evolution")], "analysis", 1.1)
    bus(y3 + 1.55, y4, "graph input", into_x=X[1] + w / 2, fan_out=True)
    d.legend([("input", "Evidence"), ("process", "Extracted fact"), ("model", "Graph model"),
              ("store", "Store"), ("analysis", "Consumer")], y=8.15)
    d.save("figure_4_4_architecture_representation")


def fig_4_11():
    d = Diagram(6.5, 6.75)
    lanes = [(0.1, 1.5, "Evidence base"), (2.05, 1.75, "Rule-based detection"),
             (4.25, 2.0, "Findings and remediation")]
    for t, h, name in lanes:
        d.lane(t, h, name)
    x0, x1 = 0.55, 6.35

    def xs(n, gap=0.13):
        w = (x1 - x0 - (n - 1) * gap) / n
        return [x0 + i * (w + gap) for i in range(n)], w

    X3, w3 = xs(3)
    y1 = lanes[0][0] + 0.2
    for i, (t, b) in enumerate([("Architecture graph", "service nodes, api_call and shared-database edges"),
                                ("Service metrics", "endpoints, inbound and outbound deps, databases, files, domain keywords"),
                                ("Source evidence", "files, lines, URLs, config values, connection strings")]):
        d.box(X3[i], y1, w3, 1.1, t, b, "input")
    X5, w5 = xs(5)
    y2 = lanes[1][0] + 0.2
    for i, (t, b) in enumerate([("Chatty Service", "API call sites per source-target pair vs threshold"),
                                ("Cyclic Dependency", "cycles in the projected call graph"),
                                ("Shared Database", "services grouped by normalised DB key"),
                                ("Hard-Coded Dependency", "literal URLs, hosts, private IPs, ports"),
                                ("God Service", "weighted score: APIs, deps, DBs, files, centrality")]):
        d.box(X5[i], y2, w5, 1.35, t, b, "analysis")
    # evidence bus -> every detector
    yb = (y1 + 1.1 + y2) / 2
    for i in range(3):
        d.line([(X3[i] + w3 / 2, y1 + 1.1), (X3[i] + w3 / 2, yb)], arrow=False)
    d.line([(X5[0] + w5 / 2, yb), (X5[-1] + w5 / 2, yb)], arrow=False)
    for i in range(5):
        d.line([(X5[i] + w5 / 2, yb), (X5[i] + w5 / 2, y2)])
    d.ax.text((X3[0] + X3[1] + w3) / 2, d.Y(yb - 0.05), "same evidence to every detector", ha="center",
              va="bottom", fontsize=LABEL, style="italic", color=INK)
    X4, w4 = xs(4, gap=0.25)
    y3 = lanes[2][0] + 0.2
    for i, (t, b) in enumerate([("Finding", "id, type, severity, affected services, description"),
                                ("Evidence ledger", "evidence chain, confidence reason, limitations"),
                                ("Recommendation enrichment", "root cause, refactoring steps, priority, difficulty"),
                                ("Result summary", "findings by type and severity, God Service scores")]):
        d.box(X4[i], y3, w4, 1.55, t, b, "model")
        if i:
            d.line([(X4[i - 1] + w4, y3 + 0.775), (X4[i], y3 + 0.775)])
    yb2 = (y2 + 1.35 + y3) / 2
    for i in range(5):
        d.line([(X5[i] + w5 / 2, y2 + 1.35), (X5[i] + w5 / 2, yb2)], arrow=False)
    d.line([(X5[0] + w5 / 2, yb2), (X5[-1] + w5 / 2, yb2)], arrow=False)
    d.line([(X4[0] + w4 / 2, yb2), (X4[0] + w4 / 2, y3)], "findings", label_side="right")
    d.legend([("input", "Evidence"), ("analysis", "Detector"), ("model", "Finding output"),
              ("arrow", "Data flow")], y=6.55)
    d.save("figure_4_11_detection")


def fig_4_12():
    d = Diagram(6.5, 6.45)
    lanes = [(0.1, 1.6, "Inputs"), (2.15, 1.6, "Engines"),
             (4.2, 1.75, "Outputs")]
    for t, h, name in lanes:
        d.lane(t, h, name)
    x0, x1, gap = 0.55, 6.35, 0.45
    w = (x1 - x0 - 2 * gap) / 3
    X = [x0 + i * (w + gap) for i in range(3)]
    y1 = lanes[0][0] + 0.2
    inputs = [("Findings and graph metrics", "severity counts, inbound and outbound dependencies, shared DBs"),
              ("Finding set", "critical findings, new cycles, high-risk coupling"),
              ("Policy definitions", "YAML or JSON rules with system and service metrics")]
    engines = [("Health score engine", "nine weighted dimensions; service, domain, system scores"),
               ("Architecture fitness gate", "minimum health 75.0, max critical findings 0, cycle, governance and coupling rules"),
               ("Governance policy engine", "parse rule, measure metric, compare actual with expected")]
    outputs = [("Health assessment", "HealthScore: score, grade, breakdown, recommendations"),
               ("Gate result", "PASSED or FAILED, failed rules, thresholds, baseline comparison"),
               ("Governance output", "policy-violation findings, each with its evidence")]
    y2 = lanes[1][0] + 0.2
    y3 = lanes[2][0] + 0.2
    for i in range(3):
        d.box(X[i], y1, w, 1.2, *inputs[i], "input")
        d.box(X[i], y2, w, 1.2, *engines[i], "analysis")
        d.box(X[i], y3, w, 1.35, *outputs[i], "model")
        d.line([(X[i] + w / 2, y1 + 1.2), (X[i] + w / 2, y2)])
        d.line([(X[i] + w / 2, y2 + 1.2), (X[i] + w / 2, y3)])
    d.line([(X[0] + w, y2 + 0.6), (X[1], y2 + 0.6)], "score", label_side="above")
    d.line([(X[2], y2 + 0.6), (X[1] + w, y2 + 0.6)], "violations", label_side="above")
    d.legend([("input", "Measured evidence"), ("analysis", "Engine"), ("model", "Output"),
              ("arrow", "Data flow")], y=6.25)
    d.save("figure_4_12_governance")


if __name__ == "__main__":
    for f in (fig_4_1, fig_4_2, fig_4_3, fig_4_4, fig_4_11, fig_4_12):
        f()
