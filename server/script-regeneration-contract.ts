import { z } from "zod";
import {
  scriptEvidenceContextSchema,
  TargetAudience,
  VideoFormat,
  type ScriptEvidenceContext,
} from "@shared/schema";

const boundedText = (max: number) => z.string().trim().min(1).max(max);

const regenerationBaseSchema = z.object({
  topic: boundedText(500),
  format: z.nativeEnum(VideoFormat),
  audience: z.nativeEnum(TargetAudience),
  evidenceContext: scriptEvidenceContextSchema.optional(),
});

function validateEvidenceSources(
  request: { evidenceContext?: ScriptEvidenceContext },
  ctx: z.RefinementCtx,
): void {
  const evidenceContext = request.evidenceContext;
  if (!evidenceContext) return;
  const allowedSourceIds = new Set(evidenceContext.sourceVideoIds);
  const claims = [...evidenceContext.evidenceClaims, ...evidenceContext.ideaPackage.evidenceClaims];
  claims.forEach((claim, claimIndex) => {
    claim.sourceVideoIds.forEach((sourceId, sourceIndex) => {
      if (!allowedSourceIds.has(sourceId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidenceContext", "evidenceClaims", claimIndex, "sourceVideoIds", sourceIndex],
          message: `Evidence referenced unsupported source video ID: ${sourceId}`,
        });
      }
    });
  });
}

export const sectionRegenerationRequestSchema = regenerationBaseSchema.extend({
  sectionName: boundedText(160),
  sectionContent: boundedText(80_000),
  additionalNotes: z.string().trim().max(5_000).optional(),
}).strict().superRefine(validateEvidenceSources);

export const paragraphRegenerationRequestSchema = regenerationBaseSchema.extend({
  sectionName: boundedText(160),
  paragraphId: boundedText(200),
  paragraphContent: boundedText(20_000),
}).strict().superRefine(validateEvidenceSources);

export const scriptRegenerationOutputSchema = z.object({
  content: boundedText(80_000),
  evidenceClaimIds: z.array(boundedText(128)).max(24),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.evidenceClaimIds).size !== value.evidenceClaimIds.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceClaimIds"],
      message: "Evidence claim IDs must be unique",
    });
  }
});

export function parseScriptRegenerationOutput(
  text: string,
  evidenceContext?: ScriptEvidenceContext,
): z.infer<typeof scriptRegenerationOutputSchema> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("Script regeneration response was not valid JSON");
  }

  const output = scriptRegenerationOutputSchema.parse(decoded);
  if (!evidenceContext && output.evidenceClaimIds.length > 0) {
    throw new Error("Script regeneration cited evidence without an active evidence context");
  }
  const allowedClaimIds = new Set(evidenceContext?.evidenceClaims.map((claim) => claim.id) || []);
  const unsupportedClaimId = output.evidenceClaimIds.find((claimId) => !allowedClaimIds.has(claimId));
  if (unsupportedClaimId) {
    throw new Error(`Script regeneration cited unsupported evidence claim: ${unsupportedClaimId}`);
  }
  return output;
}

export type SectionRegenerationRequest = z.infer<typeof sectionRegenerationRequestSchema>;
export type ParagraphRegenerationRequest = z.infer<typeof paragraphRegenerationRequestSchema>;
export type ScriptRegenerationOutput = z.infer<typeof scriptRegenerationOutputSchema>;
