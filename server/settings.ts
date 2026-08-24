import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Request } from "express";
import { z } from "zod";
import { configureGeminiApiKey, configureGeminiModels } from "./gemini";
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_TEXT_MODEL,
  GEMINI_IMAGE_MODELS,
  GEMINI_TEXT_MODELS,
  isGeminiImageModel,
  isGeminiTextModel,
  type GeminiImageModel,
  type GeminiTextModel,
} from "./gemini-models";

const ENV_PATH = path.resolve(process.cwd(), ".env");
const ENV_TEMP_PATH = path.resolve(process.cwd(), ".env.tmp");
const SUPPORTED_KEYS = [
  "YOUTUBE_API_KEY",
  "GEMINI_API_KEY",
  "GEMINI_TEXT_MODEL",
  "GEMINI_IMAGE_MODEL",
] as const;

type SupportedKey = (typeof SUPPORTED_KEYS)[number];

export interface ApiKeySettings {
  youtubeApiKey?: string;
  geminiApiKey?: string;
  geminiTextModel?: string;
  geminiImageModel?: string;
}

export const apiKeySettingsSchema = z.object({
  youtubeApiKey: z.string().trim().min(8).max(512).optional(),
  geminiApiKey: z.string().trim().min(8).max(512).optional(),
  geminiTextModel: z.string().refine(isGeminiTextModel, "Select a supported Gemini text model.").optional(),
  geminiImageModel: z.string().refine(isGeminiImageModel, "Select a supported Gemini image model.").optional(),
}).strict();

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  return address === "127.0.0.1"
    || address === "::1"
    || address.startsWith("::ffff:127.");
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1") return true;
  const octets = normalized.split(".");
  return octets.length === 4
    && octets[0] === "127"
    && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export interface LocalSettingsRequestMetadata {
  remoteAddress?: string;
  host?: string;
  origin?: string;
  forwarded?: string;
  xForwardedFor?: string;
  xForwardedHost?: string;
  xForwardedProto?: string;
  via?: string;
  secFetchSite?: string;
}

export function isTrustedLocalSettingsMetadata(input: LocalSettingsRequestMetadata): boolean {
  if (!isLoopbackAddress(input.remoteAddress)) return false;
  if (
    input.forwarded
    || input.xForwardedFor
    || input.xForwardedHost
    || input.xForwardedProto
    || input.via
  ) return false;

  if (!input.host) return false;
  if (/[@/\\\s%]/.test(input.host)) return false;
  let hostUrl: URL;
  try {
    hostUrl = new URL(`http://${input.host}`);
  } catch {
    return false;
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false;

  if (input.origin) {
    try {
      const origin = new URL(input.origin);
      if (
        !["http:", "https:"].includes(origin.protocol)
        || !isLoopbackHostname(origin.hostname)
        || origin.host !== hostUrl.host
      ) return false;
    } catch {
      return false;
    }
  }

  return !input.secFetchSite || input.secFetchSite === "same-origin" || input.secFetchSite === "none";
}

export function isLocalSettingsRequest(req: Request): boolean {
  return isTrustedLocalSettingsMetadata({
    remoteAddress: req.socket.remoteAddress,
    host: req.get("host"),
    origin: req.get("origin"),
    forwarded: req.get("forwarded"),
    xForwardedFor: req.get("x-forwarded-for"),
    xForwardedHost: req.get("x-forwarded-host"),
    xForwardedProto: req.get("x-forwarded-proto"),
    via: req.get("via"),
    secFetchSite: req.get("sec-fetch-site"),
  });
}

export function getApiKeyStatus() {
  const textModel = isGeminiTextModel(process.env.GEMINI_TEXT_MODEL || "")
    ? process.env.GEMINI_TEXT_MODEL as GeminiTextModel
    : DEFAULT_GEMINI_TEXT_MODEL;
  const imageModel = isGeminiImageModel(process.env.GEMINI_IMAGE_MODEL || "")
    ? process.env.GEMINI_IMAGE_MODEL as GeminiImageModel
    : DEFAULT_GEMINI_IMAGE_MODEL;

  return {
    youtube: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    models: {
      text: textModel,
      image: imageModel,
      textOptions: GEMINI_TEXT_MODELS,
      imageOptions: GEMINI_IMAGE_MODELS,
    },
  };
}

function validateApiKey(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length < 8 || trimmed.length > 512) {
    throw new Error(`${label} must be between 8 and 512 characters.`);
  }
  if (/\r|\n|\0/.test(trimmed)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return trimmed;
}

function setEnvValue(contents: string, key: SupportedKey, value: string): string {
  const assignment = `${key}=${JSON.stringify(value)}`;
  const lines = contents.split(/\r?\n/);
  const lineIndex = lines.findIndex((line) => line.startsWith(`${key}=`));

  if (lineIndex >= 0) {
    lines[lineIndex] = assignment;
  } else {
    if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
    lines.push(assignment);
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export async function saveApiKeySettings(input: ApiKeySettings) {
  const youtubeApiKey = validateApiKey(input.youtubeApiKey, "YouTube API key");
  const geminiApiKey = validateApiKey(input.geminiApiKey, "Gemini API key");
  const currentStatus = getApiKeyStatus();
  const textModel = input.geminiTextModel ?? currentStatus.models.text;
  const imageModel = input.geminiImageModel ?? currentStatus.models.image;

  if (!youtubeApiKey && !geminiApiKey
    && input.geminiTextModel === undefined
    && input.geminiImageModel === undefined) {
    throw new Error("Enter a replacement key or select a model to save.");
  }

  if (!isGeminiTextModel(textModel)) {
    throw new Error("Select a supported Gemini text model.");
  }
  if (!isGeminiImageModel(imageModel)) {
    throw new Error("Select a supported Gemini image model.");
  }

  let contents = "";
  try {
    contents = await readFile(ENV_PATH, "utf8");
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }

  if (youtubeApiKey) {
    contents = setEnvValue(contents, "YOUTUBE_API_KEY", youtubeApiKey);
  }
  if (geminiApiKey) {
    contents = setEnvValue(contents, "GEMINI_API_KEY", geminiApiKey);
  }
  contents = setEnvValue(contents, "GEMINI_TEXT_MODEL", textModel);
  contents = setEnvValue(contents, "GEMINI_IMAGE_MODEL", imageModel);

  await writeFile(ENV_TEMP_PATH, contents, { encoding: "utf8", mode: 0o600 });
  await rename(ENV_TEMP_PATH, ENV_PATH);
  await chmod(ENV_PATH, 0o600);

  if (youtubeApiKey) process.env.YOUTUBE_API_KEY = youtubeApiKey;
  if (geminiApiKey) configureGeminiApiKey(geminiApiKey);
  configureGeminiModels(textModel, imageModel);

  return getApiKeyStatus();
}
