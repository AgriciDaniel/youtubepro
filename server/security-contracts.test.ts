import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  narrationExtractionRequestSchema,
  titleRegenerationRequestSchema,
} from "./api-contracts";
import { createRateLimiter } from "./rate-limit";
import {
  apiKeySettingsSchema,
  isTrustedLocalSettingsMetadata,
} from "./settings";
import { scriptInputSchema, videoSchema } from "@shared/schema";

test("local Settings accepts a direct loopback same-origin request", () => {
  assert.equal(isTrustedLocalSettingsMetadata({
    remoteAddress: "127.0.0.1",
    host: "127.0.0.1:5000",
    origin: "http://127.0.0.1:5000",
    secFetchSite: "same-origin",
  }), true);
});

test("local Settings rejects forwarded, non-loopback, and cross-origin requests", () => {
  assert.equal(isTrustedLocalSettingsMetadata({
    remoteAddress: "127.0.0.1",
    host: "127.0.0.1:5000",
    xForwardedFor: "203.0.113.4",
  }), false);
  assert.equal(isTrustedLocalSettingsMetadata({
    remoteAddress: "192.168.1.10",
    host: "192.168.1.10:5000",
  }), false);
  assert.equal(isTrustedLocalSettingsMetadata({
    remoteAddress: "::1",
    host: "localhost:5000",
    origin: "https://example.test",
  }), false);
  assert.equal(isTrustedLocalSettingsMetadata({
    remoteAddress: "127.0.0.1",
    host: "attacker@example.test@localhost:5000",
  }), false);
});

test("Settings payload is strict, bounded, and model allowlisted", () => {
  assert.equal(apiKeySettingsSchema.safeParse({ youtubeApiKey: "x".repeat(513) }).success, false);
  assert.equal(apiKeySettingsSchema.safeParse({ geminiTextModel: "unknown-model" }).success, false);
  assert.equal(apiKeySettingsSchema.safeParse({ unexpected: true }).success, false);
});

test("public text request schemas reject oversized or unknown input", () => {
  assert.equal(narrationExtractionRequestSchema.safeParse({ scriptContent: "x".repeat(80_001) }).success, false);
  assert.equal(titleRegenerationRequestSchema.safeParse({ topic: "x".repeat(501) }).success, false);
  assert.equal(scriptInputSchema.safeParse({
    topic: "topic",
    format: "Tutorial/How-to",
    audience: "General Audience",
    unexpected: true,
  }).success, false);
});

test("incoming research video records have bounded text and arrays", () => {
  const validVideo = {
    id: "video-id",
    title: "Title",
    channelTitle: "Channel",
    channelId: "channel-id",
    publishedAt: "2026-01-01T00:00:00Z",
    thumbnailUrl: "https://i.ytimg.com/example.jpg",
    description: "Description",
  };
  assert.equal(videoSchema.safeParse(validVideo).success, true);
  assert.equal(videoSchema.safeParse({ ...validVideo, title: "x".repeat(501) }).success, false);
  assert.equal(videoSchema.safeParse({ ...validVideo, tags: Array.from({ length: 101 }, () => "tag") }).success, false);
});

test("rate limiter permits the configured window and then returns 429", () => {
  let timestamp = 1_000;
  const { middleware } = createRateLimiter({ maxRequests: 2, windowMs: 60_000, now: () => timestamp });
  const request = { ip: "127.0.0.1", socket: {} } as Request;
  const headers = new Map<string, string>();
  let statusCode = 200;
  let payload: unknown;
  const response = {
    setHeader: (name: string, value: string) => headers.set(name, value),
    status: (value: number) => {
      statusCode = value;
      return response;
    },
    json: (value: unknown) => {
      payload = value;
      return response;
    },
  } as unknown as Response;
  let nextCalls = 0;
  const next = (() => { nextCalls += 1; }) as NextFunction;

  middleware(request, response, next);
  middleware(request, response, next);
  middleware(request, response, next);
  assert.equal(nextCalls, 2);
  assert.equal(statusCode, 429);
  assert.equal(headers.get("Retry-After"), "60");
  assert.deepEqual(payload, {
    error: "Too many requests. Please wait before trying again.",
    retryAfter: 60,
  });

  timestamp += 60_000;
  middleware(request, response, next);
  assert.equal(nextCalls, 3);
});
