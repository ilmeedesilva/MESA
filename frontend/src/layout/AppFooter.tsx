export const repositoryUrl = "https://github.com/ilmeedesilva/MESA";

export function AppFooter({
  serverVersion,
  usingDemoData,
  onOpenDocs
}: {
  serverVersion: string | null;
  usingDemoData: boolean;
  onOpenDocs: () => void;
}) {
  const version = usingDemoData ? "demo data" : serverVersion ? `version ${serverVersion}` : null;
  return (
    <footer className="appFooter">
      <span>{version ? `MESA ${version}` : "MESA"}</span>
      <nav aria-label="About MESA">
        <button type="button" className="footerLink" onClick={onOpenDocs}>
          Documentation
        </button>
        <a className="footerLink" href={repositoryUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
    </footer>
  );
}
