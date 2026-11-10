export function NotFoundPage({ onGoHome }: { onGoHome: () => void }) {
  return (
    <section className="notFoundPage" aria-labelledby="not-found-title">
      <div className="eyebrow">Page not found</div>
      <h2 id="not-found-title">This page does not exist</h2>
      <p>The link may be old or mistyped. Everything in MESA is reachable from the menu.</p>
      <button type="button" onClick={onGoHome}>
        Go to Overview
      </button>
    </section>
  );
}
