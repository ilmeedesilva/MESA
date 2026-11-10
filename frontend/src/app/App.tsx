import React, { type ReactNode } from "react";
import { docBySlug } from "../docsPortal";
import { useMesaWorkspace, type MesaWorkspace } from "./useMesaWorkspace";
import { isDemoScan } from "../demoMode";
import { plainLanguageFindingTitle } from "../viewHelpers";
import { AppShell, WorkspaceFrame } from "../layout/AppShell";
import { PublicDemoBanner } from "../layout/PublicDemoBanner";
import { AppFooter } from "../layout/AppFooter";
import { MobileBar } from "../layout/MobileBar";
import { Sidebar } from "../layout/Sidebar";
import { TopBar } from "../layout/TopBar";
import { FindingDrawer } from "../components/FindingDrawer";
import { InterpretationModeCard } from "../components/InterpretationModeCard";
import { ProjectRequiredState } from "../components/ProjectRequiredState";
import { StatePanel } from "../components/StatePanel";
import { ScanHistoryPanel } from "../components/ScanHistoryPanel";
import { ScanHistoryRail } from "../components/ScanHistoryRail";
import { AIExplainerPanel } from "../pages/AIExplainerPanel";
import { DocumentationPortal } from "../pages/DocumentationPortal";
import { FindingsPage } from "../pages/FindingsPage";
import { FitnessGatePanel } from "../pages/FitnessGatePanel";
import { GraphPage } from "../pages/GraphPage";
import { HistoryPage } from "../pages/HistoryPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { OverviewPage } from "../pages/OverviewPage";
import { RemediationRoadmapPanel } from "../pages/RemediationRoadmapPanel";
import { ScanPage } from "../pages/ScanPage";

