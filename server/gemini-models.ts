export const GEMINI_TEXT_MODELS = [
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    description: "Recommended production default for capable, fast research and writing.",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    description: "Highest-reasoning option, with preview stability and latency tradeoffs.",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    description: "Previous-generation balanced model.",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description: "Stable general-purpose model.",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    description: "Lower-cost choice for high-volume work.",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    description: "Efficient earlier-generation model.",
  },
] as const;

export const GEMINI_IMAGE_MODELS = [
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    description: "Recommended balance of image quality, speed, and cost.",
  },
  {
    id: "gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite",
    description: "Fastest, lowest-cost image option.",
  },
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro",
    description: "Premium option for complex, high-precision thumbnails.",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Nano Banana (legacy)",
    description: "Legacy image model retained for compatibility.",
  },
] as const;

export const DEFAULT_GEMINI_TEXT_MODEL = GEMINI_TEXT_MODELS[0].id;
export const DEFAULT_GEMINI_IMAGE_MODEL = GEMINI_IMAGE_MODELS[0].id;

export type GeminiTextModel = (typeof GEMINI_TEXT_MODELS)[number]["id"];
export type GeminiImageModel = (typeof GEMINI_IMAGE_MODELS)[number]["id"];

export function isGeminiTextModel(value: string): value is GeminiTextModel {
  return GEMINI_TEXT_MODELS.some((model) => model.id === value);
}

export function isGeminiImageModel(value: string): value is GeminiImageModel {
  return GEMINI_IMAGE_MODELS.some((model) => model.id === value);
}

export function getGeminiImageModelLabel(modelId: string): string {
  return GEMINI_IMAGE_MODELS.find((model) => model.id === modelId)?.label || modelId;
}
