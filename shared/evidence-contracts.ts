import { z } from "zod";

const boundedText = z.string().trim().min(1).max(2_000);
const sourceVideoId = z.string().trim().min(1).max(128);

export const evidenceClassSchema = z.enum(["observed", "inferred", "requires_studio"]);
export const evidenceConfidenceSchema = z.enum(["low", "medium", "high"]);

export const evidenceClaimSchema = z.object({
  id: z.string().trim().min(1).max(128),
  claim: boundedText,
  evidenceClass: evidenceClassSchema,
  sourceVideoIds: z.array(sourceVideoId).max(50),
  confidence: evidenceConfidenceSchema,
  limitations: z.array(boundedText).min(1).max(8),
  snapshotId: z.string().trim().min(8).max(128),
}).strict().superRefine((claim, ctx) => {
  if (claim.evidenceClass === "observed" && claim.sourceVideoIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceVideoIds"],
      message: "Observed claims require at least one source video ID",
    });
  }
});

export const discoverySurfaceSchema = z.enum([
  "search",
  "browse",
  "suggested",
  "shorts_feed",
  "mixed",
]);

export const ideaPackageSchema = z.object({
  title: boundedText.max(100),
  description: boundedText,
  keywords: z.array(boundedText.max(80)).min(1).max(6),
  format: z.enum(["YouTube Short", "Tutorial", "Review", "Vlog", "Long-form"]),
  difficulty: z.enum(["Easy", "Medium", "Hard", "Advanced"]),
  honestPromise: boundedText.max(500),
  discoverySurface: discoverySurfaceSchema,
  payoff: boundedText.max(700),
  thumbnailConcept: boundedText.max(700),
  studioMetric: boundedText.max(500),
  experimentRule: boundedText.max(700),
  evidenceClaims: z.array(evidenceClaimSchema).min(1).max(8),
}).strict();

export const researchEvidenceContextSchema = z.object({
  query: boundedText.max(200),
  snapshotId: z.string().trim().min(8).max(128),
  sourceVideoIds: z.array(sourceVideoId).min(1).max(50),
  evidenceClaims: z.array(evidenceClaimSchema).min(1).max(24),
}).strict().superRefine((context, ctx) => {
  context.evidenceClaims.forEach((claim, index) => {
    if (claim.snapshotId !== context.snapshotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceClaims", index, "snapshotId"],
        message: "Evidence claim snapshot must match the active research snapshot",
      });
    }
  });
});

export const ideaGenerationRequestSchema = z.object({
  niche: boundedText.max(160),
  keywords: z.string().trim().max(1_000).default(""),
  audience: z.string().trim().max(200).default(""),
  researchContext: researchEvidenceContextSchema,
}).strict();

export const ideaGenerationOutputSchema = z.object({
  ideas: z.array(ideaPackageSchema).length(6),
}).strict();

export const ideaGenerationResponseSchema = ideaGenerationOutputSchema.extend({
  niche: boundedText.max(160),
  generatedAt: z.string().datetime(),
  snapshotId: z.string().trim().min(8).max(128),
});

export const scriptEvidenceContextSchema = z.object({
  snapshotId: z.string().trim().min(8).max(128),
  sourceVideoIds: z.array(sourceVideoId).max(50),
  evidenceClaims: z.array(evidenceClaimSchema).min(1).max(24),
  ideaPackage: ideaPackageSchema,
}).strict().superRefine((context, ctx) => {
  const claims = [...context.evidenceClaims, ...context.ideaPackage.evidenceClaims];
  claims.forEach((claim, index) => {
    if (claim.snapshotId !== context.snapshotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceClaims", index, "snapshotId"],
        message: "Evidence claim snapshot must match the selected idea snapshot",
      });
    }
  });
});

export const scriptGenerationOutputSchema = z.object({
  titles: z.array(boundedText.max(100)).length(3),
  hook: boundedText.max(1_500),
  structure: z.array(z.object({
    section: boundedText.max(120),
    purpose: boundedText.max(500),
    evidenceClaimIds: z.array(z.string().trim().min(1).max(128)).max(8),
  }).strict()).min(2).max(16),
  script: boundedText.max(80_000),
  payoff: boundedText.max(1_000),
  primaryCta: boundedText.max(800),
  studioValidation: boundedText.max(800),
}).strict();

export const titleRegenerationOutputSchema = z.object({
  titles: z.array(boundedText.max(100)).length(5),
}).strict();

export function validateEvidenceSourceIds(
  claims: readonly z.infer<typeof evidenceClaimSchema>[],
  allowedSourceVideoIds: readonly string[],
): void {
  const allowed = new Set(allowedSourceVideoIds);
  const unsupported = Array.from(new Set(
    claims.flatMap((claim) => claim.sourceVideoIds.filter((id) => !allowed.has(id))),
  ));

  if (unsupported.length > 0) {
    throw new Error(`Evidence contains unsupported source video IDs: ${unsupported.join(", ")}`);
  }
}

export type EvidenceClaim = z.infer<typeof evidenceClaimSchema>;
export type EvidenceClass = z.infer<typeof evidenceClassSchema>;
export type IdeaPackage = z.infer<typeof ideaPackageSchema>;
export type ResearchEvidenceContext = z.infer<typeof researchEvidenceContextSchema>;
export type IdeaGenerationRequest = z.infer<typeof ideaGenerationRequestSchema>;
export type IdeaGenerationResponse = z.infer<typeof ideaGenerationResponseSchema>;
export type ScriptEvidenceContext = z.infer<typeof scriptEvidenceContextSchema>;
