import React from "react";
import { ApiError } from "./api";
import type {
  AIExplainerStatus,
  AggregatedEdge,
  AnalysisResult,
  AppSection,
  DigitalTwinGraph,
  DisplayGraph,
  Filters,
  Finding,
  GraphEdge,
  GraphNode,
  GraphSelection,
  HealthScore,
  PolicyRecord,
  ProjectRecord,
  ResearchEvaluationRecord,
  ScanRecord
} from "./types";

export const severityRank: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export function buildGraphElements(nodes: GraphNode[], edges: AggregatedEdge[]) {
  const positions = calculateArchitecturePositions(nodes, edges);
  const degreeByNode = calculateDegrees(edges);
  const maxDegree = Math.max(0, ...degreeByNode.values());

  return [
    ...nodes.map((node) => {
      const degree = degreeByNode.get(node.id) ?? 0;
      return {
        data: {
          id: node.id,
          label: node.label ?? formatNodeLabel(node.id, node.type),
          type: node.type ?? "service",
          serviceName: node.serviceName ?? node.id,
          risk: node.risk ?? "none",
          findingCount: node.findingCount ?? 0,
          healthScore: node.healthScore ?? 0,
          properties: node.properties ?? {},
          role: degree === maxDegree && degree > 0 && node.type === "service" ? "hub" : "node",
          weight: Math.min(14, degree)
        },
        position: positions.get(node.id) ?? { x: 0, y: 0 }
      };
    }),
    ...edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type ?? "depends",
        risk: edge.risk ?? "none",
        findingCount: edge.findingCount ?? 0,
        evidence: edge.evidence ?? {},
        count: edge.count
      }
    }))
  ];
}

export function calculateArchitecturePositions(nodes: GraphNode[], edges: AggregatedEdge[]) {
  const positions = new Map<string, { x: number; y: number }>();
  const serviceNodes = nodes.filter((node) => (node.type ?? "service") === "service").sort((a, b) => a.id.localeCompare(b.id));
  const serviceIds = serviceNodes.map((node) => node.id);
  const serviceIdByName = new Map(serviceNodes.map((node) => [node.serviceName ?? node.label ?? node.id, node.id]));
  const apiNodes = nodes.filter((node) => node.type === "api").sort((a, b) => a.id.localeCompare(b.id));
  const databaseNodes = nodes.filter((node) => node.type === "database").map((node) => node.id).sort();
  const supportNodes = nodes
    .filter((node) => !["service", "api", "database"].includes(node.type ?? "service"))
    .sort((a, b) => a.id.localeCompare(b.id));
  const degreeByNode = calculateDegrees(edges);
  const canvas = { width: 1420, height: 920 };
  const hub = [...serviceIds].sort((a, b) => {
    const degreeDelta = (degreeByNode.get(b) ?? 0) - (degreeByNode.get(a) ?? 0);
    return degreeDelta || a.localeCompare(b);
  })[0];

  if (!hub) return positions;

  const hubPosition = { x: canvas.width * 0.46, y: canvas.height * 0.52 };
  positions.set(hub, hubPosition);

  const inbound: string[] = [];
  const outbound: string[] = [];
  const satellites: string[] = [];

  for (const service of serviceIds.filter((item) => item !== hub)) {
    const callsHub = edges.some((edge) => edge.source === service && edge.target === hub);
    const calledByHub = edges.some((edge) => edge.source === hub && edge.target === service);
    if (callsHub && !calledByHub) {
      inbound.push(service);
    } else if (calledByHub) {
      outbound.push(service);
    } else {
      satellites.push(service);
    }
  }

  placeColumn(inbound.sort(), canvas.width * 0.16, 190, 700, positions);
  placeColumn(outbound.sort(), canvas.width * 0.82, 170, 750, positions);
  placeRow(satellites.sort(), canvas.width * 0.28, canvas.width * 0.68, 120, positions);

  const apisByService = groupNodesByService(apiNodes);
  for (const [service, apis] of apisByService) {
    const ownerPosition = positions.get(serviceIdByName.get(service) ?? service);
    if (!ownerPosition) continue;
    apis.forEach((api, index) => {
      positions.set(api.id, {
        x: clamp(ownerPosition.x + distribute(index, apis.length, -46, 46), 95, canvas.width - 95),
        y: clamp(ownerPosition.y - 112, 70, canvas.height - 115)
      });
    });
  }

  supportNodes.forEach((node, index) => {
    const ownerPosition = node.serviceName ? positions.get(serviceIdByName.get(node.serviceName) ?? node.serviceName) : null;
    positions.set(node.id, {
      x: ownerPosition ? clamp(ownerPosition.x - 120, 85, canvas.width - 85) : distribute(index, supportNodes.length, 130, canvas.width - 130),
      y: ownerPosition ? clamp(ownerPosition.y + 112, 110, canvas.height - 110) : canvas.height * 0.18
    });
  });

  const databaseOwners = new Map<string, string>();
  databaseNodes.forEach((database) => {
    const owner = ownerForDatabase(database, edges, nodes);
    if (owner) databaseOwners.set(database, owner);
  });

  databaseNodes.forEach((database, index) => {
    const owner = databaseOwners.get(database);
    const ownerPosition = owner ? positions.get(owner) : null;
    const fallbackX = distribute(index, databaseNodes.length, canvas.width * 0.2, canvas.width * 0.8);
    positions.set(database, {
      x: ownerPosition ? clamp(ownerPosition.x + 150, canvas.width * 0.12, canvas.width * 0.9) : fallbackX,
      y: ownerPosition ? clamp(ownerPosition.y + 155, canvas.height * 0.66, canvas.height * 0.92) : canvas.height * 0.84
    });
  });

  return positions;
}

