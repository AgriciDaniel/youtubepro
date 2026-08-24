import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type {
  EvidenceClaim,
  IdeaPackage,
  ScriptEvidenceContext,
  ScriptResult,
  SearchResponse,
  Video,
} from "@shared/schema";
import {
  deriveWorkflowTitle,
  sortAndLimitWorkflowSummaries,
  type WorkflowHistorySummary,
} from "@shared/workflow-history";
import {
  deleteWorkflowRecord,
  getWorkflowRecord,
  listWorkflowRecords,
  pruneWorkflowRecords,
  putWorkflowRecord,
  type StoredWorkflowRecord,
} from "@/lib/workflow-storage";

interface ResearchInsights {
  peopleAlsoAsk?: { question: string; answer: string }[];
  targetAudience?: {
    primaryDemographic: string;
    ageRange: string;
    interests: string[];
    painPoints?: string[];
    contentPreferences?: string[];
  };
  nicheAnalysis?: {
    competitionLevel: string;
    growthTrend: string;
    bestPostingTimes: string[];
    recommendedFormats: string[];
    monetizationPotential: string;
  };
  contentGaps?: string[];
  trendingSubtopics?: string[];
  evidenceClaims?: EvidenceClaim[];
}

interface CachedAnalytics {
  totalViews: number;
  avgViews: number;
  avgEngagement: string;
  totalVideos: number;
  totalEngagement: number;
  viewsDistribution: { name: string; views: number; likes: number }[];
  durationData: { name: string; value: number }[];
  topVideo: Video | null;
  topVideosList: Video[];
}

interface CachedResearchData {
  query: string;
  totalResults: number;
  resultsPerPage?: number;
  regionCode?: string;
  nextPageToken?: string;
  videos: Video[];
  insights: ResearchInsights | null;
  analytics: CachedAnalytics | null;
  filters: { uploadDate: string; duration: string; sortBy: string };
  timestamp: number;
  snapshotId?: string;
  retrievedAt?: string;
  totalResultsIsApproximate?: boolean;
  warnings?: SearchResponse["warnings"];
  enrichment?: SearchResponse["enrichment"];
  provenance?: SearchResponse["provenance"];
}

interface IdeaData {
  selectedIdea: IdeaPackage | null;
  generatedIdeas?: IdeaPackage[];
  niche: string;
  audience: string;
  evidenceContext?: ScriptEvidenceContext;
}

interface ScriptData {
  script: string;
  topic: string;
  title?: string;
  format: string;
  audience: string;
  persona?: string;
  keywords?: string[];
  wordCount?: number;
  estimatedDuration?: string;
  customPersona?: string;
  additionalNotes?: string;
  timestamp: number;
  evidenceContext?: ScriptEvidenceContext;
  result?: ScriptResult;
}

interface ThumbnailData {
  topic: string;
  thumbnailStyle: string;
  mainText: string;
  subText: string;
  description: string;
  composition: string;
  cameraAngle: string;
  lighting: string;
  colorScheme: string;
  textPosition: string;
  presetId: string;
  autoBlend: boolean;
  thumbnailData: string | null;
  resultModel: string | null;
  timestamp: number;
}

export type WorkflowStep = "research" | "script" | "thumbnail";

interface WorkflowState {
  id: string | null;
  title: string;
  createdAt: number | null;
  updatedAt: number | null;
  currentStep: WorkflowStep;
  isWorkflowActive: boolean;
  cachedResearch: CachedResearchData | null;
  idea: IdeaData | null;
  cachedScript: ScriptData | null;
  cachedThumbnail: ThumbnailData | null;
  highlightSearchBox: boolean;
  highlightTrigger: number;
}

interface WorkflowContextType {
  state: WorkflowState;
  recentWorkflows: WorkflowHistorySummary[];
  historyLoading: boolean;
  historyError: string | null;
  startWorkflow: () => void;
  openWorkflow: (id: string) => Promise<WorkflowStep | null>;
  removeWorkflow: (id: string) => Promise<void>;
  endWorkflow: () => void;
  setCachedResearch: (data: CachedResearchData) => void;
  setIdeaData: (data: IdeaData) => void;
  setScriptData: (data: ScriptData) => void;
  setThumbnailData: (data: ThumbnailData) => void;
  clearScriptCache: () => void;
  goToStep: (step: WorkflowStep | "ideas") => void;
  clearWorkflow: () => void;
  clearHighlight: () => void;
  clearResearchCache: () => void;
}

const LEGACY_STORAGE_KEY = "youtube_research_workflow";
const ACTIVE_WORKFLOW_KEY = "youtube_pro_active_workflow";

function createEmptyState(id: string | null = null, now: number | null = null): WorkflowState {
  return {
    id,
    title: "Untitled workflow",
    createdAt: now,
    updatedAt: now,
    currentStep: "research",
    isWorkflowActive: Boolean(id),
    cachedResearch: null,
    idea: null,
    cachedScript: null,
    cachedThumbnail: null,
    highlightSearchBox: false,
    highlightTrigger: 0,
  };
}

function createWorkflowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStep(step: unknown): WorkflowStep {
  return step === "script" || step === "thumbnail" ? step : "research";
}

function restorableStep(state: WorkflowState): WorkflowStep {
  if (state.currentStep === "thumbnail" && state.cachedThumbnail) return "thumbnail";
  if (state.currentStep === "script" && state.cachedScript?.script) return "script";
  if (state.currentStep === "research" && state.cachedResearch) return "research";
  if (state.cachedThumbnail?.thumbnailData) return "thumbnail";
  if (state.cachedScript?.script) return "script";
  return "research";
}

function normalizeState(value: Partial<WorkflowState>, fallbackId?: string): WorkflowState {
  const now = Date.now();
  const id = typeof value.id === "string" && value.id ? value.id : fallbackId || createWorkflowId();
  const createdAt = typeof value.createdAt === "number" ? value.createdAt : now;
  const normalized: WorkflowState = {
    ...createEmptyState(id, createdAt),
    ...value,
    id,
    title: typeof value.title === "string" && value.title.trim() ? value.title : "Untitled workflow",
    createdAt,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : createdAt,
    currentStep: normalizeStep(value.currentStep),
    isWorkflowActive: true,
    cachedResearch: value.cachedResearch || null,
    idea: value.idea || null,
    cachedScript: value.cachedScript || null,
    cachedThumbnail: value.cachedThumbnail || null,
    highlightSearchBox: false,
    highlightTrigger: 0,
  };
  return {
    ...normalized,
    title: deriveWorkflowTitle({
      researchQuery: normalized.cachedResearch?.query,
      scriptTitle: normalized.cachedScript?.title,
      scriptTopic: normalized.cachedScript?.topic,
      thumbnailTopic: normalized.cachedThumbnail?.topic,
    }),
  };
}

function updateState(previous: WorkflowState, changes: Partial<WorkflowState>): WorkflowState {
  const now = Date.now();
  const next = {
    ...previous,
    ...changes,
    id: previous.id || createWorkflowId(),
    createdAt: previous.createdAt || now,
    updatedAt: now,
    isWorkflowActive: true,
  };
  return {
    ...next,
    title: deriveWorkflowTitle({
      researchQuery: next.cachedResearch?.query,
      scriptTitle: next.cachedScript?.title,
      scriptTopic: next.cachedScript?.topic,
      thumbnailTopic: next.cachedThumbnail?.topic,
    }),
  };
}

function summaryFromState(state: WorkflowState): WorkflowHistorySummary | null {
  if (!state.id || !state.createdAt || !state.updatedAt) return null;
  return {
    id: state.id,
    title: state.title,
    currentStep: state.currentStep,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    hasResearch: Boolean(state.cachedResearch),
    hasScript: Boolean(state.cachedScript?.script),
    hasThumbnail: Boolean(state.cachedThumbnail?.thumbnailData),
  };
}

function recordsToSummaries(records: StoredWorkflowRecord<WorkflowState>[]): WorkflowHistorySummary[] {
  return sortAndLimitWorkflowSummaries(records.flatMap((record) => {
    const summary = summaryFromState(normalizeState(record.state, record.id));
    return summary ? [summary] : [];
  }));
}

