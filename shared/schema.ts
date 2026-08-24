import { z } from "zod";
import { evidenceClaimSchema, scriptEvidenceContextSchema } from "./evidence-contracts";

export * from "./evidence-contracts";

export enum VideoFormat {
  SHORT = "YouTube Short (< 60 sec)",
  LONG_FORM = "Long-form Video (8-15 min)",
  TUTORIAL = "Tutorial/How-to",
  REVIEW = "Product Review",
  VLOG = "Vlog Style"
}

export enum TargetAudience {
  GENERAL = "General Audience",
  TECH_SAVVY = "Tech-Savvy Viewers",
  BEGINNERS = "Beginners",
  PROFESSIONALS = "Industry Professionals"
}

export enum UploadDateFilter {
  ANY = "any",
  HOUR = "hour",
  TODAY = "today",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year"
}

export enum DurationFilter {
  ANY = "any",
  SHORT = "short",
  MEDIUM = "medium",
  LONG = "long"
}

export enum SortBy {
  RELEVANCE = "relevance",
  DATE = "date",
  VIEW_COUNT = "viewCount",
  RATING = "rating"
}

export const videoSchema = z.object({
  id: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(500),
  channelTitle: z.string().trim().min(1).max(200),
  channelId: z.string().trim().min(1).max(128),
  publishedAt: z.string().trim().min(1).max(64),
  thumbnailUrl: z.string().url().max(2_048),
  description: z.string().max(10_000),
  viewCount: z.number().optional(),
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  duration: z.string().trim().max(64).optional(),
  tags: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  categoryId: z.string().trim().max(32).optional(),
  liveBroadcastContent: z.string().trim().max(32).optional(),
  defaultLanguage: z.string().trim().max(35).optional(),
  defaultAudioLanguage: z.string().trim().max(35).optional(),
  definition: z.string().trim().max(16).optional(),
  hasCaptions: z.boolean().optional(),
  licensedContent: z.boolean().optional(),
  embeddable: z.boolean().optional(),
  madeForKids: z.boolean().optional(),
  hasPaidProductPlacement: z.boolean().optional(),
  topicCategories: z.array(z.string().url().max(2_048)).max(20).optional(),
  liveStreamingDetails: z.object({
    actualStartTime: z.string().trim().max(64).optional(),
    actualEndTime: z.string().trim().max(64).optional(),
    scheduledStartTime: z.string().trim().max(64).optional(),
    concurrentViewers: z.number().optional(),
  }).optional(),
  channelStatistics: z.object({
    subscriberCount: z.number().optional(),
    hiddenSubscriberCount: z.boolean(),
    videoCount: z.number().optional(),
    viewCount: z.number().optional(),
    publishedAt: z.string().trim().max(64).optional(),
    country: z.string().trim().max(8).optional(),
    thumbnailUrl: z.string().url().max(2_048).optional(),
    description: z.string().max(5_000).optional(),
    customUrl: z.string().trim().max(200).optional(),
    defaultLanguage: z.string().trim().max(35).optional(),
    keywords: z.string().max(1_000).optional(),
    topicCategories: z.array(z.string().url().max(2_048)).max(20).optional(),
  }).optional(),
}).strict();

export type Video = z.infer<typeof videoSchema>;

export const searchFiltersSchema = z.object({
  query: z.string().trim().min(1).max(200),
  uploadDate: z.nativeEnum(UploadDateFilter).default(UploadDateFilter.ANY),
  duration: z.nativeEnum(DurationFilter).default(DurationFilter.ANY),
  sortBy: z.nativeEnum(SortBy).default(SortBy.RELEVANCE),
  maxResults: z.number().min(1).max(50).default(25),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const providerErrorCategorySchema = z.enum([
  "missing_key",
  "invalid_key",
  "quota",
  "timeout",
  "network",
  "provider_server",
  "invalid_response",
  "unknown",
]);

export type ProviderErrorCategory = z.infer<typeof providerErrorCategorySchema>;

export const providerErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  category: providerErrorCategorySchema,
  retryable: z.boolean(),
  suggestion: z.string(),
});

export type ProviderErrorResponse = z.infer<typeof providerErrorResponseSchema>;

export const researchWarningSchema = z.object({
  code: z.string().trim().min(1).max(128),
  stage: z.enum(["search", "video_details", "channel_enrichment"]),
  message: z.string().trim().min(1).max(1_000),
}).strict();

