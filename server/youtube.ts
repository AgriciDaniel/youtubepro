import type { Video, SearchFilters, SearchResponse } from "@shared/schema";
import { UploadDateFilter, DurationFilter, SortBy } from "@shared/schema";
import { createHash } from "node:crypto";
import { ProviderError } from "./provider-errors";

const BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_TIMEOUT_MS = 15_000;

if (!process.env.YOUTUBE_API_KEY) {
  console.warn("Warning: YOUTUBE_API_KEY is not set. YouTube search will not work.");
}

function getPublishedAfter(uploadDate: UploadDateFilter): string | undefined {
  const now = new Date();

  switch (uploadDate) {
    case UploadDateFilter.HOUR:
      now.setHours(now.getHours() - 1);
      return now.toISOString();
    case UploadDateFilter.TODAY:
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case UploadDateFilter.WEEK:
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case UploadDateFilter.MONTH:
      now.setMonth(now.getMonth() - 1);
      return now.toISOString();
    case UploadDateFilter.YEAR:
      now.setFullYear(now.getFullYear() - 1);
      return now.toISOString();
    default:
      return undefined;
  }
}

function getVideoDuration(duration: DurationFilter): string | undefined {
  switch (duration) {
    case DurationFilter.SHORT:
      return "short";
    case DurationFilter.MEDIUM:
      return "medium";
    case DurationFilter.LONG:
      return "long";
    default:
      return undefined;
  }
}

function getOrderBy(sortBy: SortBy): string {
  switch (sortBy) {
    case SortBy.DATE:
      return "date";
    case SortBy.VIEW_COUNT:
      return "viewCount";
    case SortBy.RATING:
      return "rating";
    default:
      return "relevance";
  }
}

