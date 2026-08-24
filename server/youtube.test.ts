import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { searchResponseSchema, UploadDateFilter, DurationFilter, SortBy, type SearchFilters } from "@shared/schema";
import { ProviderError } from "./provider-errors";
import { createSnapshotId, searchVideos } from "./youtube";

const filters: SearchFilters = {
  query: "camera review",
  uploadDate: UploadDateFilter.ANY,
  duration: DurationFilter.ANY,
  sortBy: SortBy.RELEVANCE,
  maxResults: 25,
};

const originalFetch = globalThis.fetch;
const originalKey = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalKey;
});

describe("YouTube research snapshots", () => {
  test("snapshot IDs are deterministic for identical provenance", () => {
    const retrievedAt = "2026-08-24T10:00:00.000Z";
    const first = createSnapshotId(filters, ["video-a", "video-b"], retrievedAt);
    const second = createSnapshotId(filters, ["video-a", "video-b"], retrievedAt);
    const reordered = createSnapshotId(filters, ["video-b", "video-a"], retrievedAt);

    assert.equal(first, second);
    assert.notEqual(first, reordered);
    assert.match(first, /^yt_[a-f0-9]{32}$/);
  });

  test("returns provenance and marks failed channel enrichment as partial", async () => {
    process.env.YOUTUBE_API_KEY = "test-key"; // pragma: allowlist secret, test fixture
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/search?")) {
        return Response.json({
          items: [{ id: { videoId: "video-a" } }],
          pageInfo: { totalResults: 12, resultsPerPage: 1 },
          regionCode: "US",
        });
      }
      if (url.includes("/videos?")) {
        return Response.json({
          items: [{
            id: "video-a",
            snippet: {
              title: "Camera review",
              channelTitle: "Example Channel",
              channelId: "channel-a",
              publishedAt: "2026-08-20T10:00:00Z",
              thumbnails: { high: { url: "https://example.test/thumb.jpg" } },
              description: "A public description",
            },
            statistics: { viewCount: "123" },
            contentDetails: { duration: "PT5M" },
            status: { embeddable: true },
          }],
        });
      }
      if (url.includes("/channels?")) {
        return Response.json({ error: { message: "temporary" } }, { status: 503 });
      }
      throw new Error(`Unexpected test URL: ${url}`);
    }) as typeof fetch;

    const result = await searchVideos(filters);

    assert.equal(result.provenance.query, "camera review");
    assert.deepEqual(result.provenance.orderedVideoIds, ["video-a"]);
    assert.equal(result.enrichment.videoDetails.status, "complete");
    assert.equal(result.enrichment.channels.status, "partial");
    assert.equal(result.warnings[0]?.code, "CHANNEL_ENRICHMENT_PARTIAL");
    assert.equal(result.videos[0]?.viewCount, 123);
    assert.equal(result.videos[0]?.likeCount, undefined);
    assert.equal(result.videos[0]?.hasCaptions, undefined);
    assert.doesNotThrow(() => searchResponseSchema.parse(result));
  });

  test("distinguishes an invalid API key response", async () => {
    process.env.YOUTUBE_API_KEY = "test-key"; // pragma: allowlist secret, test fixture
    globalThis.fetch = (async () => Response.json({
      error: { errors: [{ reason: "keyInvalid" }], message: "API key not valid" },
    }, { status: 400 })) as typeof fetch;

    await assert.rejects(
      searchVideos(filters),
      (error: unknown) => error instanceof ProviderError
        && error.category === "invalid_key"
        && error.status === 401,
    );
  });

  test("distinguishes quota exhaustion", async () => {
    process.env.YOUTUBE_API_KEY = "test-key"; // pragma: allowlist secret, test fixture
    globalThis.fetch = (async () => Response.json({
      error: { errors: [{ reason: "quotaExceeded" }], message: "Quota exceeded" },
    }, { status: 403 })) as typeof fetch;

    await assert.rejects(
      searchVideos(filters),
      (error: unknown) => error instanceof ProviderError
        && error.category === "quota"
        && error.status === 429
        && error.retryable,
    );
  });

  test("distinguishes a missing key", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await assert.rejects(
      searchVideos(filters),
      (error: unknown) => error instanceof ProviderError
        && error.category === "missing_key"
        && error.status === 503
        && !error.retryable,
    );
  });

  test("distinguishes timeout and network failures", async () => {
    process.env.YOUTUBE_API_KEY = "test-key"; // pragma: allowlist secret, test fixture
    globalThis.fetch = (async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as typeof fetch;
    await assert.rejects(
      searchVideos(filters),
      (error: unknown) => error instanceof ProviderError && error.category === "timeout",
    );

    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await assert.rejects(
      searchVideos(filters),
      (error: unknown) => error instanceof ProviderError && error.category === "network",
    );
  });

  test("distinguishes provider server failures", async () => {
    process.env.YOUTUBE_API_KEY = "test-key"; // pragma: allowlist secret, test fixture
    globalThis.fetch = (async () => Response.json({ error: { message: "temporary" } }, { status: 503 })) as typeof fetch;
    await assert.rejects(
      searchVideos(filters),
      (error: unknown) => error instanceof ProviderError
        && error.category === "provider_server"
        && error.status === 502,
    );
  });
});
