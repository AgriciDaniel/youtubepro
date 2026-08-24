export const WORKFLOW_HISTORY_LIMIT = 8;

export type WorkflowHistoryStep = "research" | "script" | "thumbnail";

export interface WorkflowTitleSignals {
  researchQuery?: string | null;
  scriptTitle?: string | null;
  scriptTopic?: string | null;
  thumbnailTopic?: string | null;
}

export interface WorkflowHistorySummary {
  id: string;
  title: string;
  currentStep: WorkflowHistoryStep;
  createdAt: number;
  updatedAt: number;
  hasResearch: boolean;
  hasScript: boolean;
  hasThumbnail: boolean;
}

const TITLE_LIMIT = 48;

export function deriveWorkflowTitle(signals: WorkflowTitleSignals): string {
  const candidates = [
    signals.researchQuery,
    signals.scriptTitle,
    signals.scriptTopic,
    signals.thumbnailTopic,
  ];
  const selected = candidates.find((candidate) => candidate?.trim())?.trim();
  if (!selected) return "Untitled workflow";
  return selected.length > TITLE_LIMIT
    ? `${selected.slice(0, TITLE_LIMIT - 1).trimEnd()}…`
    : selected;
}

export function sortAndLimitWorkflowSummaries(
  summaries: readonly WorkflowHistorySummary[],
  limit = WORKFLOW_HISTORY_LIMIT,
): WorkflowHistorySummary[] {
  const unique = new Map<string, WorkflowHistorySummary>();
  for (const summary of summaries) {
    const existing = unique.get(summary.id);
    if (!existing || existing.updatedAt < summary.updatedAt) unique.set(summary.id, summary);
  }
  return Array.from(unique.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, Math.max(0, limit));
}
