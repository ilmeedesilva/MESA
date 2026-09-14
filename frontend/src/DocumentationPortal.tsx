import React from "react";
import { docBySlug, docNeighbors, docsByQuery, docsCatalog, docsCategories } from "./docsPortal";
import { DocLinkButton } from "./DocLinkButton";
import { renderMarkdown } from "./viewHelpers";

export function DocumentationPortal({
  selectedDocSlug,
  docsQuery,
  docsCategory,
  onChangeQuery,
  onChangeCategory,
  onSelectDoc,
  onBackToAnalysis
}: {
  selectedDocSlug: string;
  docsQuery: string;
  docsCategory: string;
  onChangeQuery: (value: string) => void;
  onChangeCategory: (value: string) => void;
  onSelectDoc: (slug: string) => void;
  onBackToAnalysis: () => void;
}) {
  const filteredDocs = React.useMemo(() => docsByQuery(docsQuery, docsCategory), [docsCategory, docsQuery]);
  const selectedDoc = docBySlug(selectedDocSlug);
  const neighbors = docNeighbors(selectedDoc.slug);

  React.useEffect(() => {
    if (filteredDocs.length > 0 && !filteredDocs.some((doc) => doc.slug === selectedDocSlug)) {
      onSelectDoc(filteredDocs[0].slug);
    }
  }, [filteredDocs, onSelectDoc, selectedDocSlug]);

  return (
    <section className="docsPortal">
      <aside className="docsSidebar">
        <div className="docsSidebarHeader">
          <div>
            <div className="eyebrow">Documentation Portal</div>
            <h2>Learn MESA from inside the product</h2>
            <p>{`Search ${docsCatalog.length} pages covering guides, methodology, limitations, API notes, and evaluator walkthroughs.`}</p>
          </div>
          <button type="button" className="workflowToggle" onClick={onBackToAnalysis}>
            Back to analysis
          </button>
        </div>

        <div className="docsSearchPanel">
          <label htmlFor="docsQuery">Search docs</label>
          <input
            id="docsQuery"
            placeholder="Search guides, research, API docs..."
            value={docsQuery}
            onChange={(event) => onChangeQuery(event.target.value)}
          />
          <label htmlFor="docsCategory">Category</label>
          <select id="docsCategory" value={docsCategory} onChange={(event) => onChangeCategory(event.target.value)}>
            <option value="ALL">All categories</option>
            {docsCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>

        <div className="docsQuickLinks">
          <strong>Quick links</strong>
          <div className="docLinks">
            <DocLinkButton label="Evaluator quick start" onClick={() => onSelectDoc("evaluator-quick-start")} />
            <DocLinkButton label="User guide" onClick={() => onSelectDoc("user-guide")} />
            <DocLinkButton label="Demo guide" onClick={() => onSelectDoc("demo-guide")} />
          </div>
        </div>

        <nav className="docsNav" aria-label="Documentation navigation">
          {docsCategories.map((category) => {
            const docsInCategory = filteredDocs.filter((doc) => doc.category === category);
            if (docsInCategory.length === 0) return null;
            return (
              <section key={category} className="docsCategoryGroup">
                <h3>{category}</h3>
                {docsInCategory.map((doc) => (
                  <button
                    key={doc.slug}
                    type="button"
                    className={doc.slug === selectedDoc.slug ? "docsNavItem active" : "docsNavItem"}
                    onClick={() => onSelectDoc(doc.slug)}
                  >
                    <strong>{doc.title}</strong>
                    <span>{doc.summary}</span>
                  </button>
                ))}
              </section>
            );
          })}
        </nav>
      </aside>

      <article className="docsArticle">
        <div className="docsArticleHeader">
          <div>
            <div className="eyebrow">{selectedDoc.category}</div>
            <h1>{selectedDoc.title}</h1>
            <p>{selectedDoc.summary}</p>
          </div>
          <code>{selectedDoc.path.replace("../../docs/", "docs/")}</code>
        </div>

        <div className="docsTags">
          {selectedDoc.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>

        <div className="docsMarkdown">
          {renderMarkdown(selectedDoc.content)}
        </div>

        <div className="docsPager">
          <button type="button" className="docsPagerButton" onClick={() => neighbors.previous && onSelectDoc(neighbors.previous.slug)} disabled={!neighbors.previous}>
            {neighbors.previous ? `Previous: ${neighbors.previous.title}` : "No previous page"}
          </button>
          <button type="button" className="docsPagerButton" onClick={() => neighbors.next && onSelectDoc(neighbors.next.slug)} disabled={!neighbors.next}>
            {neighbors.next ? `Next: ${neighbors.next.title}` : "No next page"}
          </button>
        </div>
      </article>
    </section>
  );
}
