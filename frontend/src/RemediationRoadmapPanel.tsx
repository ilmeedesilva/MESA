import React from "react";
import { DocLinkButton } from "./DocLinkButton";
import { DimensionBars } from "./FindingDrawer";
import { bucketLabel } from "./demoMode";
import { formatType, gradeTone } from "./viewHelpers";
import type { HealthScore, RefactoringPlaybook, RemediationRoadmap, RoadmapAction } from "./types";

export function RemediationRoadmapPanel({
  roadmap,
  isLoading,
  onOpenDoc
}: {
  roadmap: RemediationRoadmap | null;
  isLoading: boolean;
  onOpenDoc: (slug: string) => void;
}) {
  const actionById = React.useMemo(() => {
    const allActions = [
      ...(roadmap?.quick_wins ?? []),
      ...(roadmap?.medium_term_changes ?? []),
      ...(roadmap?.high_effort_refactors ?? [])
    ];
    return new Map(allActions.map((action) => [action.id, action]));
  }, [roadmap]);

  return (
    <section className="roadmapPanel">
      <div className="panelHeader compact">
        <div>
          <h2>Remediation Roadmap</h2>
          <p>One grouped plan that turns separate findings into a practical order of work.</p>
          <div className="docLinks">
            <DocLinkButton label="Roadmap guide" onClick={() => onOpenDoc("remediation-roadmap-guide")} />
          </div>
        </div>
        <span>
          {roadmap
            ? `${roadmap.suggested_order.length} actions`
            : isLoading
              ? "Building roadmap"
              : "No roadmap yet"}
        </span>
      </div>

      {isLoading ? <div className="emptyInline">Building the grouped remediation roadmap for this scan...</div> : null}
      {!isLoading && !roadmap ? <div className="emptyInline">Run or load a scan to generate the roadmap.</div> : null}

      {roadmap ? (
        <div className="roadmapLayout">
          <div className="roadmapTopline">
            <div className="roadmapSummaryCard">
              <strong>Roadmap summary</strong>
              <p>{roadmap.summary}</p>
            </div>
            <div className="roadmapStats">
              <div>
                <strong>{roadmap.quick_wins.length}</strong>
                <span>Quick wins</span>
              </div>
              <div>
                <strong>{roadmap.medium_term_changes.length}</strong>
                <span>Medium-term</span>
              </div>
              <div>
                <strong>{roadmap.high_effort_refactors.length}</strong>
                <span>High-effort</span>
              </div>
              <div>
                <strong>
                  {roadmap.system_health_score !== undefined && roadmap.system_health_score !== null
                    ? Math.round(roadmap.system_health_score)
                    : "--"}
                </strong>
                <span>System health</span>
              </div>
            </div>
          </div>

          <div className="roadmapGrid">
            <RoadmapBucketColumn
              title="Quick Wins"
              subtitle="Low-friction fixes that reduce noise and operational coupling first."
              actions={roadmap.quick_wins}
              tone="quick"
            />
            <RoadmapBucketColumn
              title="Medium-Term Changes"
              subtitle="Boundary improvements that make the architecture easier to work with."
              actions={roadmap.medium_term_changes}
              tone="medium"
            />
            <RoadmapBucketColumn
              title="High-Effort Refactors"
              subtitle="Deeper structural changes that reshape ownership or service boundaries."
              actions={roadmap.high_effort_refactors}
              tone="high"
            />
          </div>

          <div className="roadmapBottomGrid">
            <div className="roadmapOrderCard">
              <div className="roadmapSectionHeader">
                <strong>Suggested order</strong>
                <span>Follow this execution path</span>
              </div>
              <div className="roadmapOrderList">
                {roadmap.suggested_order.map((step) => (
                  <article key={step.action_id} className="roadmapOrderItem">
                    <div className="roadmapOrderBadge">{step.order}</div>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{bucketLabel(step.bucket)}</small>
                      <p>{step.why_now}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="roadmapDependencyCard">
              <div className="roadmapSectionHeader">
                <strong>Dependencies</strong>
                <span>What should happen after what</span>
              </div>
              {roadmap.dependencies.length === 0 ? (
                <div className="emptyInline">No hard dependencies were detected between roadmap actions.</div>
              ) : (
                <div className="roadmapDependencyList">
                  {roadmap.dependencies.map((dependency) => (
                    <article key={`${dependency.action_id}-${dependency.depends_on}`} className="roadmapDependencyItem">
                      <strong>
                        {actionById.get(dependency.depends_on)?.title ?? dependency.depends_on}
                        {" -> "}
                        {actionById.get(dependency.action_id)?.title ?? dependency.action_id}
                      </strong>
                      <p>{dependency.reason}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RoadmapBucketColumn({
  title,
  subtitle,
  actions,
  tone
}: {
  title: string;
  subtitle: string;
  actions: RoadmapAction[];
  tone: "quick" | "medium" | "high";
}) {
  return (
    <section className={`roadmapColumn ${tone}`}>
      <div className="roadmapSectionHeader">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {actions.length === 0 ? <div className="emptyInline">No actions in this bucket for the current scan.</div> : null}
      {actions.length > 0 ? (
        <div className="roadmapActionList">
          {actions.map((action) => (
            <article key={action.id} className="roadmapActionCard">
              <div className="roadmapActionMeta">
                <span>{`#${action.priority_rank}`}</span>
                <strong>{Math.round(action.priority_score)}</strong>
              </div>
              <h3>{action.title}</h3>
              <p>{action.summary}</p>
              <div className="roadmapTagRow">
                <span>{action.estimated_difficulty}</span>
                {action.metrics.max_severity ? <span>{action.metrics.max_severity}</span> : null}
                <span>{`${action.related_findings.length} finding${action.related_findings.length === 1 ? "" : "s"}`}</span>
              </div>
              {action.affected_services.length > 0 ? (
                <div className="serviceChips compact">
                  {action.affected_services.map((service) => <span key={service}>{service}</span>)}
                </div>
              ) : null}
              <dl className="roadmapActionDetails">
                <div>
                  <dt>Benefit</dt>
                  <dd>{action.expected_benefit}</dd>
                </div>
                <div>
                  <dt>Why now</dt>
                  <dd>{action.suggested_order_reason}</dd>
                </div>
              </dl>
              {action.metrics.impacted_dimensions?.length ? (
                <div className="roadmapDimensions">
                  {action.metrics.impacted_dimensions.map((dimension) => <code key={dimension}>{formatType(dimension)}</code>)}
                </div>
              ) : null}
              {action.playbook ? <RefactoringPlaybookDetails playbook={action.playbook} /> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RefactoringPlaybookDetails({ playbook }: { playbook: RefactoringPlaybook }) {
  return (
    <details className="playbookDetails">
      <summary>
        <span>Refactoring playbook</span>
        <small>{playbook.estimated_effort}</small>
      </summary>
      <div className="playbookBody">
        <div className="playbookBlock">
          <strong>Strategy</strong>
          <p>{playbook.recommended_strategy}</p>
        </div>
        <div className="playbookPhaseList">
          {playbook.phases.map((phase) => (
            <article key={phase.title} className="playbookPhase">
              <strong>{phase.title}</strong>
              <p>{phase.objective}</p>
              <ul>
                {phase.steps.map((step) => <li key={step}>{step}</li>)}
              </ul>
              {phase.verification_checks.length ? (
                <div className="playbookChecks">
                  {phase.verification_checks.map((check) => <span key={check}>{check}</span>)}
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <div className="playbookGrid">
          <PlaybookList title="Verification" items={playbook.verification_checks} />
          <PlaybookList title="Rollback" items={playbook.rollback_plan} />
          <PlaybookList title="Risks" items={playbook.risks} />
        </div>
      </div>
    </details>
  );
}

function PlaybookList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="playbookList">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export function HealthScoreView({
  systemScore,
  serviceScores,
  onOpenDoc
}: {
  systemScore: HealthScore | null;
  serviceScores: HealthScore[];
  onOpenDoc: (slug: string) => void;
}) {
  const sortedServices = [...serviceScores].sort((a, b) => a.score - b.score).slice(0, 6);
  return (
    <section className="healthPanel">
      <div className="panelHeader compact">
        <div>
          <h2>Health Scores</h2>
          <p>Service, domain, and system-level architecture quality</p>
          <div className="docLinks">
            <DocLinkButton label="Health score guide" onClick={() => onOpenDoc("health-score-guide")} />
          </div>
        </div>
      </div>
      {!systemScore ? <div className="emptyList">No health score available yet.</div> : null}
      {systemScore ? (
        <div className={`systemScore ${gradeTone(systemScore.grade)}`}>
          <strong>{systemScore.score.toFixed(1)}</strong>
          <span>{systemScore.grade}</span>
          <p>{systemScore.explanation}</p>
        </div>
      ) : null}
      {systemScore ? <DimensionBars breakdown={systemScore.breakdown} /> : null}
      {sortedServices.length > 0 ? (
        <div className="serviceScores">
          <h3>Lowest Service Scores</h3>
          {sortedServices.map((score) => (
            <div key={score.target} className="scoreRow">
              <span>{score.target}</span>
              <meter min="0" max="100" value={score.score} />
              <strong>{score.score.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
