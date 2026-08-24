import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  providerErrorResponseSchema,
  researchInsightsRequestSchema,
  researchInsightsResponseSchema,
} from "./schema";

describe("research API contracts", () => {
  test("requires at least one source video for AI research", () => {
    const parsed = researchInsightsRequestSchema.safeParse({ query: "camera", videos: [] });
    assert.equal(parsed.success, false);
  });

  test("requires response identity and generation time", () => {
    const parsed = researchInsightsResponseSchema.safeParse({});
    assert.equal(parsed.success, false);
  });

  test("rejects snapshot provenance with a different ordered video set", () => {
    const parsed = researchInsightsRequestSchema.safeParse({
      query: "camera",
      snapshotId: "yt_snapshot_12345678",
      retrievedAt: "2026-08-24T10:00:00.000Z",
      videos: [{
        id: "video-1", title: "Camera", channelTitle: "Channel", channelId: "channel-1",
        publishedAt: "2026-08-20T10:00:00.000Z", thumbnailUrl: "https://example.test/image.jpg", description: "Review",
      }],
      provenance: {
        provider: "youtube-data-api-v3",
        query: "camera",
        filters: { uploadDate: "any", duration: "any", sortBy: "relevance", maxResults: 50 },
        orderedVideoIds: ["different-video"],
      },
      analytics: {
        totalVideos: 1, totalViews: 0, avgViews: 0, medianViews: 0, medianDailyViews: 0,
        avgEngagement: "N/A", uniqueChannels: 1, durationData: [], recencyData: [], topTags: [],
        coverage: { views: 0, engagement: 0, subscribers: 0, captions: 0, tags: 0, hd: 0 },
      },
      enrichment: {
        search: { status: "complete", requested: 1, returned: 1 },
        videoDetails: { status: "complete", requested: 1, returned: 1 },
        channels: { status: "complete", requested: 1, returned: 1 },
      },
      warnings: [],
    });
    assert.equal(parsed.success, false);
  });

  test("keeps provider error categories machine-readable", () => {
    const result = providerErrorResponseSchema.parse({
      error: "YouTube Data API quota is unavailable",
      code: "YOUTUBE_QUOTA",
      category: "quota",
      retryable: true,
      suggestion: "Wait for quota to reset.",
    });
    assert.equal(result.category, "quota");
    assert.equal(result.retryable, true);
  });
});
