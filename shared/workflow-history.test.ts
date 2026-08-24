import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  deriveWorkflowTitle,
  normalizeCustomWorkflowTitle,
  sortAndLimitWorkflowSummaries,
  type WorkflowHistorySummary,
} from "./workflow-history";

function summary(id: string, updatedAt: number): WorkflowHistorySummary {
  return {
    id,
    title: id,
    currentStep: "research",
    createdAt: 1,
    updatedAt,
    hasResearch: false,
    hasScript: false,
    hasThumbnail: false,
  };
}

describe("workflow history helpers", () => {
  test("uses the research query before downstream titles", () => {
    assert.equal(deriveWorkflowTitle({
      researchQuery: "  camera comparison  ",
      scriptTitle: "A generated title",
      thumbnailTopic: "Thumbnail topic",
    }), "camera comparison");
  });

  test("falls back through script and thumbnail signals", () => {
    assert.equal(deriveWorkflowTitle({ scriptTitle: "Script title", thumbnailTopic: "Thumbnail" }), "Script title");
    assert.equal(deriveWorkflowTitle({ thumbnailTopic: "Thumbnail only" }), "Thumbnail only");
    assert.equal(deriveWorkflowTitle({}), "Untitled workflow");
  });

  test("bounds long titles without splitting the history layout", () => {
    const title = deriveWorkflowTitle({ researchQuery: "A".repeat(80) });
    assert.equal(title.length, 48);
    assert.equal(title.endsWith("…"), true);
  });

  test("normalizes a user-provided workflow name", () => {
    assert.equal(normalizeCustomWorkflowTitle("  Launch   research  "), "Launch research");
    assert.equal(normalizeCustomWorkflowTitle("   "), null);
    assert.equal(normalizeCustomWorkflowTitle("A".repeat(80))?.length, 48);
  });

  test("keeps the newest unique summaries within the limit", () => {
    const result = sortAndLimitWorkflowSummaries([
      summary("older-copy", 2),
      summary("newest", 9),
      summary("older-copy", 7),
      summary("middle", 5),
    ], 2);
    assert.deepEqual(result.map((item) => [item.id, item.updatedAt]), [
      ["newest", 9],
      ["older-copy", 7],
    ]);
  });
});
