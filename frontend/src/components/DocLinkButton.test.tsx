import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocLinkButton } from "./DocLinkButton";

describe("DocLinkButton", () => {
  it("renders its label as a button and calls onClick", () => {
    const onClick = vi.fn();
    render(<DocLinkButton label="Getting started" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Getting started" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