export function groupNodesByService(nodes: GraphNode[]) {
  const grouped = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const service = node.serviceName;
    if (!service) continue;
    grouped.set(service, [...(grouped.get(service) ?? []), node]);
  }
  return grouped;
}

export function placeColumn(items: string[], x: number, yStart: number, yEnd: number, positions: Map<string, { x: number; y: number }>) {
  items.forEach((item, index) => {
    positions.set(item, { x, y: distribute(index, items.length, yStart, yEnd) });
  });
}

export function placeRow(items: string[], xStart: number, xEnd: number, y: number, positions: Map<string, { x: number; y: number }>) {
  items.forEach((item, index) => {
    positions.set(item, { x: distribute(index, items.length, xStart, xEnd), y });
  });
}

export function distribute(index: number, count: number, start: number, end: number) {
  if (count <= 1) return (start + end) / 2;
  return start + ((end - start) * index) / (count - 1);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateDegrees(edges: AggregatedEdge[]) {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + edge.count);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + edge.count);
  }
  return degrees;
}

export function ownerForDatabase(database: string, edges: AggregatedEdge[], nodes: GraphNode[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const owners = edges
    .filter((edge) => edge.target === database || edge.source === database)
    .map((edge) => (edge.target === database ? edge.source : edge.target))
    .filter((nodeId) => nodeById.get(nodeId)?.type === "service");
  return owners.sort()[0];
}

export function graphFromReport(result: AnalysisResult, scores: HealthScore[]): DisplayGraph {
  const nodes = result.graph.nodes.map((node) => {
    const type = node.type ?? "service";
    const serviceName = type === "service" ? node.id : node.serviceName;
    const linkedFindings = serviceName ? findingsForService(result.findings, serviceName) : [];
    const health = serviceName ? serviceHealthScore(scores, serviceName) : undefined;
    return {
      ...node,
      type,
      label: node.label ?? formatNodeLabel(node.id, type),
      serviceName,
      risk: riskFromFindings(linkedFindings, health),
      findingCount: linkedFindings.length,
      healthScore: health?.score,
      properties: { id: node.id, type }
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return {
    source: "scan-report",
    nodes,
    edges: result.graph.edges.map((edge) => enrichEdge(edge, result.findings, nodeById))
  };
}

export function graphFromDigitalTwin(twin: DigitalTwinGraph, result: AnalysisResult, scores: HealthScore[]): DisplayGraph {
  const rawNodeById = new Map(twin.nodes.map((node) => [node.element_id, node]));
  const apiCountsByService = new Map<string, number>();
  const apiBundleByRawId = new Map<string, string>();
  const nodes: GraphNode[] = [];

  for (const rawNode of twin.nodes) {
    const type = primaryGraphType(rawNode.labels);
    const serviceName = serviceNameForNode(type, rawNode.properties);
    if (type === "api" && serviceName) {
      apiCountsByService.set(serviceName, (apiCountsByService.get(serviceName) ?? 0) + 1);
      apiBundleByRawId.set(rawNode.element_id, `api:${serviceName}`);
      continue;
    }
    const node = nodeFromDigitalTwin(rawNode, result.findings, scores);
    if (node) nodes.push(node);
  }

  for (const [serviceName, count] of apiCountsByService) {
    const linkedFindings = findingsForService(result.findings, serviceName);
    const health = serviceHealthScore(scores, serviceName);
    nodes.push({
      id: `api:${serviceName}`,
      type: "api",
      label: `APIs (${count})`,
      serviceName,
      risk: riskFromFindings(linkedFindings, health),
      findingCount: linkedFindings.length,
      healthScore: health?.score,
      properties: { service: serviceName, api_count: count }
    });
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = twin.relationships
    .map((relationship) => {
      const source = apiBundleByRawId.get(relationship.source) ?? relationship.source;
      const target = apiBundleByRawId.get(relationship.target) ?? relationship.target;
      const sourceRaw = rawNodeById.get(relationship.source);
      const targetRaw = rawNodeById.get(relationship.target);
      return {
        source,
        target,
        sourceRaw,
        targetRaw,
        relationship
      };
    })
    .filter((item) => item.source !== item.target && nodeById.has(item.source) && nodeById.has(item.target))
    .map((item) => enrichEdge({
      source: item.source,
      target: item.target,
      type: normalizeRelationshipType(item.relationship.type),
      evidence: {
        ...item.relationship.properties,
        source_node_type: item.sourceRaw ? primaryGraphType(item.sourceRaw.labels) : undefined,
        target_node_type: item.targetRaw ? primaryGraphType(item.targetRaw.labels) : undefined
      }
    }, result.findings, nodeById));
  return { source: "digital-twin", nodes, edges };
}

export function isRenderableGraph(graph: DisplayGraph) {
  if (graph.nodes.length === 0) return false;
  return graph.nodes.some((node) => ["service", "api", "database"].includes(node.type ?? "service"));
}

export function preferredGraph(reportGraph: DisplayGraph, twinGraph: DisplayGraph) {
  if (!isRenderableGraph(twinGraph)) return reportGraph;
  return graphRichnessScore(twinGraph) >= graphRichnessScore(reportGraph) ? twinGraph : reportGraph;
}

export function graphRichnessScore(graph: DisplayGraph) {
  const importantNodes = graph.nodes.filter((node) =>
    ["service", "api", "database"].includes(node.type ?? "service")
  ).length;
  return importantNodes * 10 + graph.edges.length;
}

export function nodeFromDigitalTwin(
  node: DigitalTwinGraph["nodes"][number],
  findings: Finding[],
  scores: HealthScore[]
): GraphNode | null {
  const type = primaryGraphType(node.labels);
  if (type === "project") return null;
  const serviceName = serviceNameForNode(type, node.properties);
  const label = labelForDigitalTwinNode(type, node.properties, node.element_id);
  const linkedFindings = serviceName ? findingsForService(findings, serviceName) : [];
  const health = serviceName ? serviceHealthScore(scores, serviceName) : undefined;
  return {
    id: node.element_id,
    type,
    label,
    serviceName,
    risk: riskFromFindings(linkedFindings, health),
    findingCount: linkedFindings.length,
    healthScore: health?.score,
    properties: node.properties
  };
}

export function primaryGraphType(labels: string[]) {
  const label = labels.find((item) => item !== "ArchitectureNode") ?? labels[0] ?? "Service";
  const mapped: Record<string, string> = {
    Project: "project",
    Service: "service",
    API: "api",
    Database: "database",
    Config: "config",
    Library: "library",
    MessageBroker: "message_broker",
    EnvironmentVariable: "environment_variable"
  };
  return mapped[label] ?? label.toLowerCase();
}

export function serviceNameForNode(type: string, properties: Record<string, unknown>) {
  if (type === "service") return propertyString(properties, "name");
  return propertyString(properties, "service") ?? propertyString(properties, "owner") ?? propertyString(properties, "service_name");
}

export function labelForDigitalTwinNode(type: string, properties: Record<string, unknown>, fallback: string) {
  if (type === "api") {
    const method = propertyString(properties, "method");
    const path = propertyString(properties, "path") ?? propertyString(properties, "endpoint");
    return [method, path].filter(Boolean).join(" ") || "API";
  }
  if (type === "database") return databaseLabel(properties, fallback);
  if (type === "config") return propertyString(properties, "name") ?? propertyString(properties, "key") ?? "config";
  if (type === "library") return propertyString(properties, "name") ?? "library";
  if (type === "message_broker") return propertyString(properties, "name") ?? "broker";
  if (type === "environment_variable") return propertyString(properties, "name") ?? propertyString(properties, "key") ?? "env var";
  return propertyString(properties, "name") ?? propertyString(properties, "key") ?? formatNodeLabel(fallback, type);
}

export function databaseLabel(properties: Record<string, unknown>, fallback: string) {
  const value = propertyString(properties, "database") ?? propertyString(properties, "name") ?? propertyString(properties, "url") ?? fallback;
  return value.replace(/^db:/, "").split("/").pop() ?? value;
}

export function enrichEdge(edge: GraphEdge, findings: Finding[], nodeById: Map<string, GraphNode>): GraphEdge {
  const sourceNode = nodeById.get(edge.source);
  const targetNode = nodeById.get(edge.target);
  const sourceService = sourceNode?.serviceName ?? edge.source;
  const targetService = targetNode?.serviceName ?? edge.target;
  const linkedFindings = findingsForEdge(findings, sourceService, targetService, edge.type ?? "depends");
  return {
    ...edge,
    label: edge.label ?? formatEdgeLabel(edge.type ?? "depends", 1),
    risk: edgeRisk(edge.type ?? "depends", linkedFindings),
    findingCount: linkedFindings.length,
    evidence: edge.evidence ?? { source_location: edge.source_location }
  };
}

export function findingsForService(findings: Finding[], service: string) {
  return findings.filter((finding) => finding.services.includes(service));
}

export function findingsForEdge(findings: Finding[], sourceService: string, targetService: string, edgeType: string) {
  return findings.filter((finding) => {
    const hasBothServices = finding.services.includes(sourceService) && finding.services.includes(targetService);
    if (hasBothServices) return true;
    if (edgeType.includes("database")) return finding.type.includes("SHARED") || finding.type.includes("DATABASE");
    return false;
  });
}

export function serviceHealthScore(scores: HealthScore[], service: string) {
  return scores.find((score) => score.scope === "service" && score.target === service);
}

export function riskFromFindings(findings: Finding[], health?: HealthScore) {
  const highest = getHighestSeverity(findings);
  if (highest !== "None") return highest.toLowerCase();
  if (health && health.score < 40) return "high";
  if (health && health.score < 65) return "medium";
  return "none";
}

export function edgeRisk(edgeType: string, findings: Finding[]) {
  if (findings.length > 0) return getHighestSeverity(findings).toLowerCase();
  if (["shared_database", "shares_database_with"].includes(edgeType)) return "high";
  if (["hard_coded_dependency", "hard_coded_service_dependency"].includes(edgeType)) return "medium";
  return "none";
}

export function selectionForNode(data: Record<string, unknown>, findings: Finding[], scores: HealthScore[]): GraphSelection {
  const service = String(data.serviceName ?? data.id);
  const linkedFindings = findingsForService(findings, service);
  return {
    kind: "node",
    id: String(data.id),
    title: String(data.label ?? data.id),
    subtitle: `${formatType(String(data.type ?? "service"))}${service !== data.id ? ` owned by ${service}` : ""}`,
    properties: propertyRecord(data.properties),
    findings: linkedFindings,
    healthScore: serviceHealthScore(scores, service)
  };
}

export function selectionForEdge(data: Record<string, unknown>, nodes: GraphNode[], findings: Finding[]): GraphSelection {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const source = nodeById.get(String(data.source));
  const target = nodeById.get(String(data.target));
  const sourceService = source?.serviceName ?? source?.label ?? String(data.source);
  const targetService = target?.serviceName ?? target?.label ?? String(data.target);
  const linkedFindings = findingsForEdge(findings, sourceService, targetService, String(data.type ?? "depends"));
  return {
    kind: "edge",
    id: String(data.id),
    title: `${source?.label ?? sourceService} -> ${target?.label ?? targetService}`,
    subtitle: formatType(String(data.type ?? "dependency")),
    properties: propertyRecord(data.evidence),
    findings: linkedFindings
  };
}

export function propertyString(properties: Record<string, unknown>, key: string) {
  const value = properties[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function propertyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeRelationshipType(type: string) {
  return type.toLowerCase();
}

export function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={`code-${index}`} className="docsCodeBlock">
          <code data-language={language || undefined}>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push(<h3 key={`h3-${index}`}>{line.replace(/^###\s+/, "")}</h3>);
      index += 1;
      continue;
    }

    if (/^##\s+/.test(line)) {
      blocks.push(<h2 key={`h2-${index}`}>{line.replace(/^##\s+/, "")}</h2>);
      index += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      blocks.push(<h1 key={`h1-${index}`}>{line.replace(/^#\s+/, "")}</h1>);
      index += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^-\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !/^- /.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(paragraphLines.join(" "))}</p>);
  }

  return blocks;
}

export function renderInlineMarkdown(text: string) {
  const segments = text.split(/(`[^`]+`)/g);
  return segments.map((segment, index) => {
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return <code key={`${segment}-${index}`}>{segment.slice(1, -1)}</code>;
    }
    return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
  });
}

export function Metric({
  label,
  value,
  tone,
  detail,
  kind = "summary",
  featured = false,
  wide = false,
  detailLines = 3,
  expandableDetail = false,
  fullDetail
}: {
  label: string;
  value: string | number;
  tone?: string;
  detail?: string;
  kind?: "number" | "status" | "service" | "summary";
  featured?: boolean;
  wide?: boolean;
  detailLines?: 2 | 3 | 4 | 5 | 6;
  expandableDetail?: boolean;
  fullDetail?: string;
}) {
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const valueLength = String(value).length;
  const valueClassName = [
    "metricValue",
    `metricValue-${kind}`,
    valueLength > 18 ? "long" : "",
    valueLength > 30 ? "xlong" : ""
  ].filter(Boolean).join(" ");
  return (
    <article
      className={`metric ${tone ?? ""} ${featured ? "featured" : ""} ${wide ? "wide" : ""}`}
      title={typeof value === "string" ? value : undefined}
    >
      {kind === "service" ? (
        <code className={valueClassName}>{value}</code>
      ) : (
        <strong className={valueClassName}>{value}</strong>
      )}
      <span>{label}</span>
      {detail ? <small className={`detailLines-${detailLines}`} title={detail}>{detail}</small> : null}
      {expandableDetail && fullDetail ? (
        <>
          <button
            type="button"
            className="metricMoreButton"
            onClick={() => setIsDetailOpen((current) => !current)}
            aria-expanded={isDetailOpen}
          >
            {isDetailOpen ? "Hide detail" : "See more"}
          </button>
          {isDetailOpen ? (
            <div className="metricPopover" role="dialog" aria-label={`${label} detail`}>
              <div className="metricPopoverHeader">
                <strong>{label}</strong>
                <button type="button" className="metricPopoverClose" onClick={() => setIsDetailOpen(false)}>
                  Close
                </button>
              </div>
              <div className="metricPopoverBody">
                <p>{fullDetail}</p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}

export function aggregateEdges(edges: GraphEdge[]): AggregatedEdge[] {
  const grouped = new Map<string, AggregatedEdge>();
  for (const edge of edges) {
    const type = edge.type ?? "depends";
    const key = `${edge.source}::${edge.target}::${type}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.findingCount = Math.max(existing.findingCount ?? 0, edge.findingCount ?? 0);
      existing.risk = strongerRisk(existing.risk, edge.risk);
      existing.label = formatEdgeLabel(type, existing.count, existing.risk, existing.findingCount);
      continue;
    }
    grouped.set(key, {
      ...edge,
      id: key,
      count: 1,
      label: formatEdgeLabel(type, 1, edge.risk, edge.findingCount)
    });
  }
  return [...grouped.values()];
}

export function filterFindings(findings: Finding[], filters: Filters) {
  return findings.filter((finding) => {
    if (filters.type !== "ALL" && finding.type !== filters.type) return false;
    if (filters.severity !== "ALL" && finding.severity !== filters.severity) return false;
    if (filters.service !== "ALL" && !finding.services.includes(filters.service)) return false;
    return finding.confidence >= filters.minConfidence;
  });
}

export function buildFilterOptions(findings: Finding[]) {
  return {
    types: [...new Set(findings.map((finding) => finding.type))].sort(),
    severities: [...new Set(findings.map((finding) => finding.severity))].sort((a, b) => severityRank[b] - severityRank[a]),
    services: [...new Set(findings.flatMap((finding) => finding.services))].sort()
  };
}

export function comparisonBaseScan(history: ScanRecord[], activeScanId: string) {
  const index = history.findIndex((scan) => scan.id === activeScanId);
  if (index === -1) return null;
  return history[index + 1] ?? history[index - 1] ?? null;
}

export function aiStatusLabel(state: AIExplainerStatus["state"]) {
  return {
    GROUNDED_ONLY: "Grounded-only mode",
    MISSING_API_KEY: "Missing API key",
    PLACEHOLDER_API_KEY: "Placeholder API key",
    INVALID_API_KEY: "Invalid API key",
    MODEL_UNAVAILABLE: "Model unavailable",
    ACCESS_DENIED: "Access denied",
    CONNECTION_ERROR: "Connection problem",
    READY: "Live AI ready"
  }[state];
}

export function aiStatusTone(state: AIExplainerStatus["state"]) {
  if (state === "READY") return "good";
  if (state === "GROUNDED_ONLY") return "neutral";
  if (state === "CONNECTION_ERROR" || state === "MODEL_UNAVAILABLE") return "medium";
  return "high";
}

export function aiAnswerProvider(source?: string) {
  if (source?.startsWith("openai-hybrid")) {
    return { label: "Answered by OpenAI", tone: "good" };
  }
  if (source?.includes("fallback")) {
    return { label: "Answered by MESA fallback", tone: "high" };
  }
  return { label: "Answered by MESA", tone: "neutral" };
}

export function servicePathsFromText(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function policyDocumentFromRecords(policies: PolicyRecord[]) {
  const lines = ["policies:"];
  for (const policy of policies) {
    lines.push(`  - id: ${policy.id}`);
    lines.push(`    name: ${policy.name}`);
    lines.push(`    rule: ${policy.rule}`);
    lines.push(`    severity: ${policy.severity.toLowerCase()}`);
    lines.push(`    enabled: ${policy.enabled ? "true" : "false"}`);
    if (policy.description) lines.push(`    description: ${policy.description}`);
  }
  return lines.join("\n") + "\n";
}

export function normalizeResearchRecordPayload(record: ResearchEvaluationRecord) {
  return {
    scan_id: record.scan_id ?? null,
    repo_name: record.repo_name,
    repo_url: emptyToNull(record.repo_url),
    commit_ref: emptyToNull(record.commit_ref),
    scan_date: emptyToNull(record.scan_date),
    project_type: emptyToNull(record.project_type),
    expected_services: record.expected_services ?? null,
    detected_services: record.detected_services,
    expected_patterns: emptyToNull(record.expected_patterns),
    detected_patterns: emptyToNull(record.detected_patterns),
    total_findings: record.total_findings,
    critical_findings: record.critical_findings,
    high_findings: record.high_findings,
    medium_findings: record.medium_findings,
    low_findings: record.low_findings,
    true_positives: record.true_positives ?? null,
    false_positives: record.false_positives ?? null,
    false_negatives: record.false_negatives ?? null,
    notes: emptyToNull(record.notes),
    limitations: emptyToNull(record.limitations),
    research_relevance: emptyToNull(record.research_relevance),
    suitable_for_report: record.suitable_for_report
  };
}

export function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function draftMetricPreview(record: ResearchEvaluationRecord) {
  const tp = record.true_positives;
  const fp = record.false_positives;
  const fn = record.false_negatives;
  if (tp === null || tp === undefined || fp === null || fp === undefined || fn === null || fn === undefined) {
    return { precision: null, recall: null, f1: null };
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;
  return { precision, recall, f1 };
}

export function averageMetric(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === "number");
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

export function formatMetricValue(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "N/A";
  return value <= 1 ? value.toFixed(4) : String(value);
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readProjectIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("project") ?? "";
}

export function readSectionFromUrl(): AppSection {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("section");
  if (value === "services" || value === "policies") return "scan";
  const knownSections = new Set<AppSection>([
    "overview",
    "scan",
    "findings",
    "graph",
    "history",
    "evolution",
    "roadmap",
    "ai",
    "evaluation",
    "benchmarks",
    "docs"
  ]);
  return value && knownSections.has(value as AppSection) ? (value as AppSection) : "overview";
}

export function syncAppStateToUrl(
  projectId: string,
  section: AppSection,
  historyMode: "push" | "replace" = "replace"
) {
  const url = new URL(window.location.href);
  if (projectId) {
    url.searchParams.set("project", projectId);
  } else {
    url.searchParams.delete("project");
  }
  if (section !== "overview") {
    url.searchParams.set("section", section);
  } else {
    url.searchParams.delete("section");
  }
  window.history[historyMode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

export function resolveProjectSelection(projects: ProjectRecord[], currentProjectId: string, preferredProjectId = "") {
  if (currentProjectId && projects.some((project) => project.id === currentProjectId)) {
    return currentProjectId;
  }
  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }
  return projects[0]?.id ?? "";
}

export function isAbortError(caught: unknown) {
  return caught instanceof DOMException && caught.name === "AbortError";
}

export function isNotFoundError(caught: unknown) {
  return caught instanceof ApiError && caught.status === 404;
}

export function flattenScores(scores?: AnalysisResult["summary"]["health_scores"]): HealthScore[] {
  if (!scores) return [];
  return [scores.system, ...scores.domain, ...scores.service].filter(Boolean);
}

export function formatEdgeLabel(type: string, count: number, risk = "none", findingCount = 0) {
  if (risk === "critical") return findingCount > 0 ? `${findingCount} risks` : "critical";
  if (risk === "high") return findingCount > 0 ? `${findingCount} risks` : "high risk";
  const compactLabels: Record<string, string> = {
    api_call: "api",
    calls: "call",
    depends_on: "depends",
    shared_database: "shared db",
    shares_database_with: "shared db",
    uses_database: "db",
    reads_from: "db read",
    writes_to: "db write"
  };
  const shouldLabel = ["shared_database", "shares_database_with", "uses_database", "reads_from", "writes_to"].includes(type) || count > 2;
  if (!shouldLabel) return "";
  const label = compactLabels[type] ?? type.replace(/_/g, " ");
  return count > 1 ? `${label} x${count}` : label;
}

export function strongerRisk(current = "none", next = "none") {
  const rank: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return (rank[next] ?? 0) > (rank[current] ?? 0) ? next : current;
}

export function formatNodeLabel(id: string, type?: string) {
  if (type !== "database") return id;
  const database = id.split("/").pop()?.replace(/^db:/, "") ?? id.replace(/^db:/, "");
  return `${database} db`;
}

export function plainLanguageFindingTitle(finding: Finding) {
  const titles: Record<string, string> = {
    GOD_SERVICE: "A service is doing too much",
    CHATTY_SERVICE: "Two services are talking too often",
    SHARED_DATABASE: "Multiple services rely on the same database",
    HARD_CODED_SERVICE_URL: "A service dependency is hard coded",
    DEPENDENCY_CYCLE: "Services depend on each other in a loop"
  };
  return titles[finding.type] ?? formatType(finding.type);
}

export function summaryFindingTitle(finding: Finding) {
  const titles: Record<string, string> = {
    GOD_SERVICE: "Overloaded service",
    CHATTY_SERVICE: "Chatty service flow",
    SHARED_DATABASE: "Shared database risk",
    HARD_CODED_SERVICE_URL: "Hard-coded dependency",
    DEPENDENCY_CYCLE: "Dependency cycle",
    GOVERNANCE_POLICY_VIOLATION: "Policy violation"
  };
  return titles[finding.type] ?? plainLanguageFindingTitle(finding);
}

export function compactMetricDetail(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function renderHighlightedText(text: string) {
  const parts = tokenizeHighlightedText(text);
  return parts.map((part, index) =>
    part.kind === "code" ? (
      <code key={`${part.value}-${index}`} className="inlineCode">
        {part.value}
      </code>
    ) : (
      <React.Fragment key={`${part.value}-${index}`}>{part.value}</React.Fragment>
    )
  );
}

export function tokenizeHighlightedText(text: string) {
  const pattern = /(https?:\/\/[^\s)]+|\/[^\s,;]+|[a-z0-9]+(?:-[a-z0-9]+){1,}(?=[\s.,;:)])?)/gi;
  const parts: Array<{ kind: "text" | "code"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [raw] = match;
    const start = match.index;
    if (start > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, start) });
    }

    const trimmed = trimTrailingPunctuation(raw);
    const trailing = raw.slice(trimmed.length);
    parts.push({ kind: "code", value: trimmed });
    if (trailing) {
      parts.push({ kind: "text", value: trailing });
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

export function trimTrailingPunctuation(value: string) {
  return value.replace(/[.,;:]+$/, "");
}

export function findingWhyItMatters(finding: Finding) {
  if (finding.type.includes("GOD")) return "This service can become hard to change safely because too many responsibilities are concentrated in one place.";
  if (finding.type.includes("CHATTY")) return "Frequent cross-service calls can slow requests down and make failures spread more easily between services.";
  if (finding.type.includes("SHARED") || finding.type.includes("DATABASE")) return "Shared data ownership weakens service boundaries and makes independent releases more difficult.";
  if (finding.type.includes("HARD_CODED")) return "Hard-coded dependencies reduce portability and make environment changes or service moves more fragile.";
  if (finding.type.includes("CYCLE")) return "Dependency loops usually increase coupling and make it harder to isolate, test, and evolve services.";
  return "This finding suggests a structural risk that could reduce maintainability, clarity, or service independence.";
}

export function findingLimitation(finding: Finding) {
  if (finding.type.includes("CHATTY")) return "This does not prove the calls are always bad. It indicates a pattern worth validating against traffic, latency, and business workflow needs.";
  if (finding.type.includes("SHARED") || finding.type.includes("DATABASE")) return "This does not prove the database schema is wrong. It highlights a likely ownership boundary that needs architectural review.";
  if (finding.type.includes("HARD_CODED")) return "This does not prove runtime failures are happening now. It shows a portability and maintainability risk in the current implementation.";
  if (finding.type.includes("GOD")) return "This does not prove the service is impossible to maintain. It signals that responsibility may be too concentrated and should be reviewed.";
  if (finding.type.includes("CYCLE")) return "This does not prove every dependency in the cycle is unnecessary. It shows a loop that deserves closer design analysis.";
  return "This result is evidence of a likely architectural issue, not a complete explanation of all runtime behavior.";
}

export function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return "Very high";
  if (confidence >= 0.75) return "High";
  if (confidence >= 0.55) return "Moderate";
  return "Low";
}

export function confidenceGuidance(confidence: number) {
  if (confidence >= 0.9) return "The detector found strong signals that consistently support this result.";
  if (confidence >= 0.75) return "The detector found several supporting signals, but human review is still useful before acting.";
  if (confidence >= 0.55) return "The result is plausible, though the evidence is lighter and should be reviewed carefully.";
  return "Treat this as an early signal that needs manual confirmation before making architectural changes.";
}

export function recommendationPreview(finding: Finding) {
  const recommendation = finding.recommendations?.[0];
  if (recommendation?.refactoring_steps?.[0]) return recommendation.refactoring_steps[0];
  return finding.recommendation;
}

export function recommendationImpact(finding: Finding) {
  const recommendation = finding.recommendations?.[0];
  if (recommendation?.expected_impact) return recommendation.expected_impact;
  return "Addressing this finding should reduce architectural risk and improve clarity of service boundaries.";
}

export function summarizeEvidence(evidence: Array<Record<string, unknown>>) {
  if (evidence.length === 0) return ["No structured detector evidence was attached to this finding."];
  return evidence.slice(0, 4).map((record, index) => {
    const fragments = Object.entries(record)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 3)
      .map(([key, value]) => `${formatType(key)}: ${String(value)}`);
    return fragments.length > 0 ? fragments.join(" | ") : `Evidence item ${index + 1} contains nested detector metadata.`;
  });
}

export function getMostUrgentFinding(findings: Finding[]) {
  return [...findings].sort((left, right) => {
    const severityDelta = (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0);
    if (severityDelta !== 0) return severityDelta;
    return right.confidence - left.confidence;
  })[0];
}

export function getHotspotService(findings: Finding[], scores: HealthScore[]) {
  const serviceCounts = new Map<string, { count: number; severity: string; score?: number }>();
  findings.forEach((finding) => {
    finding.services.forEach((service) => {
      const current = serviceCounts.get(service) ?? { count: 0, severity: "low", score: serviceHealthScore(scores, service)?.score };
      const nextSeverity = (severityRank[finding.severity] ?? 0) > (severityRank[current.severity] ?? 0) ? finding.severity : current.severity;
      serviceCounts.set(service, {
        count: current.count + 1,
        severity: nextSeverity,
        score: current.score
      });
    });
  });
  const [service, meta] = [...serviceCounts.entries()].sort((left, right) => {
    const countDelta = right[1].count - left[1].count;
    if (countDelta !== 0) return countDelta;
    const severityDelta = (severityRank[right[1].severity] ?? 0) - (severityRank[left[1].severity] ?? 0);
    if (severityDelta !== 0) return severityDelta;
    return (left[1].score ?? 100) - (right[1].score ?? 100);
  })[0] ?? [];
  if (!service || !meta) return null;
  return {
    service,
    tone: meta.severity.toLowerCase(),
    detail: `${meta.count} linked findings${meta.score !== undefined ? `, health ${Math.round(meta.score)}` : ""}`
  };
}

export function formatType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}


export function getHighestSeverity(findings: Finding[]) {
  if (findings.length === 0) return "None";
  return findings.reduce((highest, finding) => {
    return severityRank[finding.severity] > severityRank[highest] ? finding.severity : highest;
  }, findings[0].severity);
}

export function gradeTone(grade: string) {
  if (grade === "Excellent" || grade === "Good") return "low";
  if (grade === "Moderate") return "medium";
  return "high";
}

export function formatSigned(value?: number | null) {
  if (value === null || value === undefined) return "--";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${Number(value).toFixed(1)}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "No timestamp";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function shortId(id: string) {
  return id.slice(0, 8);
}

export const graphStyle: Array<{ selector: string; style: Record<string, string | number> }> = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": "#2563eb",
      "border-color": "#bfdbfe",
      "border-width": 2,
      color: "#0f172a",
      "font-size": "9px",
      "font-weight": 800,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-wrap": "wrap",
      "text-max-width": "92px",
      "text-margin-y": 8,
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.9,
      "text-background-padding": "3px",
      "text-border-color": "#e2e8f0",
      "text-border-width": 1,
      "text-border-opacity": 0.9,
      width: "mapData(weight, 0, 14, 26, 42)",
      height: "mapData(weight, 0, 14, 26, 42)",
      "overlay-opacity": 0
    }
  },
  {
    selector: "node[role = 'hub']",
    style: {
      "background-color": "#1d4ed8",
      "border-color": "#93c5fd",
      "border-width": 4,
      width: "mapData(weight, 0, 14, 36, 50)",
      height: "mapData(weight, 0, 14, 36, 50)",
      "font-size": "10px"
    }
  },
  {
    selector: "node[type = 'api']",
    style: {
      "background-color": "#059669",
      "border-color": "#a7f3d0",
      shape: "diamond",
      width: 24,
      height: 24,
      "font-size": "8px",
      "text-max-width": "74px",
      color: "#065f46"
    }
  },
  {
    selector: "node[type = 'database']",
    style: {
      "background-color": "#7c3aed",
      "border-color": "#ddd6fe",
      shape: "round-rectangle",
      width: 38,
      height: 24,
      "font-size": "8px",
      "text-max-width": "72px",
      color: "#4c1d95"
    }
  },
  {
    selector: "node[type = 'config'], node[type = 'library'], node[type = 'message_broker'], node[type = 'environment_variable']",
    style: {
      "background-color": "#64748b",
      "border-color": "#cbd5e1",
      shape: "round-rectangle",
      width: 24,
      height: 18,
      "font-size": "0px",
      "text-opacity": 0,
      "text-max-width": "0px"
    }
  },
  {
    selector: "node[risk = 'critical']",
    style: {
      "border-color": "#dc2626",
      "border-width": 5
    }
  },
  {
    selector: "node[risk = 'high']",
    style: {
      "border-color": "#f97316",
      "border-width": 4
    }
  },
  {
    selector: "node[risk = 'medium']",
    style: {
      "border-color": "#f59e0b",
      "border-width": 4
    }
  },
  {
    selector: "edge",
    style: {
      label: "data(label)",
      width: "mapData(count, 1, 8, 0.8, 2.4)",
      "line-color": "#94a3b8",
      "target-arrow-color": "#94a3b8",
      "target-arrow-shape": "triangle",
      "target-arrow-scale": 0.65,
      "curve-style": "bezier",
      "control-point-step-size": 36,
      "font-size": "7px",
      "font-weight": 800,
      color: "#334155",
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.95,
      "text-background-padding": "2px",
      "text-border-color": "#e2e8f0",
      "text-border-opacity": 1,
      "text-border-width": 1,
      "text-rotation": "none",
      opacity: 0.62
    }
  },
  {
    selector: "edge[type = 'exposes_api'], edge[type = 'consumes_api']",
    style: {
      "line-color": "#059669",
      "target-arrow-color": "#059669",
      "line-style": "dotted",
      opacity: 0.62
    }
  },
  {
    selector: "edge[type = 'uses_database'], edge[type = 'reads_from'], edge[type = 'writes_to'], edge[type = 'shared_database'], edge[type = 'shares_database_with']",
    style: {
      "line-color": "#7c3aed",
      "target-arrow-color": "#7c3aed",
      "line-style": "dashed"
    }
  },
  {
    selector: "edge[risk = 'critical']",
    style: {
      "line-color": "#dc2626",
      "target-arrow-color": "#dc2626",
      width: 2.8,
      opacity: 0.9
    }
  },
  {
    selector: "edge[risk = 'high']",
    style: {
      "line-color": "#f97316",
      "target-arrow-color": "#f97316",
      width: 2.5,
      opacity: 0.88
    }
  },
  {
    selector: "edge[risk = 'medium']",
    style: {
      "line-color": "#f59e0b",
      "target-arrow-color": "#f59e0b",
      width: 2.4
    }
  },
  {
    selector: ":selected",
    style: {
      "border-color": "#0f172a",
      "line-color": "#0f172a",
      "target-arrow-color": "#0f172a"
    }
  }
];
