import React from "react";
import type { Core } from "cytoscape";
import { aggregateEdges, buildGraphElements, graphStyle, selectionForEdge, selectionForNode } from "../viewHelpers";
import { useEffectEvent } from "../hooks/useEffectEvent";
import { Icon } from "./icons";
import type { DisplayGraph, Finding, GraphSelection, HealthScore } from "../types";

const FIT_PADDING = 54;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.35;

/**
 * The Cytoscape architecture graph. Cytoscape is loaded when the graph is first shown, so it
 * stays out of the main bundle. The graph draws when it mounts, redraws when the graph,
 * findings or scores change, and fits itself again when its box changes size (for example
 * when a phone is rotated). Drag to pan, pinch or scroll to zoom, or use the buttons.
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
  const cyRef = React.useRef<Core | null>(null);
  const edges = React.useMemo(() => (graph ? aggregateEdges(graph.edges) : []), [graph]);
  const select = useEffectEvent(onSelect);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!graph || !container) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void import("cytoscape").then(({ default: cytoscape }) => {
      if (cancelled) return;
      const cy = cytoscape({
        container,
        elements: buildGraphElements(graph.nodes, edges),
        style: graphStyle,
        layout: { name: "preset", animate: false, fit: true, padding: 48 },
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        wheelSensitivity: 0.2
      });
      cyRef.current = cy;

      cy.ready(() => {
        cy.fit(undefined, FIT_PADDING);
        cy.center();
      });
      cy.on("tap", "node", (event) => {
        select(selectionForNode(event.target.data(), findings, scores));
      });
      cy.on("tap", "edge", (event) => {
        select(selectionForEdge(event.target.data(), graph.nodes, findings));
      });

      if (typeof ResizeObserver !== "undefined") {
        let lastSize = `${container.clientWidth}x${container.clientHeight}`;
        observer = new ResizeObserver(() => {
          const size = `${container.clientWidth}x${container.clientHeight}`;
          if (size === lastSize) return;
          lastSize = size;
          cy.resize();
          cy.fit(undefined, FIT_PADDING);
        });
        observer.observe(container);
      }
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [edges, graph, findings, scores, select]);

  function zoomBy(factor: number) {
    const cy = cyRef.current;
    if (!cy) return;
    const level = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cy.zoom() * factor));
    cy.zoom({ level, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }

  function fitToView() {
    cyRef.current?.fit(undefined, FIT_PADDING);
  }

  return (
    <div className="graphStage">
      <div ref={containerRef} className="graph" />
      <div className="graphControls" role="group" aria-label="Graph zoom">
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
          <Icon name="zoomIn" />
        </button>
        <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out">
          <Icon name="zoomOut" />
        </button>
        <button type="button" onClick={fitToView} aria-label="Fit graph to view" title="Fit graph to view">
          <Icon name="fit" />
        </button>
      </div>
    </div>
  );
}