export type ResearchWarning = z.infer<typeof researchWarningSchema>;

export const enrichmentStageSchema = z.object({
  status: z.enum(["complete", "partial", "skipped"]),
  requested: z.number().int().min(0).max(50),
  returned: z.number().int().min(0).max(50),
}).strict();

export const searchProvenanceSchema = z.object({
  provider: z.literal("youtube-data-api-v3"),
  query: z.string().trim().min(1).max(200),
  filters: z.object({
    uploadDate: z.nativeEnum(UploadDateFilter),
    duration: z.nativeEnum(DurationFilter),
    sortBy: z.nativeEnum(SortBy),
    maxResults: z.number().int().min(1).max(50),
  }),
  orderedVideoIds: z.array(z.string().trim().min(1).max(128)).max(50),
}).strict();

export type SearchProvenance = z.infer<typeof searchProvenanceSchema>;

const boundedResearchText = z.string().trim().min(1).max(4_000);

export const researchInsightsContentSchema = z.object({
  summary: boundedResearchText,
  queryIntent: z.object({
    primaryIntent: boundedResearchText,
    viewerNeed: boundedResearchText,
    discoverySurface: boundedResearchText,
    credibilityNote: boundedResearchText,
  }),
  evidenceSignals: z.object({
    observed: z.array(boundedResearchText).length(3),
    inferred: z.array(boundedResearchText).length(3),
    requiresStudio: z.array(boundedResearchText).length(3),
  }),
  evidenceClaims: z.array(evidenceClaimSchema).min(9).max(24),
  peopleAlsoAsk: z.array(z.object({
    question: boundedResearchText,
    answer: boundedResearchText,
  })).length(6),
  targetAudience: z.object({
    primaryDemographic: boundedResearchText,
    ageRange: boundedResearchText,
    interests: z.array(boundedResearchText).min(1).max(8),
    painPoints: z.array(boundedResearchText).min(1).max(8),
    contentPreferences: z.array(boundedResearchText).min(1).max(8),
  }),
  nicheAnalysis: z.object({
    competitionLevel: boundedResearchText,
    growthTrend: boundedResearchText,
    bestPostingTimes: z.array(boundedResearchText).min(1).max(8),
    recommendedFormats: z.array(boundedResearchText).min(1).max(8),
    monetizationPotential: boundedResearchText,
  }),
  contentGaps: z.array(boundedResearchText).min(1).max(8),
  trendingSubtopics: z.array(boundedResearchText).min(1).max(10),
  recommendedActions: z.array(z.object({
    title: boundedResearchText,
    rationale: boundedResearchText,
    format: boundedResearchText,
  })).length(3),
  methodology: z.object({
    sampleSize: z.number().int().min(0).max(50),
    basis: boundedResearchText,
    limitations: z.array(boundedResearchText).min(1).max(10),
  }),
});

export type ResearchInsightsContent = z.infer<typeof researchInsightsContentSchema>;

export const researchAggregateAnalyticsSchema = z.object({
  totalVideos: z.number().int().min(1).max(50),
  totalViews: z.number().nonnegative(),
  avgViews: z.number().nonnegative(),
  medianViews: z.number().nonnegative(),
  medianDailyViews: z.number().nonnegative(),
  avgEngagement: z.union([z.number().nonnegative(), z.literal("N/A")]),
  uniqueChannels: z.number().int().nonnegative(),
  durationData: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.number().int().nonnegative() }).strict()).max(12),
  recencyData: z.array(z.object({ name: z.string().trim().min(1).max(80), value: z.number().int().nonnegative() }).strict()).max(12),
  topTags: z.array(z.object({ label: z.string().trim().min(1).max(200), count: z.number().int().nonnegative() }).strict()).max(50),
  coverage: z.object({
    views: z.number().int().nonnegative(),
    engagement: z.number().int().nonnegative(),
    subscribers: z.number().int().nonnegative(),
    captions: z.number().int().nonnegative(),
    tags: z.number().int().nonnegative(),
    hd: z.number().int().nonnegative(),
  }),
}).strict();