export function App() {
  const ws = useMesaWorkspace();
  const {
    selectedProject,
    currentSection,
    currentSectionMeta,
    sectionNeedsProject,
    history,
    activeScan,
    isLoadingScan,
    selectedProjectId,
    selectedFinding,
    interpretationMode
  } = ws;

  // The browser tab names the page, such as "Findings - MESA".
  const docTitle = currentSection === "docs" ? docBySlug(ws.selectedDocSlug).title : null;
  React.useEffect(() => {
    document.title =
      currentSection === "overview"
        ? "MESA"
        : docTitle
          ? `${docTitle} - Documentation - MESA`
          : `${currentSectionMeta.label} - MESA`;
  }, [currentSection, currentSectionMeta.label, docTitle]);

  const historyPanel = (
    <ScanHistoryPanel
      history={history}
      activeScan={activeScan}
      isLoadingScan={isLoadingScan}
      onSelectScan={(scanId) => void ws.loadScan(scanId)}
    />
  );

  const showScanRail =
    Boolean(selectedProject) &&
    history.length > 0 &&
    currentSection !== "history" &&
    currentSection !== "docs" &&
    currentSection !== "not-found";
  const scanRail = showScanRail ? (
    <ScanHistoryRail
      history={history}
      activeScanId={activeScan?.id}
      isLoadingScan={isLoadingScan}
      onSelectScan={(scanId) => void ws.loadScan(scanId, { projectId: selectedProjectId })}
      onOpenHistory={() => ws.navigateToSection("history")}
    />
  ) : null;

  // The not-found page is shown on its own, without the workspace banners and controls.
  const isStandaloneSection = currentSection === "not-found";

  return (
    <AppShell
      sidebarCollapsed={ws.sidebarCollapsed}
      navOpen={ws.navOpen}
      onCloseNav={ws.closeNav}
      mobileBar={
        ws.layoutMode === "phone" ? (
          <MobileBar title={currentSectionMeta.label} navOpen={ws.navOpen} onOpenMenu={ws.toggleSidebar} />
        ) : null
      }
      sidebar={
        <Sidebar
          layoutMode={ws.layoutMode}
          collapsed={ws.sidebarCollapsed}
          navOpen={ws.navOpen}
          currentSection={currentSection}
          isPublicDemoMode={ws.isPublicDemoMode}
          projects={ws.projects}
          selectedProjectId={selectedProjectId}
          projectListStatus={ws.projectListStatus}
          onToggleCollapsed={ws.toggleSidebar}
          onNavigate={(section) => {
            ws.navigateToSection(section);
            ws.closeNav();
          }}
          onToggleDemo={() => {
            ws.toggleDemoWorkspace();
            ws.closeNav();
          }}
          onSelectProject={(value) => {
            ws.handleTopProjectSelection(value);
            ws.closeNav();
          }}
          onCreateProject={() => {
            ws.openCreateProjectFlow();
            ws.closeNav();
          }}
        />
      }
      topBar={
        <TopBar
          section={currentSectionMeta}
          projects={ws.projects}
          selectedProject={selectedProject}
          selectedProjectId={selectedProjectId}
          projectListStatus={ws.projectListStatus}
          isLoadingProjectState={ws.isLoadingProjectState}
          isPublicDemoMode={ws.isPublicDemoMode}
          onSelectProject={ws.handleTopProjectSelection}
          onCreateProject={ws.openCreateProjectFlow}
        />
      }
      footer={
        <AppFooter
          serverVersion={ws.serverVersion}
          usingDemoData={ws.isPublicDemoMode}
          onOpenDocs={() => ws.navigateToSection("docs")}
        />
      }
      overlay={
        selectedFinding ? (
          <FindingDrawer
            finding={selectedFinding}
            interpretationMode={interpretationMode}
            onAskAI={() => {
              ws.askAIAboutFinding(
                selectedFinding,
                `Explain simply what to solve first about ${plainLanguageFindingTitle(selectedFinding).toLowerCase()}.`
              );
            }}
            onClose={ws.closeFinding}
          />
        ) : null
      }
    >
      {!isStandaloneSection ? (
        <>
          <PublicDemoBanner
            apiAvailability={ws.apiAvailability}
            isPublicDemoMode={ws.isPublicDemoMode}
            usingEmbeddedDemo={ws.usingEmbeddedDemo}
            serverRetryStatus={ws.serverRetryStatus}
            onRetryServer={() => void ws.retryServerConnection()}
            onOpenDoc={ws.openDoc}
          />

          <section className="globalControlBar">
            <InterpretationModeCard
              mode={interpretationMode}
              onChangeMode={ws.setInterpretationMode}
              onOpenDoc={ws.openDoc}
            />
          </section>
        </>
      ) : null}

      {ws.error ? (
        <div className="error workspaceError" role="alert">
          {ws.error}
        </div>
      ) : null}

      <WorkspaceFrame
        header={
          !isStandaloneSection ? (
            <div className="workspaceFrameHeader">
              <div>
                <div className="eyebrow">Current page</div>
                <h2>{currentSectionMeta.label}</h2>
                <p>
                  {selectedProject
                    ? `${selectedProject.name} is currently active. Switch projects from the header without leaving this workspace.`
                    : "Choose a project from the header or create a new one to start a saved scan workflow."}
                </p>
              </div>
              <div className="workspaceContextMeta">
                <span>{selectedProject ? selectedProject.name : "No project selected"}</span>
                <code>{sectionNeedsProject ? ws.sourceLabel : "Documentation"}</code>
              </div>
            </div>
          ) : null
        }
        rail={scanRail}
      >
        <SectionContent ws={ws} historyPanel={historyPanel} />
      </WorkspaceFrame>
    </AppShell>
  );
}

