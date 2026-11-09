# MESA web UI

React and TypeScript front end for MESA, built with Vite. Node 22 or later.

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173, API calls go to http://localhost:8000
```

Without a running API the app opens its embedded demo data. To run the whole stack instead, use
`docker compose up --build` from the repository root.

## Check it

```bash
npm run lint           # ESLint (including accessibility rules) and TypeScript
npm run format:check   # Prettier
npm test               # unit and component tests (Vitest)
npm run build          # production build in dist/
```

## Browser tests

The browser tests in `e2e/` use Playwright. They build the app, serve it locally and open it in
Chromium with the demo data (no backend, no network). They check that every page fits the
screen at 390, 768, 1024 and 1440px, the phone menu and tablet sidebar, opening and closing
findings, links and the back button, the graph, and accessibility with axe (WCAG 2.2 A and AA;
any violation fails).

```bash
npm run test:e2e:install   # once: downloads Chromium (and, on Linux, its system libraries)
npm run test:e2e           # about a minute
npx playwright test e2e/navigation.spec.ts   # one file
npx playwright show-report                   # after a CI-style run (CI=1), opens the HTML report
```

In GitHub Actions these run in the E2E job. Its `playwright-report` artifact has a screenshot of
every page at every width, and a trace for any failed test.