export const researchInsightsRequestSchema = z.object({
  query: z.string().trim().min(1).max(200),
  videos: z.array(videoSchema).min(1).max(50),
  snapshotId: z.string().trim().min(8).max(128),
  retrievedAt: z.string().datetime(),
  provenance: searchProvenanceSchema,
  analytics: researchAggregateAnalyticsSchema,
  enrichment: z.object({
    search: enrichmentStageSchema,
    videoDetails: enrichmentStageSchema,
    channels: enrichmentStageSchema,
  }),
  warnings: z.array(researchWarningSchema).max(20),
}).strict().superRefine((data, ctx) => {
  if (data.provenance.query.trim() !== data.query.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provenance", "query"], message: "Provenance query must match the active query" });
  }
  const videoIds = data.videos.map((video) => video.id);
  if (JSON.stringify(videoIds) !== JSON.stringify(data.provenance.orderedVideoIds)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provenance", "orderedVideoIds"], message: "Ordered video IDs must match the active video records" });
  }
  if (data.analytics.totalVideos !== data.videos.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["analytics", "totalVideos"], message: "Analytics sample size must match the active video records" });
  }
});

export type ResearchInsightsRequest = z.infer<typeof researchInsightsRequestSchema>;

export const researchInsightsResponseSchema = researchInsightsContentSchema.extend({
  snapshotId: z.string().min(8).max(128),
  generatedAt: z.string().datetime(),
}).superRefine((response, ctx) => {
  response.evidenceClaims.forEach((claim, index) => {
    if (claim.snapshotId !== response.snapshotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceClaims", index, "snapshotId"],
        message: "Evidence claim snapshot must match the response snapshot",
      });
    }
  });
});

export type ResearchInsightsResponse = z.infer<typeof researchInsightsResponseSchema>;

export enum CreatorPersona {
  NONE = "none",
  EINSTEIN = "Albert Einstein",
  NATE_HERK = "Nate Herk",
  NEIL_PATEL = "Neil Patel",
  GARY_VEE = "Gary Vaynerchuk",
  BRITNEY_SPEARS = "Britney Spears",
  BRUCE_LEE = "Bruce Lee",
  MR_BEAST = "MrBeast",
  MORGAN_FREEMAN = "Morgan Freeman",
  ALEX_HORMOZI = "Alex Hormozi",
  TONY_ROBBINS = "Tony Robbins",
  OTHER = "other"
}

export const scriptInputSchema = z.object({
  topic: z.string().trim().min(1, "Topic is required").max(500),
  format: z.nativeEnum(VideoFormat),
  audience: z.nativeEnum(TargetAudience),
  persona: z.nativeEnum(CreatorPersona).optional().default(CreatorPersona.NONE),
  customPersona: z.string().trim().max(300).transform(val => val || "").optional(),
  additionalNotes: z.string().trim().max(5_000).optional(),
  evidenceContext: scriptEvidenceContextSchema.optional(),
}).strict().superRefine((data, ctx) => {
  if (data.persona === CreatorPersona.OTHER && !data.customPersona) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please describe the custom tone traits",
      path: ["customPersona"],
    });
  }
});

export type ScriptInput = z.infer<typeof scriptInputSchema>;

export const scriptResultSchema = z.object({
  script: z.string(),
  titles: z.array(z.string()).optional(),
  hook: z.string(),
  structure: z.array(z.object({
    section: z.string(),
    purpose: z.string(),
    evidenceClaimIds: z.array(z.string()),
  })),
  payoff: z.string(),
  primaryCta: z.string(),
  studioValidation: z.string(),
  metadata: z.object({
    wordCount: z.number(),
    estimatedDuration: z.string(),
    generatedAt: z.string(),
  }),
  evidenceContext: scriptEvidenceContextSchema.optional(),
});

export type ScriptResult = z.infer<typeof scriptResultSchema>;

export const searchResponseSchema = z.object({
  videos: z.array(videoSchema),
  totalResults: z.number(),
  nextPageToken: z.string().optional(),
  resultsPerPage: z.number().optional(),
  regionCode: z.string().optional(),
  snapshotId: z.string().min(8).max(128),
  retrievedAt: z.string().datetime(),
  totalResultsIsApproximate: z.boolean(),
  provenance: searchProvenanceSchema,
  enrichment: z.object({
    search: enrichmentStageSchema,
    videoDetails: enrichmentStageSchema,
    channels: enrichmentStageSchema,
  }),
  warnings: z.array(researchWarningSchema),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;
