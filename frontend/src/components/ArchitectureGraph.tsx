import React from "react";
import cytoscape from "cytoscape";
import { aggregateEdges, buildGraphElements, graphStyle, selectionForEdge, selectionForNode } from "../viewHelpers";
import { useEffectEvent } from "../hooks/useEffectEvent";
import type { DisplayGraph, Finding, GraphSelection, HealthScore } from "../types";

/**
 * The Cytoscape architecture graph. It draws when it mounts and redraws when the graph,
 * findings or scores change, so it also works when the Graph page is opened later.
 */
export function ArchitectureGraph({
  graph,
  findings,
  scores,
  onSelect
}: {
  graph: DisplayGraph | null;
  findings: Finding[];
  scores: HealthScore[];
  onSelect: (selection: GraphSelection) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const edges = React.useMemo(() => (graph ? aggregateEdges(graph.edges) : []), [graph]);
  const select = useEffectEvent(onSelect);

  React.useEffect(() => {
    if (!graph || !containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildGraphElements(graph.nodes, edges),
      style: graphStyle,
      layout: { name: "preset", animate: false, fit: true, padding: 48 },
      minZoom: 0.45,
      maxZoom: 1.35,
      wheelSensitivity: 0.2
    });

    cy.ready(() => {
      cy.fit(undefined, 54);
      cy.center();
    });
    cy.on("tap", "node", (event) => {
      select(selectionForNode(event.target.data(), findings, scores));
    });
    cy.on("tap", "edge", (event) => {
      select(selectionForEdge(event.target.data(), graph.nodes, findings));
    });
    return () => cy.destroy();
  }, [edges, graph, findings, scores, select]);

  return <div ref={containerRef} className="graph" />;
}
