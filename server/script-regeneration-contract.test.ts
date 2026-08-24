import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScriptEvidenceContext } from "@shared/schema";
import {
  paragraphRegenerationRequestSchema,
  parseScriptRegenerationOutput,
  scriptRegenerationOutputSchema,
  sectionRegenerationRequestSchema,
} from "./script-regeneration-contract";

const claim = {
  id: "claim-1",
  claim: "Three supplied videos use a step-by-step framing.",
  evidenceClass: "observed" as const,
  sourceVideoIds: ["video-1"],
  confidence: "high" as const,
  limitations: ["This is one public search snapshot."],
  snapshotId: "snapshot-123",
};

const ideaPackage = {
  title: "A grounded tutorial",
  description: "A tutorial based on the supplied sample.",
  keywords: ["tutorial"],
  format: "Tutorial" as const,
  difficulty: "Easy" as const,
  honestPromise: "Show one reproducible workflow.",
  discoverySurface: "search" as const,
  payoff: "The viewer leaves with a complete workflow.",
  thumbnailConcept: "One clear before-and-after comparison.",
  studioMetric: "Review first 30-second retention.",
  experimentRule: "Compare the opening confirmation against the prior upload.",
  evidenceClaims: [claim],
};

const evidenceContext: ScriptEvidenceContext = {
  snapshotId: "snapshot-123",
  sourceVideoIds: ["video-1"],
  evidenceClaims: [claim],
  ideaPackage,
};

describe("script regeneration contracts", () => {
  it("accepts strict grounded section and paragraph requests", () => {
    assert.equal(sectionRegenerationRequestSchema.safeParse({
      sectionName: "Hook",
      sectionContent: "Here is the current hook.",
      topic: "Tutorial topic",
      format: "Tutorial/How-to",
      audience: "General Audience",
      evidenceContext,
    }).success, true);
    assert.equal(paragraphRegenerationRequestSchema.safeParse({
      sectionName: "Hook",
      paragraphId: "paragraph-1",
      paragraphContent: "Here is the current paragraph.",
      topic: "Tutorial topic",
      format: "Tutorial/How-to",
      audience: "General Audience",
      evidenceContext,
    }).success, true);
  });

  it("rejects malformed and extra request fields", () => {
    assert.equal(sectionRegenerationRequestSchema.safeParse({
      sectionName: "Hook",
      sectionContent: "",
      topic: "Tutorial topic",
      format: "Tutorial/How-to",
      audience: "General Audience",
    }).success, false);
    assert.equal(paragraphRegenerationRequestSchema.safeParse({
      sectionName: "Hook",
      paragraphId: "paragraph-1",
      paragraphContent: "Current paragraph.",
      topic: "Tutorial topic",
      format: "Tutorial/How-to",
      audience: "General Audience",
      model: "client-controlled-model",
    }).success, false);
  });

  it("rejects evidence tied to a source outside the active snapshot", () => {
    const invalidContext = {
      ...evidenceContext,
      evidenceClaims: [{ ...claim, sourceVideoIds: ["unknown-video"] }],
    };
    assert.equal(sectionRegenerationRequestSchema.safeParse({
      sectionName: "Hook",
      sectionContent: "Current hook.",
      topic: "Tutorial topic",
      format: "Tutorial/How-to",
      audience: "General Audience",
      evidenceContext: invalidContext,
    }).success, false);
  });

  it("accepts only evidence IDs from the active snapshot context", () => {
    const parsed = parseScriptRegenerationOutput(
      JSON.stringify({ content: "Rewritten delivery.", evidenceClaimIds: ["claim-1"] }),
      evidenceContext,
    );
    assert.deepEqual(parsed.evidenceClaimIds, ["claim-1"]);
    assert.throws(
      () => parseScriptRegenerationOutput(
        JSON.stringify({ content: "Unsupported claim.", evidenceClaimIds: ["invented-claim"] }),
        evidenceContext,
      ),
      /unsupported evidence claim/,
    );
  });

  it("rejects evidence without context and malformed output", () => {
    assert.throws(
      () => parseScriptRegenerationOutput(
        JSON.stringify({ content: "Rewritten delivery.", evidenceClaimIds: ["claim-1"] }),
      ),
      /without an active evidence context/,
    );
    assert.equal(scriptRegenerationOutputSchema.safeParse({ content: "", evidenceClaimIds: [] }).success, false);
    assert.throws(() => parseScriptRegenerationOutput("not-json", evidenceContext), /not valid JSON/);
  });
});
