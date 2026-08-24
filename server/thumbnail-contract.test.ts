import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  inspectThumbnailImageDataUrl,
  thumbnailGenerationRequestSchema,
  thumbnailSuggestionsRequestSchema,
} from "./thumbnail-contract";

function pngDataUrl(width: number, height: number, additionalBytes = 0): string {
  const buffer = Buffer.alloc(24 + additionalBytes);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0); // pragma: allowlist secret, PNG signature
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function validRequest() {
  return {
    topic: "A grounded camera comparison",
    style: "minimal",
    mainText: "Low light test",
    subText: "Same scene, two cameras",
    thumbnailDescription: "Show both cameras beside the same night scene.",
    composition: "split-screen",
    cameraAngle: "eye-level",
    lighting: "dramatic",
    colorScheme: "cool",
    textPosition: "top",
    autoBlend: true,
    referenceImages: [{ image: pngDataUrl(1280, 720), role: "subject" }],
    referenceRightsConfirmed: true,
    honestPromise: "The viewer will see how both cameras handle the same low-light scene.",
    thumbnailConcept: "Two cameras and one divided night scene.",
    mode: "create",
    variationDirection: undefined,
  };
}

describe("thumbnail generation request contract", () => {
  test("accepts the complete supported settings contract", () => {
    const result = thumbnailGenerationRequestSchema.parse(validRequest());
    assert.equal(result.composition, "split-screen");
    assert.equal(result.referenceImages.length, 1);
    assert.equal(inspectThumbnailImageDataUrl(result.referenceImages[0].image)?.width, 1280);
  });

  test("rejects a client-selected image model", () => {
    assert.equal(thumbnailGenerationRequestSchema.safeParse({
      ...validRequest(),
      model: "gemini-3-pro-image",
    }).success, false);
  });

  test("requires permission confirmation when references are supplied", () => {
    assert.equal(thumbnailGenerationRequestSchema.safeParse({
      ...validRequest(),
      referenceRightsConfirmed: false,
    }).success, false);
  });

  test("rejects unsupported MIME types and invalid dimensions", () => {
    const unsupported = {
      ...validRequest(),
      referenceImages: [{ image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", role: "subject" }],
    };
    const tooSmall = {
      ...validRequest(),
      referenceImages: [{ image: pngDataUrl(64, 64), role: "subject" }],
    };

    assert.equal(thumbnailGenerationRequestSchema.safeParse(unsupported).success, false);
    assert.equal(thumbnailGenerationRequestSchema.safeParse(tooSmall).success, false);
  });

  test("rejects oversized images, too many references, and unknown settings", () => {
    const oversized = {
      ...validRequest(),
      referenceImages: [{ image: pngDataUrl(1280, 720, 5 * 1024 * 1024), role: "subject" }],
    };
    const tooMany = {
      ...validRequest(),
      referenceImages: Array.from({ length: 4 }, () => ({
        image: pngDataUrl(1280, 720),
        role: "style",
      })),
    };

    assert.equal(thumbnailGenerationRequestSchema.safeParse(oversized).success, false);
    assert.equal(thumbnailGenerationRequestSchema.safeParse(tooMany).success, false);
    assert.equal(thumbnailGenerationRequestSchema.safeParse({ ...validRequest(), intensity: 9 }).success, false);
  });

  test("requires an explicit direction for variation mode", () => {
    assert.equal(thumbnailGenerationRequestSchema.safeParse({
      ...validRequest(),
      mode: "variation",
    }).success, false);
    assert.equal(thumbnailGenerationRequestSchema.safeParse({
      ...validRequest(),
      mode: "variation",
      variationDirection: "Use a calmer background and preserve the same factual promise.",
    }).success, true);
  });

  test("rejects text when the selected layout reserves no text space", () => {
    assert.equal(thumbnailGenerationRequestSchema.safeParse({
      ...validRequest(),
      textPosition: "none",
    }).success, false);
    assert.equal(thumbnailGenerationRequestSchema.safeParse({
      ...validRequest(),
      textPosition: "none",
      mainText: "",
      subText: "",
    }).success, true);
  });
});

describe("thumbnail suggestion request contract", () => {
  test("rejects missing topics and legacy unbounded research context", () => {
    assert.equal(thumbnailSuggestionsRequestSchema.safeParse({ topic: "" }).success, false);
    assert.equal(thumbnailSuggestionsRequestSchema.safeParse({
      topic: "Camera test",
      researchContext: "legacy",
    }).success, false);
  });
});
