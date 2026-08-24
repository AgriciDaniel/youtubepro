import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ProviderError } from "./provider-errors";
import { parseResearchInsightsResponse } from "./gemini";

function validResearchContent() {
  return {
    summary: "The sample shows a clear review intent. Test one focused comparison.",
    queryIntent: {
      primaryIntent: "Compare cameras",
      viewerNeed: "Choose a camera",
      discoverySurface: "Search, based on the explicit comparison query",
      credibilityNote: "Demonstrate the tested setup",
    },
    evidenceSignals: {
      observed: ["Observed one", "Observed two", "Observed three"],
      inferred: ["Inference one", "Inference two", "Inference three"],
      requiresStudio: ["Studio one", "Studio two", "Studio three"],
    },
    evidenceClaims: Array.from({ length: 9 }, (_, index) => ({
      id: `claim-${index + 1}`,
      claim: `Evidence claim ${index + 1}`,
      evidenceClass: index < 3 ? "observed" : index < 6 ? "inferred" : "requires_studio",
      sourceVideoIds: index < 3 ? ["video-1"] : [],
      confidence: index < 3 ? "high" : "medium",
      limitations: ["Limited to this public snapshot."],
      snapshotId: "yt_12345678",
    })),
    peopleAlsoAsk: Array.from({ length: 6 }, (_, index) => ({
      question: `Question ${index + 1}?`,
      answer: `Answer ${index + 1}`,
    })),
    targetAudience: {
      primaryDemographic: "Inferred camera buyers",
      ageRange: "Insufficient evidence",
      interests: ["Cameras"],
      painPoints: ["Comparing specifications"],
      contentPreferences: ["Direct demonstrations"],
    },
    nicheAnalysis: {
      competitionLevel: "Medium sample signal",
      growthTrend: "Insufficient evidence",
      bestPostingTimes: ["Insufficient evidence from this snapshot"],
      recommendedFormats: ["Comparison"],
      monetizationPotential: "Commercial-intent hypothesis only",
    },
    contentGaps: ["A controlled low-light comparison"],
    trendingSubtopics: ["Low-light video"],
    recommendedActions: Array.from({ length: 3 }, (_, index) => ({
      title: `Experiment ${index + 1}`,
      rationale: "Validate the hypothesis with Studio impressions and retention.",
      format: "Comparison",
    })),
    methodology: {
      sampleSize: 1,
      basis: "Public YouTube Data API search-result metadata snapshot",
      limitations: ["Missing owner-only Analytics metrics"],
    },
  };
}

describe("Gemini research response validation", () => {
  test("echoes the snapshot identity after strict validation", () => {
    const generatedAt = "2026-08-24T10:00:00.000Z";
    const result = parseResearchInsightsResponse(
      JSON.stringify(validResearchContent()),
      "yt_12345678",
      1,
      generatedAt,
    );

    assert.equal(result.snapshotId, "yt_12345678");
    assert.equal(result.generatedAt, generatedAt);
    assert.equal(result.methodology.sampleSize, 1);
  });

  test("rejects malformed JSON without attempting permissive extraction", () => {
    assert.throws(
      () => parseResearchInsightsResponse("```json\n{}\n```", "yt_12345678", 1),
      (error: unknown) => error instanceof ProviderError
        && error.code === "GEMINI_RESEARCH_INVALID_JSON",
    );
  });

  test("rejects structurally incomplete output", () => {
    assert.throws(
      () => parseResearchInsightsResponse(JSON.stringify({ summary: "Only a summary" }), "yt_12345678", 1),
      (error: unknown) => error instanceof ProviderError
        && error.code === "GEMINI_RESEARCH_SCHEMA_MISMATCH",
    );
  });

  test("rejects a model-reported sample size mismatch", () => {
    const content = validResearchContent();
    content.methodology.sampleSize = 2;
    assert.throws(
      () => parseResearchInsightsResponse(JSON.stringify(content), "yt_12345678", 1),
      (error: unknown) => error instanceof ProviderError
        && error.code === "GEMINI_RESEARCH_SAMPLE_MISMATCH",
    );
  });

  test("rejects evidence tied to a different snapshot", () => {
    const content = validResearchContent();
    content.evidenceClaims[0].snapshotId = "yt_wrong_12345678";
    assert.throws(
      () => parseResearchInsightsResponse(JSON.stringify(content), "yt_12345678", 1, undefined, ["video-1"]),
      (error: unknown) => error instanceof ProviderError
        && error.code === "GEMINI_RESEARCH_SNAPSHOT_MISMATCH",
    );
  });

  test("rejects evidence that cites an unknown source video", () => {
    const content = validResearchContent();
    content.evidenceClaims[0].sourceVideoIds = ["unknown-video"];
    assert.throws(
      () => parseResearchInsightsResponse(JSON.stringify(content), "yt_12345678", 1, undefined, ["video-1"]),
      (error: unknown) => error instanceof ProviderError
        && error.code === "GEMINI_RESEARCH_UNKNOWN_SOURCE",
    );
  });
});