function SectionContent({ ws, historyPanel }: { ws: MesaWorkspace; historyPanel: ReactNode }) {
  const { currentSection, selectedProject, sectionNeedsProject, activeScan } = ws;
  const projectRequired = (
    <ProjectRequiredState onOpenScan={() => ws.navigateToSection("scan")} onCreateProject={ws.openCreateProjectFlow} />
  );

  if (sectionNeedsProject && !selectedProject && currentSection !== "scan" && currentSection !== "overview") {
    return projectRequired;
  }

  const isLoadingData = ws.isLoadingScan || ws.isLoadingProjectState;
  const goToScan = (
    <button type="button" onClick={() => ws.navigateToSection("scan")}>
      Go to Scan
    </button>
  );
  // Pages that show one scan's results: loading while it arrives, a clear next step without one.
  const needsScan: Partial<Record<typeof currentSection, string>> = {
    findings: "the findings",
    graph: "the architecture graph",
    roadmap: "a roadmap of what to fix first",
    gate: "whether the architecture passes the gate"
  };
  const scanPurpose = needsScan[currentSection];
  if (scanPurpose && !ws.result) {
    if (isLoadingData) return <StatePanel kind="loading" title="Loading the latest scan..." />;
    return (
      <StatePanel kind="empty" title="No scan yet" actions={goToScan}>
        {`Run a scan of ${selectedProject?.name ?? "this project"} to see ${scanPurpose}.`}
      </StatePanel>
    );
  }

  switch (currentSection) {
    case "overview":
      return <OverviewPage ws={ws} historyPanel={historyPanel} />;
    case "scan":
      return <ScanPage ws={ws} />;
    case "findings":
      return selectedProject ? <FindingsPage ws={ws} /> : projectRequired;
    case "graph":
      return selectedProject ? <GraphPage ws={ws} /> : projectRequired;
    case "history":
      if (ws.history.length === 0) {
        if (isLoadingData) return <StatePanel kind="loading" title="Loading scans..." />;
        return (
          <StatePanel kind="empty" title="No scans yet" actions={goToScan}>
            {`Scans of ${selectedProject?.name ?? "this project"} appear here, with what changed between them.`}
          </StatePanel>
        );
      }
      return <HistoryPage scanList={historyPanel} evolution={ws.evolution} />;
    case "roadmap":
      return <RemediationRoadmapPanel roadmap={ws.roadmap} isLoading={ws.isLoadingRoadmap} onOpenDoc={ws.openDoc} />;
    case "gate":
      return (
        <FitnessGatePanel scanId={activeScan?.id ?? null} isDemo={Boolean(activeScan && isDemoScan(activeScan.id))} />
      );
    case "ai":
      return (
        <AIExplainerPanel
          activeScan={activeScan}
          compareBaseScan={ws.compareBaseScan}
          response={ws.aiResponse}
          status={ws.aiStatus}
          streamingAnswer={ws.streamingAnswer}
          question={ws.aiQuestion}
          isLoading={ws.isExplaining}
          isCheckingStatus={ws.isCheckingAIStatus}
          urgentFinding={ws.urgentFinding ?? null}
          systemScore={ws.systemScore ?? null}
          policyText={ws.policyText}
          onQuestionChange={ws.setAiQuestion}
          onAsk={(intent, options) => void ws.requestAIExplanation(intent, options)}
          onApplyPolicyDraft={(draft) => ws.setPolicyText(draft)}
          onRefreshStatus={() => void ws.loadAIStatus()}
          onOpenDoc={ws.openDoc}
          interpretationMode={ws.interpretationMode}
        />
      );
    case "docs":
      return (
        <DocumentationPortal
          selectedDocSlug={ws.selectedDocSlug}
          docsQuery={ws.docsQuery}
          docsCategory={ws.docsCategory}
          onChangeQuery={ws.setDocsQuery}
          onChangeCategory={ws.setDocsCategory}
          onSelectDoc={(slug) => ws.selectDoc(slug)}
          onAutoSelectDoc={(slug) => ws.selectDoc(slug, "replace")}
          onBackToAnalysis={() => ws.navigateToSection("overview")}
        />
      );
    case "not-found":
      return <NotFoundPage onGoHome={() => ws.navigateToSection("overview")} />;
    default:
      return <OverviewPage ws={ws} historyPanel={historyPanel} />;
  }
}
