import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  evidenceClaimSchema,
  ideaGenerationOutputSchema,
  ideaGenerationResponseSchema,
  scriptEvidenceContextSchema,
  titleRegenerationOutputSchema,
  validateEvidenceSourceIds,
} from "./evidence-contracts";

const observed = {
  id: "claim-1",
  claim: "Three sampled videos use a comparison structure.",
  evidenceClass: "observed" as const,
  sourceVideoIds: ["video-1", "video-2", "video-3"],
  confidence: "high" as const,
  limitations: ["This describes the returned public sample only."],
  snapshotId: "yt_snapshot_12345678",
};

const idea = {
  title: "Compare the two setup paths",
  description: "Show both paths and explain the tradeoff.",
  keywords: ["setup", "comparison"],
  format: "Tutorial" as const,
  difficulty: "Medium" as const,
  honestPromise: "The viewer will understand which setup path fits their constraints.",
  discoverySurface: "search" as const,
  payoff: "A decision checklist and a completed example.",
  thumbnailConcept: "Two clearly labeled setups with one decision question.",
  studioMetric: "Compare first 30 second retention and end screen clicks in Studio.",
  experimentRule: "Keep the topic fixed and test one thumbnail variable per upload.",
  evidenceClaims: [observed],
};

describe("evidence contracts", () => {
  test("requires source IDs for observed claims", () => {
    assert.equal(evidenceClaimSchema.safeParse({ ...observed, sourceVideoIds: [] }).success, false);
  });

  test("rejects malformed or incomplete idea packages", () => {
    assert.equal(ideaGenerationOutputSchema.safeParse({ ideas: Array(6).fill(idea) }).success, true);
    const { honestPromise: _removed, ...incomplete } = idea;
    assert.equal(ideaGenerationOutputSchema.safeParse({ ideas: Array(6).fill(incomplete) }).success, false);
  });

  test("rejects source IDs outside the supplied research sample", () => {
    assert.doesNotThrow(() => validateEvidenceSourceIds([observed], ["video-1", "video-2", "video-3"]));
    assert.throws(() => validateEvidenceSourceIds([observed], ["video-1"]), /unsupported source video IDs/);
  });

  test("requires a snapshot echo on grounded idea responses", () => {
    const base = { ideas: Array(6).fill(idea), niche: "Cameras", generatedAt: "2026-08-24T10:00:00.000Z" };
    assert.equal(ideaGenerationResponseSchema.safeParse(base).success, false);
    assert.equal(ideaGenerationResponseSchema.safeParse({ ...base, snapshotId: observed.snapshotId }).success, true);
  });

  test("rejects a selected package from a different snapshot", () => {
    assert.equal(scriptEvidenceContextSchema.safeParse({
      snapshotId: observed.snapshotId,
      sourceVideoIds: observed.sourceVideoIds,
      evidenceClaims: [observed],
      ideaPackage: { ...idea, evidenceClaims: [{ ...observed, snapshotId: "yt_stale_12345678" }] },
    }).success, false);
  });

  test("requires exactly five regenerated titles", () => {
    assert.equal(titleRegenerationOutputSchema.safeParse({ titles: ["One", "Two", "Three", "Four", "Five"] }).success, true);
    assert.equal(titleRegenerationOutputSchema.safeParse({ titles: ["One"] }).success, false);
  });
});