function parseOptionalCount(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getYouTubeErrorReason(body: any): string {
  return [
    body?.error?.message,
    ...(Array.isArray(body?.error?.errors)
      ? body.error.errors.flatMap((entry: any) => [entry?.reason, entry?.message])
      : []),
  ].filter((value): value is string => typeof value === "string").join(" ");
}

function youtubeHttpError(status: number, body: unknown, stage: string): ProviderError {
  const reason = getYouTubeErrorReason(body).toLowerCase();
  const invalidKey = status === 401
    || reason.includes("keyinvalid")
    || reason.includes("api key not valid")
    || reason.includes("invalid api key");
  const quota = status === 429
    || reason.includes("quota")
    || reason.includes("dailylimit")
    || reason.includes("rate limit");

  if (invalidKey) {
    return new ProviderError({
      message: `YouTube rejected the API key during ${stage}.`,
      category: "invalid_key",
      code: "YOUTUBE_INVALID_KEY",
      status: 401,
      retryable: false,
    });
  }
  if (quota) {
    return new ProviderError({
      message: `YouTube quota was unavailable during ${stage}.`,
      category: "quota",
      code: "YOUTUBE_QUOTA",
      status: 429,
      retryable: true,
    });
  }
  if (status >= 500) {
    return new ProviderError({
      message: `YouTube returned a server error during ${stage}.`,
      category: "provider_server",
      code: "YOUTUBE_PROVIDER_SERVER",
      status: 502,
      retryable: true,
    });
  }
  return new ProviderError({
    message: `YouTube rejected the ${stage} request.`,
    category: "unknown",
    code: "YOUTUBE_REQUEST_REJECTED",
    status: 502,
    retryable: false,
  });
}

async function fetchYouTubeJson(url: string, stage: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ProviderError({
        message: `YouTube returned malformed JSON during ${stage}.`,
        category: "invalid_response",
        code: "YOUTUBE_INVALID_RESPONSE",
        status: 502,
        retryable: false,
        cause: error,
      });
    }
    if (!response.ok) throw youtubeHttpError(response.status, body, stage);
    return body;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError({
        message: `YouTube timed out during ${stage}.`,
        category: "timeout",
        code: "YOUTUBE_TIMEOUT",
        status: 504,
        retryable: true,
        cause: error,
      });
    }
    throw new ProviderError({
      message: `YouTube could not be reached during ${stage}.`,
      category: "network",
      code: "YOUTUBE_NETWORK",
      status: 502,
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function createSnapshotId(filters: SearchFilters, orderedVideoIds: string[], retrievedAt: string): string {
  const identity = JSON.stringify({
    query: filters.query.trim(),
    uploadDate: filters.uploadDate,
    duration: filters.duration,
    sortBy: filters.sortBy,
    maxResults: filters.maxResults,
    orderedVideoIds,
    retrievedAt,
  });
  return `yt_${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
}

export async function searchVideos(filters: SearchFilters): Promise<SearchResponse> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderError({
      message: "YouTube API key is not configured.",
      category: "missing_key",
      code: "YOUTUBE_MISSING_KEY",
      status: 503,
      retryable: false,
    });
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: filters.query,
    type: "video",
    maxResults: String(filters.maxResults || 25),
    key: apiKey,
    order: getOrderBy(filters.sortBy),
  });

  const publishedAfter = getPublishedAfter(filters.uploadDate);
  if (publishedAfter) {
    params.set("publishedAfter", publishedAfter);
  }

  const videoDuration = getVideoDuration(filters.duration);
  if (videoDuration) {
    params.set("videoDuration", videoDuration);
  }

  const searchUrl = `${BASE_URL}/search?${params}`;
  const searchData = await fetchYouTubeJson(searchUrl, "search");
  const retrievedAt = new Date().toISOString();
  const warnings: SearchResponse["warnings"] = [];
  if (!Array.isArray(searchData.items)) {
    throw new ProviderError({
      message: "YouTube returned an invalid search response.",
      category: "invalid_response",
      code: "YOUTUBE_INVALID_RESPONSE",
      status: 502,
      retryable: false,
    });
  }

  if (searchData.items.length === 0) {
    const orderedVideoIds: string[] = [];
    return {
      videos: [],
      totalResults: 0,
      resultsPerPage: 0,
      regionCode: typeof searchData.regionCode === "string" ? searchData.regionCode : undefined,
      snapshotId: createSnapshotId(filters, orderedVideoIds, retrievedAt),
      retrievedAt,
      totalResultsIsApproximate: true,
      provenance: {
        provider: "youtube-data-api-v3",
        query: filters.query.trim(),
        filters: {
          uploadDate: filters.uploadDate,
          duration: filters.duration,
          sortBy: filters.sortBy,
          maxResults: filters.maxResults,
        },
        orderedVideoIds,
      },
      enrichment: {
        search: { status: "complete", requested: filters.maxResults, returned: 0 },
        videoDetails: { status: "skipped", requested: 0, returned: 0 },
        channels: { status: "skipped", requested: 0, returned: 0 },
      },
      warnings,
    };
  }

  const orderedVideoIds: string[] = searchData.items
    .map((item: any) => item.id?.videoId)
    .filter((id: unknown): id is string => typeof id === "string");
  if (orderedVideoIds.length !== searchData.items.length) {
    warnings.push({
      code: "SEARCH_ITEMS_OMITTED",
      stage: "search",
      message: "Some search rows did not contain a public video identifier and were omitted.",
    });
  }
  if (orderedVideoIds.length === 0) {
    return {
      videos: [],
      totalResults: parseOptionalCount(searchData.pageInfo?.totalResults) ?? 0,
      resultsPerPage: parseOptionalCount(searchData.pageInfo?.resultsPerPage) ?? 0,
      regionCode: typeof searchData.regionCode === "string" ? searchData.regionCode : undefined,
      snapshotId: createSnapshotId(filters, orderedVideoIds, retrievedAt),
      retrievedAt,
      totalResultsIsApproximate: true,
      provenance: {
        provider: "youtube-data-api-v3",
        query: filters.query.trim(),
        filters: {
          uploadDate: filters.uploadDate,
          duration: filters.duration,
          sortBy: filters.sortBy,
          maxResults: filters.maxResults,
        },
        orderedVideoIds,
      },
      enrichment: {
        search: { status: "partial", requested: filters.maxResults, returned: 0 },
        videoDetails: { status: "skipped", requested: 0, returned: 0 },
        channels: { status: "skipped", requested: 0, returned: 0 },
      },
      warnings,
    };
  }
  const videoIds = orderedVideoIds.join(",");

  const detailsParams = new URLSearchParams({
    part: "snippet,statistics,contentDetails,status,topicDetails,paidProductPlacementDetails,liveStreamingDetails",
    id: videoIds,
    key: apiKey,
  });

  const detailsUrl = `${BASE_URL}/videos?${detailsParams}`;
  const detailsData = await fetchYouTubeJson(detailsUrl, "video details");
  if (!Array.isArray(detailsData.items)) {
    throw new ProviderError({
      message: "YouTube returned an invalid video-details response.",
      category: "invalid_response",
      code: "YOUTUBE_INVALID_RESPONSE",
      status: 502,
      retryable: false,
    });
  }
  if (detailsData.items.length !== orderedVideoIds.length) {
    warnings.push({
      code: "VIDEO_DETAILS_PARTIAL",
      stage: "video_details",
      message: "Some search results no longer had public video details and were omitted.",
    });
  }
  const channelIds = Array.from(new Set(
    detailsData.items
      .map((item: any) => item.snippet?.channelId)
      .filter((id: unknown): id is string => typeof id === "string"),
  ));

  const channelDetails = new Map<string, any>();
  let channelStatus: "complete" | "partial" | "skipped" = channelIds.length > 0 ? "complete" : "skipped";
  if (channelIds.length > 0) {
    const channelParams = new URLSearchParams({
      part: "snippet,statistics,topicDetails,brandingSettings",
      id: channelIds.join(","),
      maxResults: "50",
      key: apiKey,
    });

    try {
      const channelData = await fetchYouTubeJson(`${BASE_URL}/channels?${channelParams}`, "channel enrichment");
      for (const channel of Array.isArray(channelData.items) ? channelData.items : []) {
        channelDetails.set(channel.id, channel);
      }
      if (channelDetails.size !== channelIds.length) channelStatus = "partial";
    } catch {
      channelStatus = "partial";
    }
    if (channelStatus === "partial") {
      warnings.push({
        code: "CHANNEL_ENRICHMENT_PARTIAL",
        stage: "channel_enrichment",
        message: "Channel-level public metadata was unavailable for some or all videos.",
      });
    }
  }

  const detailsById = new Map<string, any>(
    detailsData.items.map((item: any) => [item.id, item]),
  );

  const videos: Video[] = orderedVideoIds.flatMap((id) => {
    const item = detailsById.get(id);
    if (!item) return [];
    const channel = channelDetails.get(item.snippet.channelId);
    const channelStats = channel?.statistics;

    return [{
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails?.maxres?.url
        || item.snippet.thumbnails?.standard?.url
        || item.snippet.thumbnails?.high?.url
        || item.snippet.thumbnails?.medium?.url
        || item.snippet.thumbnails?.default?.url,
      description: item.snippet.description,
      viewCount: parseOptionalCount(item.statistics?.viewCount),
      likeCount: parseOptionalCount(item.statistics?.likeCount),
      commentCount: parseOptionalCount(item.statistics?.commentCount),
      duration: item.contentDetails?.duration,
      tags: item.snippet.tags,
      categoryId: item.snippet.categoryId,
      liveBroadcastContent: item.snippet.liveBroadcastContent,
      defaultLanguage: item.snippet.defaultLanguage,
      defaultAudioLanguage: item.snippet.defaultAudioLanguage,
      definition: item.contentDetails?.definition,
      hasCaptions: item.contentDetails?.caption === "true"
        ? true
        : item.contentDetails?.caption === "false"
          ? false
          : undefined,
      licensedContent: item.contentDetails?.licensedContent,
      embeddable: item.status?.embeddable,
      madeForKids: item.status?.madeForKids,
      hasPaidProductPlacement: item.paidProductPlacementDetails?.hasPaidProductPlacement,
      topicCategories: item.topicDetails?.topicCategories,
      liveStreamingDetails: item.liveStreamingDetails ? {
        actualStartTime: item.liveStreamingDetails.actualStartTime,
        actualEndTime: item.liveStreamingDetails.actualEndTime,
        scheduledStartTime: item.liveStreamingDetails.scheduledStartTime,
        concurrentViewers: parseOptionalCount(item.liveStreamingDetails.concurrentViewers),
      } : undefined,
      channelStatistics: channel ? {
        subscriberCount: channelStats?.hiddenSubscriberCount
          ? undefined
          : parseOptionalCount(channelStats?.subscriberCount),
        hiddenSubscriberCount: Boolean(channelStats?.hiddenSubscriberCount),
        videoCount: parseOptionalCount(channelStats?.videoCount),
        viewCount: parseOptionalCount(channelStats?.viewCount),
        publishedAt: channel.snippet?.publishedAt,
        country: channel.snippet?.country,
        thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
        description: channel.snippet?.description,
        customUrl: channel.snippet?.customUrl,
        defaultLanguage: channel.brandingSettings?.channel?.defaultLanguage,
        keywords: channel.brandingSettings?.channel?.keywords,
        topicCategories: channel.topicDetails?.topicCategories,
      } : undefined,
    }];
  });

  return {
    videos,
    totalResults: searchData.pageInfo?.totalResults || videos.length,
    nextPageToken: searchData.nextPageToken,
    resultsPerPage: searchData.pageInfo?.resultsPerPage || videos.length,
    regionCode: searchData.regionCode,
    snapshotId: createSnapshotId(filters, orderedVideoIds, retrievedAt),
    retrievedAt,
    totalResultsIsApproximate: true,
    provenance: {
      provider: "youtube-data-api-v3",
      query: filters.query.trim(),
      filters: {
        uploadDate: filters.uploadDate,
        duration: filters.duration,
        sortBy: filters.sortBy,
        maxResults: filters.maxResults,
      },
      orderedVideoIds,
    },
    enrichment: {
      search: { status: "complete", requested: filters.maxResults, returned: orderedVideoIds.length },
      videoDetails: {
        status: detailsData.items.length === orderedVideoIds.length ? "complete" : "partial",
        requested: orderedVideoIds.length,
        returned: detailsData.items.length,
      },
      channels: {
        status: channelStatus,
        requested: channelIds.length,
        returned: channelDetails.size,
      },
    },
    warnings,
  };
}