function readLegacyState(): Partial<WorkflowState> | null {
  try {
    const stored = window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
    return stored ? JSON.parse(stored) as Partial<WorkflowState> : null;
  } catch (error) {
    console.error("Failed to read the legacy workflow cache:", error);
    return null;
  }
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkflowState>(() => createEmptyState());
  const [recentWorkflows, setRecentWorkflows] = useState<WorkflowHistorySummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const queueSave = useCallback((nextState: WorkflowState) => {
    const summary = summaryFromState(nextState);
    if (!summary || !nextState.id || !nextState.createdAt || !nextState.updatedAt) return;
    setRecentWorkflows((current) => sortAndLimitWorkflowSummaries([summary, ...current]));
    window.localStorage.setItem(ACTIVE_WORKFLOW_KEY, nextState.id);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      await putWorkflowRecord({
        id: nextState.id as string,
        createdAt: nextState.createdAt as number,
        updatedAt: nextState.updatedAt as number,
        state: { ...nextState, highlightSearchBox: false, highlightTrigger: 0 },
      });
      const removed = await pruneWorkflowRecords();
      if (removed.length > 0) setRecentWorkflows((current) => current.filter((item) => !removed.includes(item.id)));
      setHistoryError(null);
    }).catch((error) => {
      console.error("Failed to save workflow history:", error);
      setHistoryError("Recent workflows could not be saved in this browser.");
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const records = await listWorkflowRecords<WorkflowState>();
        if (cancelled) return;
        const activeId = window.localStorage.getItem(ACTIVE_WORKFLOW_KEY);
        let selectedRecord = records.find((record) => record.id === activeId) || records[0];
        if (!selectedRecord) {
          const migrated = normalizeState(readLegacyState() || {});
          selectedRecord = {
            id: migrated.id as string,
            createdAt: migrated.createdAt as number,
            updatedAt: migrated.updatedAt as number,
            state: migrated,
          };
          await putWorkflowRecord(selectedRecord);
          window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
          records.unshift(selectedRecord);
        }
        setState(normalizeState(selectedRecord.state, selectedRecord.id));
        setRecentWorkflows(recordsToSummaries(records));
        window.localStorage.setItem(ACTIVE_WORKFLOW_KEY, selectedRecord.id);
      } catch (error) {
        console.error("Failed to load workflow history:", error);
        if (!cancelled) {
          const fallback = normalizeState(readLegacyState() || {});
          const summary = summaryFromState(fallback);
          setState(fallback);
          setRecentWorkflows(summary ? [summary] : []);
          setHistoryError("Recent workflows are unavailable. The current workflow will remain open for this session.");
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setHistoryLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hydrated) queueSave(state);
  }, [hydrated, queueSave, state]);

  const startWorkflow = useCallback(() => {
    const now = Date.now();
    setState((previous) => ({
      ...createEmptyState(createWorkflowId(), now),
      highlightSearchBox: true,
      highlightTrigger: previous.highlightTrigger + 1,
    }));
  }, []);

  const openWorkflow = useCallback(async (id: string): Promise<WorkflowStep | null> => {
    try {
      await saveQueueRef.current;
      const record = await getWorkflowRecord<WorkflowState>(id);
      if (!record) {
        setRecentWorkflows((current) => current.filter((item) => item.id !== id));
        setHistoryError("That workflow is no longer available in local history.");
        return null;
      }
      const restored = normalizeState(record.state, record.id);
      restored.currentStep = restorableStep(restored);
      setState(restored);
      window.localStorage.setItem(ACTIVE_WORKFLOW_KEY, id);
      setHistoryError(null);
      return restored.currentStep;
    } catch (error) {
      console.error("Failed to open workflow:", error);
      setHistoryError("The selected workflow could not be opened.");
      return null;
    }
  }, []);

  const removeWorkflow = useCallback(async (id: string) => {
    await saveQueueRef.current;
    await deleteWorkflowRecord(id);
    const records = await listWorkflowRecords<WorkflowState>();
    setRecentWorkflows(recordsToSummaries(records));
    if (state.id === id) {
      const next = records[0];
      if (next) {
        const restored = normalizeState(next.state, next.id);
        setState(restored);
        window.localStorage.setItem(ACTIVE_WORKFLOW_KEY, restored.id as string);
      } else {
        const now = Date.now();
        setState(createEmptyState(createWorkflowId(), now));
      }
    }
  }, [state.id]);

  const clearHighlight = useCallback(() => setState((previous) => ({ ...previous, highlightSearchBox: false })), []);
  const endWorkflow = useCallback(() => setState((previous) => ({ ...previous, isWorkflowActive: false })), []);
  const setCachedResearch = useCallback((data: CachedResearchData) => setState((previous) => updateState(previous, { cachedResearch: data })), []);
  const setIdeaData = useCallback((data: IdeaData) => setState((previous) => updateState(previous, { idea: data })), []);
  const goToStep = useCallback((step: WorkflowStep | "ideas") => setState((previous) => updateState(previous, { currentStep: step === "ideas" ? "research" : step })), []);
  const clearWorkflow = useCallback(() => setState((previous) => {
    const now = Date.now();
    return { ...createEmptyState(previous.id || createWorkflowId(), previous.createdAt || now), updatedAt: now, highlightTrigger: previous.highlightTrigger };
  }), []);
  const clearResearchCache = useCallback(() => setState((previous) => updateState(previous, { currentStep: "research", cachedResearch: null, idea: null })), []);
  const setScriptData = useCallback((data: ScriptData) => setState((previous) => updateState(previous, { cachedScript: data })), []);
  const clearScriptCache = useCallback(() => setState((previous) => updateState(previous, { cachedScript: null })), []);
  const setThumbnailData = useCallback((data: ThumbnailData) => setState((previous) => updateState(previous, { cachedThumbnail: data })), []);

  return (
    <WorkflowContext.Provider value={{
      state, recentWorkflows, historyLoading, historyError, startWorkflow, openWorkflow, removeWorkflow,
      endWorkflow, setCachedResearch, setIdeaData, setScriptData, setThumbnailData, clearScriptCache,
      goToStep, clearWorkflow, clearHighlight, clearResearchCache,
    }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) throw new Error("useWorkflow must be used within a WorkflowProvider");
  return context;
}

export type { CachedResearchData, IdeaData, ResearchInsights, ScriptData, ThumbnailData, WorkflowState };
