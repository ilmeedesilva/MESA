import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GraphInspector } from "./GraphInspector";
import type { GraphSelection } from "../types";

const selection: GraphSelection = {
  kind: "node",
  id: "orders",
  title: "orders",
  subtitle: "Service",
  properties: {},
  findings: []
};

describe("GraphInspector", () => {
  it("shows a hint until something is selected", () => {
    render(<GraphInspector selection={null} onClose={() => {}} />);
    expect(screen.getByText(/Click a service, API, database/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close details" })).toBeNull();
  });

  it("shows the selection with a close button for the phone bottom sheet", () => {
    const onClose = vi.fn();
    render(<GraphInspector selection={selection} onClose={onClose} />);
    expect(screen.getByRole("heading", { name: "orders" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
