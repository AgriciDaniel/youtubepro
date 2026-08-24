import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ProviderError } from "./provider-errors";
import {
  buildThumbnailPrompt,
  buildThumbnailSuggestionsPrompt,
  parseThumbnailSuggestions,
} from "./gemini";

const config = {
  style: "tutorial" as const,
  mainText: "Same scene",
  subText: "Two cameras",
  thumbnailDescription: "Use a clear side-by-side comparison.",
  composition: "split-screen" as const,
  cameraAngle: "three-quarter" as const,
  lighting: "studio" as const,
  colorScheme: "complementary" as const,
  textPosition: "bottom" as const,
  autoBlend: false,
  referenceImages: [],
  referenceRightsConfirmed: false,
  honestPromise: "See the same test from both cameras.",
  thumbnailConcept: "Two labeled cameras beside one test scene.",
  mode: "create" as const,
  variationDirection: undefined,
};

describe("thumbnail prompt construction", () => {
  test("uses every supported visual setting and selected idea context", () => {
    const prompt = buildThumbnailPrompt("Camera comparison", config);

    for (const expected of [
      "tutorial",
      "split-screen",
      "three-quarter",
      "studio",
      "complementary",
      "bottom",
      config.honestPromise,
      config.thumbnailConcept,
      config.thumbnailDescription,
    ]) {
      assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assert.doesNotMatch(prompt, /millions of clicks|Mr\. Beast|MKBHD/i);
    assert.match(prompt, /Do not guarantee views, clicks, revenue/i);
  });

  test("builds honest suggestion guidance from the selected idea", () => {
    const prompt = buildThumbnailSuggestionsPrompt({
      topic: "Camera comparison",
      honestPromise: config.honestPromise,
      thumbnailConcept: config.thumbnailConcept,
    });

    assert.match(prompt, /Do not invent results/i);
    assert.match(prompt, /same test from both cameras/i);
    assert.doesNotMatch(prompt, /SHOCKING|GAME CHANGER|ALL CAPS/i);
  });
});

describe("thumbnail suggestion response parsing", () => {
  test("accepts exactly five bounded strings", () => {
    assert.deepEqual(
      parseThumbnailSuggestions('["Same Scene", "Two Cameras", "Low Light Test", "Side by Side", "See the Difference"]'),
      ["Same Scene", "Two Cameras", "Low Light Test", "Side by Side", "See the Difference"],
    );
  });

  test("rejects markdown-wrapped and incomplete responses", () => {
    assert.throws(
      () => parseThumbnailSuggestions('```json\n["One", "Two", "Three", "Four", "Five"]\n```'),
      (error: unknown) => error instanceof ProviderError,
    );
    assert.throws(
      () => parseThumbnailSuggestions('["One", "Two"]'),
      (error: unknown) => error instanceof ProviderError
        && error.code === "GEMINI_THUMBNAIL_SUGGESTIONS_INVALID",
    );
  });
});
