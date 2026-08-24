import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ResearchReportData } from "@/lib/research-export";
import { buildResearchCsv, buildResearchExportTables, buildResearchXls } from "@/lib/research-export";
import { buildResearchPDF } from "@/lib/pdfGenerator";

const snapshotId = "yt_export_snapshot_12345678";
const claim = {
  id: "claim-1",
  claim: "The returned sample contains comparison-led titles.",
  evidenceClass: "observed" as const,
  sourceVideoIds: ["video-1"],
  confidence: "high" as const,
  limitations: ["Limited to the returned public snapshot."],
  snapshotId,
};

export const report = {
  query: "camera & lighting",
  totalResults: 1234,
  totalResultsIsApproximate: true,
  snapshotId,
  retrievedAt: "2026-08-24T12:00:00.000Z",
  filters: { uploadDate: "any", duration: "any", sortBy: "relevance" },
  analytics: {
    totalViews: 1000,
    avgViews: 1000,
    medianViews: 1000,
    medianDailyViews: 50,
    totalEngagement: 110,
    avgEngagement: "11.00",
    totalVideos: 1,
    uniqueChannels: 1,
    viewsDistribution: [{ name: "A camera test", views: 1000, likes: 100 }],
    durationData: [{ name: "Under 4 min", value: 1 }, { name: "4 to 20 min", value: 0 }, { name: "Over 20 min", value: 0 }],
    recencyData: [{ name: "Last 7 days", value: 1 }, { name: "8-30 days", value: 0 }, { name: "1-12 months", value: 0 }, { name: "Over 1 year", value: 0 }],
    topVideo: null,
    topVideosList: [],
    velocityLeaders: [],
    breakoutLeaders: [],
    topTags: [{ label: "camera", count: 1 }],
    coverage: { views: 1, engagement: 1, subscribers: 1, captions: 1, tags: 1, hd: 1 },
  },
  videos: [{
    id: "video-1",
    title: "A camera test",
    channelTitle: "Test Channel",
    channelId: "channel-1",
    publishedAt: "2026-08-23T12:00:00.000Z",
    thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
    description: "A detailed camera comparison.",
    viewCount: 1000,
    likeCount: 100,
    commentCount: 10,
    duration: "PT3M",
    tags: ["camera"],
    hasCaptions: true,
    definition: "hd",
    channelStatistics: { hiddenSubscriberCount: false, subscriberCount: 500 },
  }],
  insights: {
    summary: "Comparison packaging is visible in this sample.",
    queryIntent: { primaryIntent: "Compare", viewerNeed: "Choose", discoverySurface: "Search", credibilityNote: "Public sample only." },
    evidenceSignals: { observed: ["Observed 1", "Observed 2", "Observed 3"], inferred: ["Inferred 1", "Inferred 2", "Inferred 3"], requiresStudio: ["Studio 1", "Studio 2", "Studio 3"] },
    evidenceClaims: Array.from({ length: 9 }, (_, index) => ({ ...claim, id: `claim-${index + 1}` })),
    peopleAlsoAsk: Array.from({ length: 6 }, (_, index) => ({ question: `Question ${index + 1}?`, answer: `Answer ${index + 1}.` })),
    targetAudience: { primaryDemographic: "Camera buyers", ageRange: "Unknown from public data", interests: ["Cameras"], painPoints: ["Low light"], contentPreferences: ["Comparisons"] },
    nicheAnalysis: { competitionLevel: "High", growthTrend: "Unverified", bestPostingTimes: ["Requires Studio"], recommendedFormats: ["Comparison"], monetizationPotential: "Hypothesis only" },
    contentGaps: ["Controlled tests"],
    trendingSubtopics: ["Low light"],
    recommendedActions: Array.from({ length: 3 }, (_, index) => ({ title: `Action ${index + 1}`, rationale: "Test one variable.", format: "Comparison" })),
    methodology: { sampleSize: 1, basis: "Public metadata", limitations: ["Small sample"] },
    snapshotId,
    generatedAt: "2026-08-24T12:01:00.000Z",
  },
  ideas: Array.from({ length: 6 }, (_, index) => ({
    title: `Idea ${index + 1}`,
    description: "A grounded comparison.",
    keywords: ["camera"],
    format: "Tutorial" as const,
    difficulty: "Advanced" as const,
    honestPromise: "Compare two setups.",
    discoverySurface: "search" as const,
    payoff: "A clear decision.",
    thumbnailConcept: "Two labeled frames.",
    studioMetric: "Thirty-second retention.",
    experimentRule: "Change one thumbnail variable.",
    evidenceClaims: [claim],
  })),
  provenance: { provider: "youtube-data-api-v3" as const, query: "camera & lighting", filters: { uploadDate: "any" as const, duration: "any" as const, sortBy: "relevance" as const, maxResults: 50 }, orderedVideoIds: ["video-1"] },
  enrichment: { search: { status: "complete" as const, requested: 1, returned: 1 }, videoDetails: { status: "complete" as const, requested: 1, returned: 1 }, channels: { status: "complete" as const, requested: 1, returned: 1 } },
  warnings: [],
} satisfies ResearchReportData;

