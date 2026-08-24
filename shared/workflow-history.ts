export const WORKFLOW_HISTORY_LIMIT = 8;
export const WORKFLOW_TITLE_LIMIT = 48;

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

export function normalizeCustomWorkflowTitle(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.slice(0, WORKFLOW_TITLE_LIMIT).trimEnd();
}

export function deriveWorkflowTitle(signals: WorkflowTitleSignals): string {
  const candidates = [
    signals.researchQuery,
    signals.scriptTitle,
    signals.scriptTopic,
    signals.thumbnailTopic,
  ];
  const selected = candidates.find((candidate) => candidate?.trim())?.trim();
  if (!selected) return "Untitled workflow";
  return selected.length > WORKFLOW_TITLE_LIMIT
    ? `${selected.slice(0, WORKFLOW_TITLE_LIMIT - 1).trimEnd()}…`
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
