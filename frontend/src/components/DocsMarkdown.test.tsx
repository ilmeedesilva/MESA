import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { docsCatalog } from "../docsPortal";
import { resolveDocLink } from "../docsLinks";
import DocsMarkdown from "./DocsMarkdown";

afterEach(cleanup);

const guide = "docs/guides/USER_GUIDE.md";

describe("resolveDocLink", () => {
  it("opens other in-app docs inside the app", () => {
    expect(resolveDocLink("FINDINGS_GUIDE.md", guide)).toEqual({
      kind: "doc",
      slug: "findings-guide",
      href: "#/docs/findings-guide"
    });
    expect(resolveDocLink("../api/API_DOCUMENTATION.md#health", guide)).toMatchObject({
      kind: "doc",
      slug: "api-reference"
    });
  });

  it("sends removed docs and repository files to GitHub", () => {
    expect(resolveDocLink("../research/REPRODUCE.md#later-versions", guide)).toEqual({
      kind: "external",
      href: "https://github.com/ilmeedesilva/MESA/blob/main/docs/research/REPRODUCE.md#later-versions"
    });
    expect(resolveDocLink("../../action.yml", guide)).toEqual({
      kind: "external",
      href: "https://github.com/ilmeedesilva/MESA/blob/main/action.yml"
    });
    expect(resolveDocLink("../../benchmarks/", guide)).toEqual({
      kind: "external",
      href: "https://github.com/ilmeedesilva/MESA/tree/main/benchmarks/"
    });
  });

  it("keeps web addresses and same-page headings", () => {
    expect(resolveDocLink("https://example.com/a", guide)).toEqual({ kind: "external", href: "https://example.com/a" });
    expect(resolveDocLink("#what-fails-the-check", guide)).toEqual({ kind: "anchor", id: "what-fails-the-check" });
  });
});

describe("DocsMarkdown", () => {
  const sample = [
    "## What fails the check",
    "",
    "Some **bold** and *italic* text, [a guide](FINDINGS_GUIDE.md), [the web](https://example.com),",
    "[a research doc](../research/METHODOLOGY.md) and [a heading](#what-fails-the-check).",
    "",
    "1. a list item that is long enough to wrap",
    "   onto a second line in the source",
    "2. the second item",
    "",
    "| Input | Default |",
    "| --- | --- |",
    "| `path` | `.` |",
    "",
    "<script>alert(1)</script><b>raw html</b>",
    "",
    "```yaml",
    "name: Architecture check",
    "```"
  ].join("\n");

  it("renders tables, emphasis, wrapped list items and code blocks", () => {
    const { container } = render(<DocsMarkdown content={sample} docPath={guide} />);
    expect(container.querySelector(".docsTableScroll[role=region] table th")).toHaveTextContent("Input");
    expect(container.querySelector("td code")).toHaveTextContent("path");
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
    const items = container.querySelectorAll("ol > li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("a list item that is long enough to wrap onto a second line in the source");
    expect(container.querySelector("pre.docsCodeBlock code")).toHaveTextContent("name: Architecture check");
    expect(container.querySelector("h2")).toHaveAttribute("id", "what-fails-the-check");
    expect(container.textContent).not.toContain("| ---");
  });

  it("opens links in the right place", () => {
    render(<DocsMarkdown content={sample} docPath={guide} />);
    expect(screen.getByRole("link", { name: "a guide" })).toHaveAttribute("href", "#/docs/findings-guide");
    expect(screen.getByRole("link", { name: "a guide" })).not.toHaveAttribute("target");
    for (const name of ["the web", "a research doc"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByRole("link", { name: "a research doc" })).toHaveAttribute(
      "href",
      "https://github.com/ilmeedesilva/MESA/blob/main/docs/research/METHODOLOGY.md"
    );
    expect(screen.getByRole("link", { name: "a heading" })).toHaveAttribute("href", "#what-fails-the-check");
  });

  it("does not render raw HTML", () => {
    const { container } = render(<DocsMarkdown content={sample} docPath={guide} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("shows no raw Markdown table syntax in any in-app doc", () => {
    for (const doc of docsCatalog) {
      const html = renderToStaticMarkup(<DocsMarkdown content={doc.content} docPath={doc.path} />);
      const page = new DOMParser().parseFromString(html, "text/html");
      page.querySelectorAll("pre").forEach((block) => block.remove());
      const text = page.body.textContent ?? "";
      expect(text, doc.slug).not.toMatch(/\|\s*---/);
    }
  });
});