const stressVideos = Array.from({ length: 50 }, (_, index) => ({
  ...report.videos[0],
  id: `video-${index + 1}`,
  title: `${index + 1}. A deliberately long camera and lighting comparison title that must wrap safely in every export surface`,
  channelId: `channel-${(index % 8) + 1}`,
  channelTitle: `Test Channel ${(index % 8) + 1}`,
  description: "This is a long public video description used to verify that report pagination never clips text or overlaps the next record. ".repeat(8),
  viewCount: 1000 + index * 250,
  likeCount: 100 + index,
  commentCount: 10 + index,
  tags: ["camera", "lighting", `test-${index + 1}`],
  channelStatistics: {
    hiddenSubscriberCount: false,
    subscriberCount: 500 + index * 20,
    videoCount: 100 + index,
    viewCount: 100_000 + index * 1_000,
    description: "A public channel description used for pagination QA. ".repeat(5),
    keywords: "camera lighting tutorial comparison",
  },
}));

export const stressReport = {
  ...report,
  totalResults: 50_000,
  videos: stressVideos,
  analytics: {
    ...report.analytics,
    totalViews: stressVideos.reduce((sum, video) => sum + video.viewCount, 0),
    avgViews: 7125,
    medianViews: 7125,
    medianDailyViews: 620,
    totalEngagement: stressVideos.reduce((sum, video) => sum + video.likeCount + video.commentCount, 0),
    avgEngagement: "4.25",
    totalVideos: 50,
    uniqueChannels: 8,
    viewsDistribution: stressVideos.slice(0, 6).map((video) => ({ name: video.title, views: video.viewCount, likes: video.likeCount })),
    durationData: [{ name: "Under 4 min", value: 20 }, { name: "4 to 20 min", value: 20 }, { name: "Over 20 min", value: 10 }],
    recencyData: [{ name: "Last 7 days", value: 12 }, { name: "8-30 days", value: 10 }, { name: "1-12 months", value: 18 }, { name: "Over 1 year", value: 10 }],
    topVideo: stressVideos[49],
    topVideosList: [...stressVideos].reverse().slice(0, 6),
    velocityLeaders: stressVideos.slice(0, 5).map((video, index) => ({ video, viewsPerDay: 1000 - index * 100 })),
    breakoutLeaders: stressVideos.slice(0, 5).map((video, index) => ({ video, viewsPerSubscriber: 8 - index * 0.5 })),
    topTags: [{ label: "camera", count: 50 }, { label: "lighting", count: 50 }],
    coverage: { views: 50, engagement: 50, subscribers: 50, captions: 50, tags: 50, hd: 50 },
  },
  insights: { ...report.insights, methodology: { ...report.insights.methodology, sampleSize: 50 } },
  provenance: { ...report.provenance, orderedVideoIds: stressVideos.map((video) => video.id) },
  enrichment: {
    search: { status: "complete" as const, requested: 50, returned: 50 },
    videoDetails: { status: "complete" as const, requested: 50, returned: 50 },
    channels: { status: "complete" as const, requested: 50, returned: 50 },
  },
} satisfies ResearchReportData;

describe("research export tables", () => {
  test("keeps all reader and audit sections in one normalized payload", () => {
    const tables = buildResearchExportTables(report);
    assert.deepEqual(tables.map((table) => table.name), [
      "Summary", "Overview", "Videos", "AI Insights", "Evidence", "Ideas", "Coverage & Sources",
    ]);
    assert.equal(tables.find((table) => table.name === "Videos")?.rows.length, 1);
    assert.equal(tables.find((table) => table.name === "Ideas")?.rows.length, 6);
  });

  test("creates an Excel workbook with one worksheet per report section", () => {
    const workbook = buildResearchXls(report);
    assert.equal((workbook.match(/<Worksheet ss:Name=/g) || []).length, 7);
    assert.match(workbook, /camera &amp; lighting/);
    assert.match(workbook, /Advanced/);
  });

  test("creates a complete long-form CSV without ambiguous sparse columns", () => {
    const csv = buildResearchCsv(report);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /"Table","Row","Field","Value"/);
    assert.match(csv, /"Videos","1","Description","A detailed camera comparison\."/);
    assert.match(csv, /"Ideas","1","Difficulty","Advanced"/);
  });

  test("builds a multi-page searchable PDF report from the same payload", () => {
    const pdf = buildResearchPDF(report);
    const bytes = pdf.output("arraybuffer");
    assert.ok(pdf.getNumberOfPages() >= 4);
    assert.ok(bytes.byteLength > 10_000);
  });

  test("paginates the maximum 50-video report without dropping detailed records", () => {
    const pdf = buildResearchPDF(stressReport);
    const bytes = pdf.output("arraybuffer");
    assert.ok(pdf.getNumberOfPages() >= 20);
    assert.ok(bytes.byteLength > 100_000);
  });
});
