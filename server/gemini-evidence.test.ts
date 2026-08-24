import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { IdeaGenerationRequest } from "@shared/schema";
import { parseIdeaGenerationOutput, parseScriptGenerationOutput } from "./gemini";

const claim = {
  id: "claim-1",
  claim: "Two sampled titles frame the topic as a comparison.",
  evidenceClass: "observed" as const,
  sourceVideoIds: ["video-1", "video-2"],
  confidence: "high" as const,
  limitations: ["Limited to the returned public snapshot."],
  snapshotId: "yt_snapshot_12345678",
};

const request: IdeaGenerationRequest = {
  niche: "Cameras",
  keywords: "low light",
  audience: "Camera buyers",
  researchContext: {
    query: "camera comparison",
    snapshotId: "yt_snapshot_12345678",
    sourceVideoIds: ["video-1", "video-2"],
    evidenceClaims: [claim],
  },
};

function idea(evidenceClaims = [claim]) {
  return {
    title: "Compare two low-light setups",
    description: "A controlled comparison for a clear decision.",
    keywords: ["camera", "low light"],
    format: "Tutorial",
    difficulty: "Medium",
    honestPromise: "Choose the setup that fits your low-light workflow.",
    discoverySurface: "search",
    payoff: "A direct side-by-side result and decision checklist.",
    thumbnailConcept: "Two labeled frames with one decision question.",
    studioMetric: "Compare first 30 second retention in Studio.",
    experimentRule: "Change only the thumbnail framing and keep the title fixed.",
    evidenceClaims,
  };
}

describe("grounded generation response validation", () => {
  test("accepts a complete idea response grounded in supplied claim IDs", () => {
    const parsed = parseIdeaGenerationOutput(JSON.stringify({ ideas: Array.from({ length: 6 }, () => idea()) }), request);
    assert.equal(parsed.ideas.length, 6);
  });

  test("accepts an advanced idea without weakening its evidence contract", () => {
    const advanced = { ...idea(), difficulty: "Advanced" };
    const parsed = parseIdeaGenerationOutput(
      JSON.stringify({ ideas: Array.from({ length: 6 }, () => advanced) }),
      request,
    );
    assert.equal(parsed.ideas[0].difficulty, "Advanced");
  });

  test("rejects an idea with an unknown source video ID", () => {
    const unknown = { ...claim, sourceVideoIds: ["unknown-video"] };
    assert.throws(
      () => parseIdeaGenerationOutput(JSON.stringify({ ideas: Array.from({ length: 6 }, () => idea([unknown])) }), request),
      /unsupported source video IDs/,
    );
  });

  test("rejects generic idea evidence invented outside supplied claims", () => {
    const invented = { ...claim, id: "invented-claim" };
    assert.throws(
      () => parseIdeaGenerationOutput(JSON.stringify({ ideas: Array.from({ length: 6 }, () => idea([invented])) }), request),
      /unsupported evidence claim/,
    );
  });

  test("rejects idea evidence tied to a stale snapshot", () => {
    const stale = { ...claim, snapshotId: "yt_stale_12345678" };
    assert.throws(
      () => parseIdeaGenerationOutput(JSON.stringify({ ideas: Array.from({ length: 6 }, () => idea([stale])) }), request),
      /stale snapshot/,
    );
  });

  test("rejects malformed script output", () => {
    assert.throws(() => parseScriptGenerationOutput(JSON.stringify({ script: "Only a script" })), /schema validation/);
  });
});
