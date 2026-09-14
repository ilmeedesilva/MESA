import React from "react";
import { DocLinkButton } from "./DocLinkButton";
import {
  aiAnswerProvider,
  aiStatusLabel,
  aiStatusTone,
  renderHighlightedText,
  shortId,
  summaryFindingTitle
} from "./viewHelpers";
import type {
  AIExplainerIntent,
  AIExplainerResponse,
  AIExplainerStatus,
  Finding,
  HealthScore,
  ScanRecord
} from "./types";

export function AIExplainerPanel({
  activeScan,
  compareBaseScan,
  response,
  status,
  streamingAnswer,
  question,
  isLoading,
  isCheckingStatus,
  urgentFinding,
  systemScore,
  policyText,
  onQuestionChange,
  onAsk,
  onApplyPolicyDraft,
  onRefreshStatus,
  onOpenDoc
}: {
  activeScan: ScanRecord | null;
  compareBaseScan: ScanRecord | null;
  response: AIExplainerResponse | null;
  status: AIExplainerStatus | null;
  streamingAnswer: string;
  question: string;
  isLoading: boolean;
  isCheckingStatus: boolean;
  urgentFinding: Finding | null;
  systemScore: HealthScore | null;
  policyText: string;
  onQuestionChange: (value: string) => void;
  onAsk: (
    intent: AIExplainerIntent,
    options?: {
      question?: string;
      findingId?: string;
      baseScanId?: string;
      targetScanId?: string;
      docQuery?: string;
      scoreTarget?: string;
      serviceName?: string;
    }
  ) => void;
  onApplyPolicyDraft: (draft: string) => void;
  onRefreshStatus: () => void;
  onOpenDoc: (slug: string) => void;
}) {
  const answerProvider = aiAnswerProvider(response?.source);
  return (
    <section className="aiExplainerPanel">
      <div className="aiExplainerHeader">
        <div>
          <div className="eyebrow">AI Explainer</div>
          <h2>Ask MESA for grounded interpretation</h2>
          <p>
            This assistant explains scan results from deterministic findings, scores, scan history, and local
            documentation. It does not replace the detector.
          </p>
          <div className="docLinks">
            <DocLinkButton label="AI explainer guide" onClick={() => onOpenDoc("ai-explainer-guide")} />
            <DocLinkButton label="User guide" onClick={() => onOpenDoc("user-guide")} />
          </div>
        </div>
        <div className="aiStatusCard">
          <strong>{activeScan ? `Scan ${shortId(activeScan.id)}` : "No active scan"}</strong>
          <span>
            {response
              ? response.source.startsWith("openai-hybrid")
                ? "Live OpenAI hybrid response"
                : "Grounded MESA fallback response"
              : isLoading
                ? "Streaming response in progress"
                : "Waiting for a question"}
          </span>
          <button type="button" className="secondaryButton" onClick={onRefreshStatus} disabled={isCheckingStatus}>
            {isCheckingStatus ? "Checking..." : "Refresh AI Status"}
          </button>
        </div>
      </div>

      <div className="aiWorkspaceGrid">
        <div className="aiAskPane">
          <div className={`aiConnectionBanner ${status ? aiStatusTone(status.state) : "neutral"}`}>
            <strong>{status ? aiStatusLabel(status.state) : "AI status unavailable"}</strong>
            <span>{status?.message ?? "MESA could not load the AI configuration status right now."}</span>
            {status ? (
              <small>
                Mode: <code>{status.mode}</code> | Model: <code>{status.model}</code>
                {status.api_key_hint ? <> | Key: <code>{status.api_key_hint}</code></> : null}
              </small>
            ) : null}
          </div>

          <div className="aiPromptGrid">
            <button type="button" className="aiQuickAction" onClick={() => onAsk("SCAN_SUMMARY")} disabled={!activeScan || isLoading}>
              <strong>Summarize this scan</strong>
              <span>Get a short explanation of the overall result.</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("PRIORITIZE_FIXES", { question: "Explain simply what should be solved first." })} disabled={!activeScan || isLoading}>
              <strong>What should I fix first?</strong>
              <span>Prioritize the most important architecture issues.</span>
            </button>
            <button
              type="button"
              className="aiQuickAction"
              onClick={() => onAsk("FINDING_EXPLANATION", { findingId: urgentFinding?.id })}
              disabled={!activeScan || !urgentFinding || isLoading}
            >
              <strong>Explain the top finding</strong>
              <span>{urgentFinding ? summaryFindingTitle(urgentFinding) : "Available after a scan"}</span>
            </button>
            <button
              type="button"
              className="aiQuickAction"
              onClick={() => onAsk("HEALTH_SCORE_EXPLANATION", { scoreTarget: systemScore ? `system:${systemScore.target}` : "system" })}
              disabled={!activeScan || !systemScore || isLoading}
            >
              <strong>Explain the health score</strong>
              <span>{systemScore ? `${systemScore.score.toFixed(1)}/100 ${systemScore.grade}` : "Available after a scan"}</span>
            </button>
            <button
              type="button"
              className="aiQuickAction"
              onClick={() =>
                compareBaseScan &&
                onAsk("COMPARE_SCANS", { baseScanId: compareBaseScan.id, targetScanId: activeScan?.id })
              }
              disabled={!activeScan || !compareBaseScan || isLoading}
            >
              <strong>Compare with previous scan</strong>
              <span>{compareBaseScan ? `Against ${shortId(compareBaseScan.id)}` : "Need at least two scans"}</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("GOVERNANCE_POLICY_HELP")} disabled={!activeScan || isLoading}>
              <strong>Explain governance</strong>
              <span>Review active rules and policy violations.</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("POLICY_WRITING_ASSISTANCE")} disabled={!activeScan || isLoading}>
              <strong>Draft policy YAML</strong>
              <span>Suggest governance rules from the current scan.</span>
            </button>
            <button type="button" className="aiQuickAction" onClick={() => onAsk("DOC_QA", { question: "How do I use this tool?", docQuery: "How do I use this tool?" })} disabled={isLoading}>
              <strong>Ask from docs</strong>
              <span>Use in-product documentation as the answer source.</span>
            </button>
          </div>

          <div className="aiQuestionBar">
            <label htmlFor="aiQuestion">Custom question</label>
            <div className="aiQuestionControls">
              <input
                id="aiQuestion"
                placeholder="Example: Explain simply what should be solved first."
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
              />
              <button
                type="button"
                onClick={() => onAsk(activeScan ? "AUTO" : "DOC_QA", { question, docQuery: question })}
                disabled={isLoading || !question.trim()}
              >
                {isLoading ? "Thinking..." : "Ask MESA"}
              </button>
            </div>
          </div>

          <div className="aiHelperCard">
            <strong>Current policy editor</strong>
            <span>{policyText.trim() ? "Policy YAML is loaded and ready for AI drafting help." : "No policy YAML loaded yet."}</span>
          </div>
        </div>

        {!response && !isLoading ? (
          <div className="aiEmptyState">
            Ask for a summary, fix priority, health explanation, scan comparison, or documentation help.
          </div>
        ) : (
          <div className="aiResponseCard">
          <div className="aiResponseHeader">
            <div>
              <div className="findingMeta">
                <span>{response?.source ?? "streaming"}</span>
                <strong className={`severity ${(response?.confidence ?? "MODERATE").toLowerCase()}`}>{response?.confidence ?? "MODERATE"}</strong>
              </div>
              <div className={`aiAnswerBadge ${answerProvider.tone}`}>
                {answerProvider.label}
              </div>
              <h3>{response?.title ?? "MESA is preparing the answer..."}</h3>
            </div>
            <span className="modePill">{(response?.intent ?? "AUTO").replace(/_/g, " ")}</span>
          </div>
            <p className="aiAnswer">{streamingAnswer || response?.answer || "Waiting for response..."}</p>

            {response?.policy_document ? (
              <div className="aiPolicyDraftCard">
                <div className="aiPolicyDraftHeader">
                  <strong>Suggested policy draft</strong>
                  <button type="button" className="aiDraftActionButton" onClick={() => onApplyPolicyDraft(response.policy_document ?? "")}>
                    Use this draft
                  </button>
                </div>
                <pre>{response.policy_document}</pre>
              </div>
            ) : null}

            {response?.evidence.length ? (
              <div className="aiEvidenceGrid">
                {response.evidence.map((item) => (
                  <article key={`${item.kind}-${item.pointer}-${item.label}`} className="aiEvidenceCard">
                    <small>{item.kind}</small>
                    <strong>{item.label}</strong>
                    <code>{item.pointer}</code>
                    <p>{renderHighlightedText(item.snippet)}</p>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="aiResponseColumns">
              <div>
                <strong>Suggestions</strong>
                {response?.suggestions.length ? (
                  <ul className="aiList">
                    {response.suggestions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <div className="emptyInline">No suggestions returned.</div>
                )}
              </div>
              <div>
                <strong>Limitations</strong>
                {response?.limitations.length ? (
                  <ul className="aiList">
                    {response.limitations.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <div className="emptyInline">No limitations returned.</div>
                )}
              </div>
            </div>

            {response?.follow_up_questions.length ? (
              <div className="aiFollowUps">
                <strong>Try next</strong>
                <div className="docLinks">
                  {response.follow_up_questions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="docLinkButton"
                      onClick={() => onAsk(activeScan ? "AUTO" : "DOC_QA", { question: item, docQuery: item })}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
