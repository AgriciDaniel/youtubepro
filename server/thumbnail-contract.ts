import { z } from "zod";

export const thumbnailStyles = [
  "bold",
  "minimal",
  "gaming",
  "vlog",
  "tutorial",
  "cinematic",
  "tech",
  "lifestyle",
] as const;

export const thumbnailCompositions = [
  "centered",
  "rule-of-thirds",
  "close-up",
  "wide-shot",
  "split-screen",
  "diagonal",
] as const;

export const thumbnailCameraAngles = [
  "eye-level",
  "low-angle",
  "high-angle",
  "dutch-angle",
  "overhead",
  "three-quarter",
] as const;

export const thumbnailLightingOptions = [
  "natural",
  "dramatic",
  "golden-hour",
  "studio",
  "neon",
  "backlit",
  "soft",
] as const;

export const thumbnailColorSchemes = [
  "vibrant",
  "muted",
  "warm",
  "cool",
  "monochrome",
  "complementary",
  "brand-colors",
] as const;

export const thumbnailTextPositions = [
  "left",
  "right",
  "center",
  "top",
  "bottom",
  "none",
] as const;

export const thumbnailReferenceRoles = [
  "subject",
  "style",
  "background",
  "composition",
] as const;

export const THUMBNAIL_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const THUMBNAIL_MAX_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024;
export const THUMBNAIL_MIN_IMAGE_DIMENSION = 128;
export const THUMBNAIL_MAX_IMAGE_DIMENSION = 4096;

export type ImageDataInspection = {
  mimeType: "image/png" | "image/jpeg";
  bytes: number;
  width: number;
  height: number;
};

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;

    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ].includes(marker);
    if (isStartOfFrame && segmentLength >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }

  return null;
}

export function inspectThumbnailImageDataUrl(value: string): ImageDataInspection | null {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;

  const mimeType = match[1] as ImageDataInspection["mimeType"];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) return null;

  if (mimeType === "image/png") {
    const signature = buffer.subarray(0, 8).toString("hex");
    if (buffer.length < 24 || signature !== "89504e470d0a1a0a") return null; // pragma: allowlist secret, PNG signature
    return {
      mimeType,
      bytes: buffer.length,
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  const dimensions = readJpegDimensions(buffer);
  return dimensions ? { mimeType, bytes: buffer.length, ...dimensions } : null;
}

const thumbnailImageDataUrlSchema = z.string().superRefine((value, ctx) => {
  const image = inspectThumbnailImageDataUrl(value);
  if (!image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reference image must be a valid PNG or JPEG data URL",
    });
    return;
  }
  if (image.bytes > THUMBNAIL_MAX_IMAGE_BYTES) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reference image exceeds 5 MB" });
  }
  if (
    image.width < THUMBNAIL_MIN_IMAGE_DIMENSION
    || image.height < THUMBNAIL_MIN_IMAGE_DIMENSION
    || image.width > THUMBNAIL_MAX_IMAGE_DIMENSION
    || image.height > THUMBNAIL_MAX_IMAGE_DIMENSION
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reference image dimensions must be between 128 and 4096 pixels",
    });
  }
});

export const thumbnailReferenceImageSchema = z.object({
  image: thumbnailImageDataUrlSchema,
  role: z.enum(thumbnailReferenceRoles),
}).strict();

export const thumbnailGenerationRequestSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  style: z.enum(thumbnailStyles).default("bold"),
  mainText: z.string().trim().max(50).default(""),
  subText: z.string().trim().max(80).default(""),
  thumbnailDescription: z.string().trim().max(1_000).default(""),
  composition: z.enum(thumbnailCompositions).default("centered"),
  cameraAngle: z.enum(thumbnailCameraAngles).default("eye-level"),
  lighting: z.enum(thumbnailLightingOptions).default("natural"),
  colorScheme: z.enum(thumbnailColorSchemes).default("vibrant"),
  textPosition: z.enum(thumbnailTextPositions).default("left"),
  autoBlend: z.boolean().default(false),
  referenceImages: z.array(thumbnailReferenceImageSchema).max(3).default([]),
  referenceRightsConfirmed: z.boolean().default(false),
  honestPromise: z.string().trim().max(500).optional(),
  thumbnailConcept: z.string().trim().max(700).optional(),
  mode: z.enum(["create", "variation"]).default("create"),
  variationDirection: z.string().trim().max(500).optional(),
}).strict().superRefine((request, ctx) => {
  if (request.referenceImages.length > 0 && !request.referenceRightsConfirmed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["referenceRightsConfirmed"],
      message: "Confirm that you have permission to use every reference image",
    });
  }

  const totalBytes = request.referenceImages.reduce((total, reference) => {
    return total + (inspectThumbnailImageDataUrl(reference.image)?.bytes || 0);
  }, 0);
  if (totalBytes > THUMBNAIL_MAX_TOTAL_IMAGE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["referenceImages"],
      message: "Reference images exceed the 12 MB combined limit",
    });
  }
  if (request.mode === "variation" && !request.variationDirection) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["variationDirection"],
      message: "Describe the requested variation",
    });
  }
  if (request.textPosition === "none" && (request.mainText || request.subText)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["textPosition"],
      message: "No text space cannot be combined with supplied thumbnail text",
    });
  }
});

export const thumbnailSuggestionsRequestSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  honestPromise: z.string().trim().max(500).optional(),
  thumbnailConcept: z.string().trim().max(700).optional(),
}).strict();

export const thumbnailSuggestionsSchema = z.array(
  z.string().trim().min(1).max(40),
).length(5);

export type ThumbnailGenerationRequest = z.infer<typeof thumbnailGenerationRequestSchema>;
export type ThumbnailSuggestionsRequest = z.infer<typeof thumbnailSuggestionsRequestSchema>;
