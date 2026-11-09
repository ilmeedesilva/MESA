import type { ReactNode } from "react";
import { useMesaWorkspace, type MesaWorkspace } from "./useMesaWorkspace";
import { isDemoScan } from "../demoMode";
import { plainLanguageFindingTitle } from "../viewHelpers";
import { AppShell, WorkspaceFrame } from "../layout/AppShell";
import { PublicDemoBanner } from "../layout/PublicDemoBanner";
import { Sidebar } from "../layout/Sidebar";
import { TopBar } from "../layout/TopBar";
import { FindingDrawer } from "../components/FindingDrawer";
import { InterpretationModeCard } from "../components/InterpretationModeCard";
import { ProjectRequiredState } from "../components/ProjectRequiredState";
import { ScanHistoryPanel } from "../components/ScanHistoryPanel";
import { ScanHistoryRail } from "../components/ScanHistoryRail";
import { AIExplainerPanel } from "../pages/AIExplainerPanel";
import { AiBaselinePanel } from "../pages/AiBaselinePanel";
import { BenchmarksPanel } from "../pages/BenchmarksPanel";
import { DocumentationPortal } from "../pages/DocumentationPortal";
import { EvolutionPanel } from "../pages/EvolutionPanel";
import { FindingsPage } from "../pages/FindingsPage";
import { FitnessGatePanel } from "../pages/FitnessGatePanel";
import { GraphPage } from "../pages/GraphPage";
import { OverviewPage } from "../pages/OverviewPage";
import { RemediationRoadmapPanel } from "../pages/RemediationRoadmapPanel";
import { ResearchEvaluationPanel } from "../pages/ResearchEvaluationPanel";
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

  const historyPanel = (
    <ScanHistoryPanel
      history={history}
      activeScan={activeScan}
      isLoadingScan={isLoadingScan}
      isSavingResearchRecord={ws.isSavingResearchRecord}
      usingEmbeddedDemo={ws.usingEmbeddedDemo}
      onSelectScan={(scanId) => void ws.loadScan(scanId)}
      onCreateResearchRecord={(scanId) => void ws.createResearchRecordFromScan(scanId)}
    />
  );

  const showScanRail =
    Boolean(selectedProject) &&
    history.length > 0 &&
    currentSection !== "history" &&
    currentSection !== "docs" &&
    currentSection !== "ai-baseline";
  const scanRail = showScanRail ? (
    <ScanHistoryRail
      history={history}
      activeScanId={activeScan?.id}
      isLoadingScan={isLoadingScan}
      onSelectScan={(scanId) => void ws.loadScan(scanId, { projectId: selectedProjectId })}
      onOpenHistory={() => ws.navigateToSection("history")}
    />
  ) : null;

  // The AI Baseline page is shown on its own, so the workspace banners and
  // interpretation controls are hidden there.
  const isStandaloneSection = currentSection === "ai-baseline";

  return (
    <AppShell
      sidebarCollapsed={ws.sidebarCollapsed}
      sidebar={
        <Sidebar
          collapsed={ws.sidebarCollapsed}
          currentSection={currentSection}
          isPublicDemoMode={ws.isPublicDemoMode}
          onToggleCollapsed={ws.toggleSidebar}
          onNavigate={(section) => ws.navigateToSection(section)}
          onToggleDemo={ws.toggleDemoWorkspace}
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

      {ws.error ? <div className="error workspaceError">{ws.error}</div> : null}

      <WorkspaceFrame
        header={
          !isStandaloneSection ? (
            <div className="workspaceFrameHeader">
              <div>
                <div className="eyebrow">Current Workspace</div>
                <h2>{currentSectionMeta.label}</h2>
                <p>
                  {selectedProject
                    ? `${selectedProject.name} is currently active. Switch projects from the header without leaving this workspace.`
                    : "Choose a project from the header or create a new one to start a saved scan workflow."}
                </p>
              </div>
              <div className="workspaceContextMeta">
                <span>{selectedProject ? selectedProject.name : "No project selected"}</span>
                <code>{sectionNeedsProject ? ws.sourceLabel : "Reference workspace"}</code>
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
      return historyPanel;
    case "evolution":
      return <EvolutionPanel reports={ws.evolution} />;
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
        />
      );
    case "evaluation":
      return (
        <ResearchEvaluationPanel
          records={ws.researchRecords}
          selectedRecordId={ws.selectedResearchRecordId}
          projects={ws.projects}
          selectedProjectId={ws.selectedProjectId}
          history={ws.history}
          activeScan={activeScan}
          isLoading={ws.isLoadingResearchRecords}
          isSaving={ws.isSavingResearchRecord}
          isExporting={ws.isExportingResearchRecords}
          onSelectRecord={ws.setSelectedResearchRecordId}
          onSelectProject={(projectId) => ws.updateSelectedProject(projectId, "push")}
          onSelectScan={(scanId) => void ws.loadScan(scanId, { projectId: ws.selectedProjectId })}
          onCreateFromScan={(scanId) => void ws.createResearchRecordFromScan(scanId)}
          onRefresh={() => void ws.loadResearchRecords()}
          onUpdate={(record, patch) => void ws.updateResearchRecord(record, patch)}
          onDelete={(recordId) => void ws.deleteResearchRecord(recordId)}
          onExport={(format) => void ws.exportResearchRecords(format)}
        />
      );
    case "benchmarks":
      return <BenchmarksPanel />;
    case "ai-baseline":
      return <AiBaselinePanel />;
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
    default:
      return <OverviewPage ws={ws} historyPanel={historyPanel} />;
  }
}
