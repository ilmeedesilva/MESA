import React from "react";
import { api, messageFor } from "./api";
import { Metric, averageMetric, draftMetricPreview, formatMetricValue, shortId } from "./viewHelpers";
import type { ProjectRecord, ResearchEvaluationDraft, ResearchEvaluationRecord, ScanRecord } from "./types";

export function ResearchEvaluationPanel({
  records,
  selectedRecordId,
  projects,
  selectedProjectId,
  history,
  activeScan,
  isLoading,
  isSaving,
  isExporting,
  onSelectRecord,
  onSelectProject,
  onSelectScan,
  onCreateFromScan,
  onRefresh,
  onUpdate,
  onDelete,
  onExport
}: {
  records: ResearchEvaluationRecord[];
  selectedRecordId: string;
  projects: ProjectRecord[];
  selectedProjectId: string;
  history: ScanRecord[];
  activeScan: ScanRecord | null;
  isLoading: boolean;
  isSaving: boolean;
  isExporting: boolean;
  onSelectRecord: (id: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectScan: (scanId: string) => void;
  onCreateFromScan: (scanId: string) => void;
  onRefresh: () => void;
  onUpdate: (record: ResearchEvaluationRecord, patch: Partial<ResearchEvaluationRecord>) => void;
  onDelete: (recordId: string) => void;
  onExport: (format: "csv" | "markdown" | "json") => void;
}) {
  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? records[0] ?? null;
  const reportReadyCount = records.filter((record) => record.suitable_for_report).length;
  const averagePrecision = averageMetric(records.map((record) => record.precision));
  const averageRecall = averageMetric(records.map((record) => record.recall));
  const [draftScanId, setDraftScanId] = React.useState("");
  const [draft, setDraft] = React.useState<ResearchEvaluationDraft | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = React.useState(false);
  const [draftError, setDraftError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeScan && activeScan.project_id === selectedProjectId) {
      setDraftScanId(activeScan.id);
      return;
    }
    if (history.length > 0) {
      setDraftScanId((current) => (current && history.some((scan) => scan.id === current) ? current : history[0].id));
      return;
    }
    setDraftScanId("");
  }, [activeScan, history, selectedProjectId]);

  React.useEffect(() => {
    if (!draftScanId) {
      setDraft(null);
      setDraftError(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingDraft(true);
    setDraftError(null);
    void api<ResearchEvaluationDraft>(`/api/research-records/draft/${draftScanId}`)
      .then((payload) => {
        if (isCancelled) return;
        setDraft(payload);
      })
      .catch((caught) => {
        if (isCancelled) return;
        setDraft(null);
        setDraftError(messageFor(caught, "Could not load evaluation draft"));
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingDraft(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [draftScanId]);

  return (
    <section className="researchWorkspace">
      <section className="researchHero">
        <div>
          <div className="eyebrow">Research Evaluation</div>
          <h2>Project Scan Records</h2>
          <p>
            Convert real repository scans into reusable evaluation records for your final report,
            viva walkthrough, and demo evidence table.
          </p>
        </div>
        <div className="researchActions">
          <button type="button" className="secondaryButton" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      <section className="researchCreatePanel">
        <div className="panelHeader compact">
          <h2>Create Research Evaluation</h2>
          <span>{draft ? `Scan ${shortId(draft.scan_id)}` : "Select project and scan"}</span>
        </div>
        <div className="researchCreateGrid">
          <label>
            <span>Project</span>
            <select value={selectedProjectId} onChange={(event) => onSelectProject(event.target.value)}>
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Scan</span>
            <select
              value={draftScanId}
              onChange={(event) => {
                const nextScanId = event.target.value;
                setDraftScanId(nextScanId);
                if (nextScanId) onSelectScan(nextScanId);
              }}
              disabled={!selectedProjectId || history.length === 0}
            >
              <option value="">{history.length === 0 ? "No scans available" : "Select a scan"}</option>
              {history.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {formatResearchScanOption(scan)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!selectedProjectId ? (
          <div className="emptyInline">Select a project first, then choose the scan you want to evaluate.</div>
        ) : history.length === 0 ? (
          <div className="emptyInline">This project has no scans yet. Run a scan first, then come back here to create the evaluation record.</div>
        ) : isLoadingDraft ? (
          <div className="emptyInline">Loading scan-derived evaluation values...</div>
        ) : draftError ? (
          <div className="error">{draftError}</div>
        ) : draft ? (
          <div className="researchDraftCard">
            <div className="researchDraftHeader">
              <div>
                <strong>{draft.repo_name}</strong>
                <small>{draft.commit_ref || "Commit/ref N/A"}</small>
              </div>
              <span className={`researchStatusBadge ${draft.accuracy_mode === "GROUND_TRUTH" ? "good" : "neutral"}`}>
                {draft.accuracy_mode === "GROUND_TRUTH"
                  ? `Ground truth matched${draft.matched_benchmark_name ? `: ${draft.matched_benchmark_name}` : ""}`
                  : "Manual validation required"}
              </span>
            </div>
            <div className="researchDraftGrid">
              <ResearchDraftMetric label="Services Expected" value={draft.expected_services ?? null} tone="neutral" />
              <ResearchDraftMetric label="Services Detected" value={draft.detected_services} tone="neutral" />
              <ResearchDraftMetric label="Findings" value={draft.total_findings} tone="neutral" />
              <ResearchDraftMetric label="TP" value={draft.true_positives ?? null} tone={draft.true_positives == null ? "neutral" : "good"} />
              <ResearchDraftMetric label="FP" value={draft.false_positives ?? null} tone={draft.false_positives == null ? "neutral" : "warn"} />
              <ResearchDraftMetric label="FN" value={draft.false_negatives ?? null} tone={draft.false_negatives == null ? "neutral" : "warn"} />
              <ResearchDraftMetric label="Precision" value={formatMetricValue(draft.precision)} tone="good" />
              <ResearchDraftMetric label="Recall" value={formatMetricValue(draft.recall)} tone="good" />
              <ResearchDraftMetric label="F1" value={formatMetricValue(draft.f1_score)} tone="good" />
            </div>
            <p className="researchDraftNotes">{draft.notes}</p>
            <div className="researchActions">
              <button type="button" onClick={() => onCreateFromScan(draft.scan_id)} disabled={isSaving}>
                {isSaving ? "Creating..." : "Create Evaluation From Selected Scan"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="researchSummaryGrid">
        <Metric label="Records" value={records.length} detail="Open-source project evaluations" kind="number" />
        <Metric label="Report Ready" value={reportReadyCount} detail="Marked suitable for final paper/demo" kind="number" />
        <Metric label="Avg Precision" value={formatMetricValue(averagePrecision)} detail="Calculated from saved records" kind="status" />
        <Metric label="Avg Recall" value={formatMetricValue(averageRecall)} detail="Calculated from saved records" kind="status" />
      </section>

      <section className="researchExportBar">
        <span>{records.length} records available for export</span>
        <div>
          <button type="button" className="secondaryButton" onClick={() => onExport("markdown")} disabled={isExporting || records.length === 0}>Markdown</button>
          <button type="button" className="secondaryButton" onClick={() => onExport("csv")} disabled={isExporting || records.length === 0}>CSV</button>
          <button type="button" className="secondaryButton" onClick={() => onExport("json")} disabled={isExporting || records.length === 0}>JSON</button>
        </div>
      </section>

      <section className="researchTablePanel">
        <div className="panelHeader compact">
          <h2>Evaluation Records Table</h2>
          <span>{isLoading ? "Loading" : `${records.length} rows`}</span>
        </div>
        {records.length === 0 ? (
          <div className="emptyInline">
            Create a research evaluation from a selected project scan to populate this table.
          </div>
        ) : (
          <div className="researchTableWrap">
            <table className="researchTable">
              <thead>
                <tr>
                  <th>Repo</th>
                  <th>Commit/Ref</th>
                  <th>Services Expected</th>
                  <th>Services Detected</th>
                  <th>Findings</th>
                  <th>TP</th>
                  <th>FP</th>
                  <th>FN</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className={selectedRecord?.id === record.id ? "selected" : ""}
                    onClick={() => onSelectRecord(record.id)}
                  >
                    <td><strong>{record.repo_name}</strong></td>
                    <td>{record.commit_ref || "N/A"}</td>
                    <td>{record.expected_services ?? "N/A"}</td>
                    <td>{record.detected_services}</td>
                    <td>{record.total_findings}</td>
                    <td>{record.true_positives ?? "N/A"}</td>
                    <td>{record.false_positives ?? "N/A"}</td>
                    <td>{record.false_negatives ?? "N/A"}</td>
                    <td>{formatMetricValue(record.precision)}</td>
                    <td>{formatMetricValue(record.recall)}</td>
                    <td>{formatMetricValue(record.f1_score)}</td>
                    <td>{record.notes || "Add notes"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRecord ? (
        <ResearchRecordEditor
          record={selectedRecord}
          isSaving={isSaving}
          selectedProjectId={selectedProjectId}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ) : null}
    </section>
  );
}

function ResearchRecordEditor({
  record,
  isSaving,
  selectedProjectId,
  onUpdate,
  onDelete
}: {
  record: ResearchEvaluationRecord;
  isSaving: boolean;
  selectedProjectId: string;
  onUpdate: (record: ResearchEvaluationRecord, patch: Partial<ResearchEvaluationRecord>) => void;
  onDelete: (recordId: string) => void;
}) {
  const [draft, setDraft] = React.useState<ResearchEvaluationRecord>(record);
  const [baselineDraft, setBaselineDraft] = React.useState<ResearchEvaluationDraft | null>(null);

  React.useEffect(() => {
    setDraft(record);
  }, [record]);

  React.useEffect(() => {
    if (!record.scan_id) {
      setBaselineDraft(null);
      return;
    }
    let isCancelled = false;
    void api<ResearchEvaluationDraft>(`/api/research-records/draft/${record.scan_id}`)
      .then((payload) => {
        if (isCancelled) return;
        setBaselineDraft(payload);
      })
      .catch(() => {
        if (isCancelled) return;
        setBaselineDraft(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [record.scan_id]);

  return (
    <section className="researchEditor panelBlock">
      <div className="panelHeader compact">
        <h2>Manual Evaluation Details</h2>
        <span>{record.suitable_for_report ? "Report-ready" : "Draft"}</span>
      </div>
      <div className="researchEditorSummary">
        <div>
          <span className="researchEditorLabel">Source scan</span>
          <strong>{record.scan_id ? shortId(record.scan_id) : "Not linked"}</strong>
          <small>{record.commit_ref || "Commit/ref N/A"}</small>
        </div>
        <div>
          <span className="researchEditorLabel">Project linkage</span>
          <strong>{record.scan_id ? "Traceable via scan_id" : "Manual record"}</strong>
          <small>{selectedProjectId ? "Current project context available" : "No project selected"}</small>
        </div>
        <div>
          <span className="researchEditorLabel">Metric source</span>
          <strong>
            {baselineDraft?.accuracy_mode === "GROUND_TRUTH"
              ? "Auto from benchmark ground truth"
              : "Manual validation / override"}
          </strong>
          <small>
            {baselineDraft?.matched_benchmark_name
              ? baselineDraft.matched_benchmark_name
              : "Researcher review determines TP / FP / FN"}
          </small>
        </div>
      </div>
      <div className="researchFormGrid">
        <ResearchTextInput
          label="Repository name"
          status={fieldSourceLabel("repo_name", draft, baselineDraft)}
          value={draft.repo_name}
          onChange={(value) => setDraft({ ...draft, repo_name: value })}
        />
        <ResearchTextInput
          label="Repository URL"
          status={fieldSourceLabel("repo_url", draft, baselineDraft)}
          value={draft.repo_url ?? ""}
          onChange={(value) => setDraft({ ...draft, repo_url: value })}
        />
        <ResearchTextInput
          label="Commit/ref"
          status={fieldSourceLabel("commit_ref", draft, baselineDraft)}
          value={draft.commit_ref ?? ""}
          onChange={(value) => setDraft({ ...draft, commit_ref: value })}
        />
        <ResearchTextInput
          label="Project type/framework"
          status={fieldSourceLabel("project_type", draft, baselineDraft)}
          value={draft.project_type ?? ""}
          onChange={(value) => setDraft({ ...draft, project_type: value })}
        />
        <ResearchNumberInput
          label="Services expected"
          status={fieldSourceLabel("expected_services", draft, baselineDraft)}
          value={draft.expected_services}
          onChange={(value) => setDraft({ ...draft, expected_services: value })}
        />
        <ResearchNumberInput
          label="True positives"
          status={fieldSourceLabel("true_positives", draft, baselineDraft)}
          value={draft.true_positives}
          onChange={(value) => setDraft({ ...draft, true_positives: value })}
        />
        <ResearchNumberInput
          label="False positives"
          status={fieldSourceLabel("false_positives", draft, baselineDraft)}
          value={draft.false_positives}
          onChange={(value) => setDraft({ ...draft, false_positives: value })}
        />
        <ResearchNumberInput
          label="False negatives"
          status={fieldSourceLabel("false_negatives", draft, baselineDraft)}
          value={draft.false_negatives}
          onChange={(value) => setDraft({ ...draft, false_negatives: value })}
        />
      </div>
      <div className="researchMetricPreview">
        <span>Precision: <strong>{formatMetricValue(draftMetricPreview(draft).precision)}</strong> <em>Calculated</em></span>
        <span>Recall: <strong>{formatMetricValue(draftMetricPreview(draft).recall)}</strong> <em>Calculated</em></span>
        <span>F1: <strong>{formatMetricValue(draftMetricPreview(draft).f1)}</strong> <em>Calculated</em></span>
      </div>
      <label htmlFor="expectedPatterns">Expected communication patterns</label>
      <textarea id="expectedPatterns" value={draft.expected_patterns ?? ""} onChange={(event) => setDraft({ ...draft, expected_patterns: event.target.value })} />
      <label htmlFor="detectedPatterns">Detected communication patterns</label>
      <textarea id="detectedPatterns" value={draft.detected_patterns ?? ""} onChange={(event) => setDraft({ ...draft, detected_patterns: event.target.value })} />
      <label htmlFor="researchNotes">Notes</label>
      <textarea id="researchNotes" value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      <label htmlFor="researchLimitations">Limitations</label>
      <textarea id="researchLimitations" value={draft.limitations ?? ""} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} />
      <label htmlFor="researchRelevance">Research relevance</label>
      <textarea id="researchRelevance" value={draft.research_relevance ?? ""} onChange={(event) => setDraft({ ...draft, research_relevance: event.target.value })} />
      <label className="reportReadyToggle">
        <input
          type="checkbox"
          checked={draft.suitable_for_report}
          onChange={(event) => setDraft({ ...draft, suitable_for_report: event.target.checked })}
        />
        <span>Suitable for final report/demo</span>
      </label>
      <div className="panelButtonRow">
        <button type="button" onClick={() => onUpdate(record, draft)} disabled={isSaving || !draft.repo_name.trim()}>
          {isSaving ? "Saving..." : "Save Evaluation Record"}
        </button>
        <button type="button" className="secondaryButton" onClick={() => onDelete(record.id)} disabled={isSaving}>
          Delete Record
        </button>
      </div>
    </section>
  );
}

function ResearchTextInput({
  label,
  status,
  value,
  onChange
}: {
  label: string;
  status?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}{status ? <em className="fieldStatus">{status}</em> : null}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ResearchNumberInput({
  label,
  status,
  value,
  onChange
}: {
  label: string;
  status?: string;
  value?: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      <span>{label}{status ? <em className="fieldStatus">{status}</em> : null}</span>
      <input
        type="number"
        min="0"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Math.max(0, Number(event.target.value)))}
      />
    </label>
  );
}

function ResearchDraftMetric({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number | null;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className={`researchDraftMetric ${tone}`}>
      <span>{label}</span>
      <strong>{value === null ? "N/A" : value}</strong>
    </div>
  );
}

function fieldSourceLabel(
  field: keyof Pick<
    ResearchEvaluationRecord,
    "repo_name" | "repo_url" | "commit_ref" | "project_type" | "expected_services" | "true_positives" | "false_positives" | "false_negatives"
  >,
  record: ResearchEvaluationRecord,
  baselineDraft: ResearchEvaluationDraft | null
) {
  if (!baselineDraft) {
    return field === "true_positives" || field === "false_positives" || field === "false_negatives"
      ? "Manual"
      : undefined;
  }
  const baselineValue = baselineDraft[field as keyof ResearchEvaluationDraft];
  const recordValue = record[field];
  if (normalizedComparable(recordValue) !== normalizedComparable(baselineValue)) {
    return "Override";
  }
  if (field === "true_positives" || field === "false_positives" || field === "false_negatives") {
    return baselineDraft.accuracy_mode === "GROUND_TRUTH" ? "Auto" : "Manual";
  }
  return "Auto";
}

function normalizedComparable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function formatResearchScanOption(scan: ScanRecord) {
  const branchOrRef = scan.commit_sha || scan.repo_ref || "no-ref";
  return `${shortId(scan.id)} - ${branchOrRef} - ${scan.finding_count} findings`;
}
