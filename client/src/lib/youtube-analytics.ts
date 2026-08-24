import type { Video } from "@shared/schema";

export function parseIsoDurationSeconds(duration?: string): number | null {
  if (!duration) return null;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return (Number(match[1] || 0) * 3600)
    + (Number(match[2] || 0) * 60)
    + Number(match[3] || 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function ageInDays(publishedAt: string, now: number): number {
  const published = new Date(publishedAt).getTime();
  if (!Number.isFinite(published)) return 1;
  return Math.max((now - published) / 86_400_000, 0.25);
}

function normalizedTag(tag: string): string {
  return tag.trim().toLocaleLowerCase();
}

export function calculateYouTubeAnalytics(videos: Video[], now = Date.now()) {
  const videosWithViews = videos.filter((video) => video.viewCount !== undefined);
  const engagementVideos = videos.filter((video) =>
    video.viewCount !== undefined
    && video.viewCount > 0
    && video.likeCount !== undefined
    && video.commentCount !== undefined,
  );
  const subscriberVideos = videos.filter((video) =>
    video.viewCount !== undefined
    && video.channelStatistics?.subscriberCount !== undefined
    && video.channelStatistics.subscriberCount > 0,
  );

  const totalViews = videosWithViews.reduce((sum, video) => sum + (video.viewCount || 0), 0);
  const totalLikes = videos.reduce((sum, video) => sum + (video.likeCount || 0), 0);
  const totalComments = videos.reduce((sum, video) => sum + (video.commentCount || 0), 0);
  const engagementViews = engagementVideos.reduce((sum, video) => sum + (video.viewCount || 0), 0);
  const engagementActions = engagementVideos.reduce(
    (sum, video) => sum + (video.likeCount || 0) + (video.commentCount || 0),
    0,
  );

  const topVideosList = [...videos]
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 6);

  const viewsDistribution = topVideosList.map((video) => ({
    name: video.title.substring(0, 40) + (video.title.length > 40 ? "..." : ""),
    views: video.viewCount || 0,
    likes: video.likeCount || 0,
  }));

  const durationSeconds = videos.map((video) => parseIsoDurationSeconds(video.duration));
  const durationData = [
    { name: "Under 4 min", value: durationSeconds.filter((seconds) => seconds !== null && seconds < 240).length },
    { name: "4 to 20 min", value: durationSeconds.filter((seconds) => seconds !== null && seconds >= 240 && seconds <= 1200).length },
    { name: "Over 20 min", value: durationSeconds.filter((seconds) => seconds !== null && seconds > 1200).length },
  ];

  const recencyData = [
    { name: "Last 7 days", value: 0 },
    { name: "8-30 days", value: 0 },
    { name: "1-12 months", value: 0 },
    { name: "Over 1 year", value: 0 },
  ];
  for (const video of videos) {
    const age = ageInDays(video.publishedAt, now);
    if (age <= 7) recencyData[0].value += 1;
    else if (age <= 30) recencyData[1].value += 1;
    else if (age <= 365) recencyData[2].value += 1;
    else recencyData[3].value += 1;
  }

  const velocityLeaders = videosWithViews
    .map((video) => ({
      video,
      viewsPerDay: (video.viewCount || 0) / ageInDays(video.publishedAt, now),
    }))
    .sort((a, b) => b.viewsPerDay - a.viewsPerDay)
    .slice(0, 5);

  const breakoutLeaders = subscriberVideos
    .map((video) => ({
      video,
      viewsPerSubscriber: (video.viewCount || 0) / (video.channelStatistics?.subscriberCount || 1),
    }))
    .sort((a, b) => b.viewsPerSubscriber - a.viewsPerSubscriber)
    .slice(0, 5);

  const tagLabels = new Map<string, string>();
  const tagCounts = new Map<string, number>();
  for (const video of videos) {
    for (const tag of Array.from(new Set((video.tags || []).map(normalizedTag).filter(Boolean)))) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      if (!tagLabels.has(tag)) tagLabels.set(tag, video.tags?.find((item) => normalizedTag(item) === tag) || tag);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([tag, count]) => ({ label: tagLabels.get(tag) || tag, count }));

  const dailyViews = videosWithViews.map((video) =>
    (video.viewCount || 0) / ageInDays(video.publishedAt, now),
  );

  return {
    totalViews,
    avgViews: videosWithViews.length > 0 ? Math.round(totalViews / videosWithViews.length) : 0,
    medianViews: Math.round(median(videosWithViews.map((video) => video.viewCount || 0))),
    medianDailyViews: Math.round(median(dailyViews)),
    totalEngagement: totalLikes + totalComments,
    avgEngagement: engagementViews > 0
      ? ((engagementActions / engagementViews) * 100).toFixed(2)
      : "N/A",
    totalVideos: videos.length,
    uniqueChannels: new Set(videos.map((video) => video.channelId)).size,
    viewsDistribution,
    durationData,
    recencyData,
    topVideo: topVideosList[0] || null,
    topVideosList,
    velocityLeaders,
    breakoutLeaders,
    topTags,
    coverage: {
      views: videosWithViews.length,
      engagement: engagementVideos.length,
      subscribers: subscriberVideos.length,
      captions: videos.filter((video) => video.hasCaptions === true).length,
      tags: videos.filter((video) => (video.tags?.length || 0) > 0).length,
      hd: videos.filter((video) => video.definition === "hd").length,
    },
  };
}
