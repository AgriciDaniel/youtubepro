import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { EvidenceClaim, IdeaPackage, ScriptEvidenceContext, SearchResponse, Video } from "@shared/schema";

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
  videos: Video[];
  insights: ResearchInsights | null;
  analytics: CachedAnalytics | null;
  filters: {
    uploadDate: string;
    duration: string;
    sortBy: string;
  };
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
  timestamp: number;
  evidenceContext?: ScriptEvidenceContext;
}

export type WorkflowStep = "research" | "script" | "thumbnail";

interface WorkflowState {
  currentStep: WorkflowStep;
  isWorkflowActive: boolean;
  cachedResearch: CachedResearchData | null;
  idea: IdeaData | null;
  cachedScript: ScriptData | null;
  highlightSearchBox: boolean;
  highlightTrigger: number;
}

interface WorkflowContextType {
  state: WorkflowState;
  startWorkflow: () => void;
  endWorkflow: () => void;
  setCachedResearch: (data: CachedResearchData) => void;
  setIdeaData: (data: IdeaData) => void;
  setScriptData: (data: ScriptData) => void;
  clearScriptCache: () => void;
  goToStep: (step: WorkflowStep | "ideas") => void;
  clearWorkflow: () => void;
  clearHighlight: () => void;
  clearResearchCache: () => void;
}

const STORAGE_KEY = "youtube_research_workflow";

const initialState: WorkflowState = {
  currentStep: "research",
  isWorkflowActive: false,
  cachedResearch: null,
  idea: null,
  cachedScript: null,
  highlightSearchBox: false,
  highlightTrigger: 0,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function loadFromStorage(): WorkflowState {
  if (!isBrowser()) return initialState;

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        currentStep: parsed.currentStep === "ideas" ? "research" : parsed.currentStep,
        highlightSearchBox: false,
        highlightTrigger: 0,
      };
    }
  } catch (e) {
    console.error("Failed to load workflow state from storage:", e);
  }
  return initialState;
}

function saveToStorage(state: WorkflowState) {
  if (!isBrowser()) return;

  try {
    const toStore = {
      currentStep: state.currentStep,
      isWorkflowActive: state.isWorkflowActive,
      cachedResearch: state.cachedResearch,
      idea: state.idea,
      cachedScript: state.cachedScript,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error("Failed to save workflow state to storage:", e);
  }
}

function removeFromStorage() {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to remove workflow state from storage:", e);
  }
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkflowState>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const startWorkflow = useCallback(() => {
    setState(prev => ({
      ...initialState,
      isWorkflowActive: true,
      currentStep: "research",
      highlightSearchBox: true,
      highlightTrigger: prev.highlightTrigger + 1,
    }));
  }, []);

  const clearHighlight = useCallback(() => {
    setState(prev => ({ ...prev, highlightSearchBox: false }));
  }, []);

  const endWorkflow = useCallback(() => {
    setState(initialState);
    removeFromStorage();
  }, []);

  const setCachedResearch = useCallback((data: CachedResearchData) => {
    setState(prev => ({
      ...prev,
      cachedResearch: data,
      isWorkflowActive: true,
    }));
  }, []);

  const setIdeaData = useCallback((data: IdeaData) => {
    setState(prev => ({
      ...prev,
      idea: data,
    }));
  }, []);

  const goToStep = useCallback((step: WorkflowStep | "ideas") => {
    setState(prev => ({ ...prev, currentStep: step === "ideas" ? "research" : step }));
  }, []);

  const clearWorkflow = useCallback(() => {
    setState(initialState);
    removeFromStorage();
  }, []);

  const clearResearchCache = useCallback(() => {
    setState(prev => ({
      ...initialState,
      cachedResearch: null,
      isWorkflowActive: false,
      highlightTrigger: prev.highlightTrigger,
    }));
  }, []);

  const setScriptData = useCallback((data: ScriptData) => {
    setState(prev => ({
      ...prev,
      cachedScript: data,
    }));
  }, []);

  const clearScriptCache = useCallback(() => {
    setState(prev => ({
      ...prev,
      cachedScript: null,
    }));
  }, []);

  return (
    <WorkflowContext.Provider
      value={{
        state,
        startWorkflow,
        endWorkflow,
        setCachedResearch,
        setIdeaData,
        setScriptData,
        clearScriptCache,
        goToStep,
        clearWorkflow,
        clearHighlight,
        clearResearchCache,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
}

export type { CachedResearchData, IdeaData, ResearchInsights, ScriptData };
