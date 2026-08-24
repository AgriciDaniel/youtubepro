import type {
  IdeaPackage,
  ResearchInsightsResponse,
  SearchResponse,
  Video,
} from "@shared/schema";
import type { calculateYouTubeAnalytics } from "@/lib/youtube-analytics";

export type ResearchAnalytics = ReturnType<typeof calculateYouTubeAnalytics>;

export interface ResearchReportData {
  query: string;
  totalResults: number;
  totalResultsIsApproximate: boolean;
  resultsPerPage?: number;
  regionCode?: string;
  nextPageToken?: string;
  snapshotId: string;
  retrievedAt: string;
  filters: {
    uploadDate: string;
    duration: string;
    sortBy: string;
  };
  analytics: ResearchAnalytics;
  videos: Video[];
  insights: ResearchInsightsResponse;
  ideas: IdeaPackage[];
  provenance: SearchResponse["provenance"];
  enrichment: SearchResponse["enrichment"];
  warnings: SearchResponse["warnings"];
}

type Cell = string | number | boolean | null | undefined;

interface ExportTable {
  name: string;
  columns: string[];
  rows: Cell[][];
}

function readable(value: Cell): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function joined(values?: readonly string[]): string {
  return values && values.length > 0 ? values.join(" | ") : "N/A";
}

function videoInteractionRate(video: Video): string {
  if (!video.viewCount || video.likeCount === undefined || video.commentCount === undefined) return "N/A";
  return `${(((video.likeCount + video.commentCount) / video.viewCount) * 100).toFixed(2)}%`;
}

export function safeExportStem(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "research";
}

export function buildResearchExportTables(data: ResearchReportData): ExportTable[] {
  const { analytics, insights } = data;
  const summary: ExportTable = {
    name: "Summary",
    columns: ["Field", "Value"],
    rows: [
      ["Report", "YouTube Research Report"],
      ["Query", data.query],
      ["Retrieved", data.retrievedAt],
      ["Snapshot ID", data.snapshotId],
      ["Estimated matching results", data.totalResults],
      ["Result count is approximate", data.totalResultsIsApproximate],
      ["Results per page", data.resultsPerPage],
      ["Region code", data.regionCode],
      ["Next-page token", data.nextPageToken],
      ["Videos analyzed", analytics.totalVideos],
      ["Unique channels", analytics.uniqueChannels],
      ["Sample views", analytics.totalViews],
      ["Average views", analytics.avgViews],
      ["Median views", analytics.medianViews],
      ["Median views per day", analytics.medianDailyViews],
      ["Visible interaction rate", analytics.avgEngagement === "N/A" ? "N/A" : `${analytics.avgEngagement}%`],
      ["Upload-date filter", data.filters.uploadDate],
      ["Duration filter", data.filters.duration],
      ["Sort order", data.filters.sortBy],
      ["Executive summary", insights.summary],
    ],
  };

  const overview: ExportTable = {
    name: "Overview",
    columns: ["Section", "Label", "Value", "Definition"],
    rows: [
      ...analytics.durationData.map((item) => ["Duration distribution", item.name, item.value, "Returned videos"]),
      ...analytics.recencyData.map((item) => ["Publication recency", item.name, item.value, "Returned videos"]),
      ...analytics.topTags.map((item) => ["Recurring tags", item.label, item.count, "Distinct returned videos using the public tag"]),
      ["Data coverage", "Views", analytics.coverage.views, `of ${analytics.totalVideos}`],
      ["Data coverage", "Complete engagement", analytics.coverage.engagement, `of ${analytics.totalVideos}`],
      ["Data coverage", "Public subscribers", analytics.coverage.subscribers, `of ${analytics.totalVideos}`],
      ["Data coverage", "Captions available", analytics.coverage.captions, `of ${analytics.totalVideos}`],
      ["Data coverage", "Public tags", analytics.coverage.tags, `of ${analytics.totalVideos}`],
      ["Data coverage", "HD definition", analytics.coverage.hd, `of ${analytics.totalVideos}`],
      ...analytics.velocityLeaders.map(({ video, viewsPerDay }, index) => [
        "Momentum leaders",
        `${index + 1}. ${video.title}`,
        Math.round(viewsPerDay),
        "Age-adjusted views per day, not real-time velocity",
      ]),
      ...analytics.breakoutLeaders.map(({ video, viewsPerSubscriber }, index) => [
        "Breakout versus subscribers",
        `${index + 1}. ${video.title}`,
        Number(viewsPerSubscriber.toFixed(2)),
        "Views divided by current rounded public subscriber count",
      ]),
    ],
  };

  const videos: ExportTable = {
    name: "Videos",
    columns: [
      "Rank", "Video ID", "Title", "Channel", "Channel ID", "Published", "Duration",
      "Views", "Likes", "Comments", "Visible interaction rate", "Tags", "Category ID",
      "Live status", "Captions", "Definition", "Licensed content", "Embeddable",
      "Made for kids", "Paid product placement", "Default language", "Audio language",
      "Topic categories", "Live actual start", "Live actual end", "Live scheduled start",
      "Live concurrent viewers", "Channel subscribers", "Subscribers hidden", "Channel videos",
      "Channel views", "Channel published", "Channel country", "Channel custom URL",
      "Channel default language", "Channel keywords", "Channel topic categories",
      "Channel thumbnail URL", "Channel description", "Thumbnail URL", "YouTube URL", "Description",
    ],
    rows: data.videos.map((video, index) => [
      index + 1,
      video.id,
      video.title,
      video.channelTitle,
      video.channelId,
      video.publishedAt,
      video.duration,
      video.viewCount,
      video.likeCount,
      video.commentCount,
      videoInteractionRate(video),
      joined(video.tags),
      video.categoryId,
      video.liveBroadcastContent,
      video.hasCaptions,
      video.definition,
      video.licensedContent,
      video.embeddable,
      video.madeForKids,
      video.hasPaidProductPlacement,
      video.defaultLanguage,
      video.defaultAudioLanguage,
      joined(video.topicCategories),
      video.liveStreamingDetails?.actualStartTime,
      video.liveStreamingDetails?.actualEndTime,
      video.liveStreamingDetails?.scheduledStartTime,
      video.liveStreamingDetails?.concurrentViewers,
      video.channelStatistics?.subscriberCount,
      video.channelStatistics?.hiddenSubscriberCount,
      video.channelStatistics?.videoCount,
      video.channelStatistics?.viewCount,
      video.channelStatistics?.publishedAt,
      video.channelStatistics?.country,
      video.channelStatistics?.customUrl,
      video.channelStatistics?.defaultLanguage,
      video.channelStatistics?.keywords,
      joined(video.channelStatistics?.topicCategories),
      video.channelStatistics?.thumbnailUrl,
      video.channelStatistics?.description,
      video.thumbnailUrl,
      `https://www.youtube.com/watch?v=${video.id}`,
      video.description,
    ]),
  };

  const aiInsights: ExportTable = {
    name: "AI Insights",
    columns: ["Section", "Item", "Detail"],
    rows: [
      ["Executive Summary", "Summary", insights.summary],
      ["Query Intent", "Primary intent", insights.queryIntent.primaryIntent],
      ["Query Intent", "Viewer need", insights.queryIntent.viewerNeed],
      ["Query Intent", "Discovery surface", insights.queryIntent.discoverySurface],
      ["Query Intent", "Credibility note", insights.queryIntent.credibilityNote],
      ...insights.evidenceSignals.observed.map((value, index) => ["Evidence Signals", `Observed ${index + 1}`, value]),
      ...insights.evidenceSignals.inferred.map((value, index) => ["Evidence Signals", `Inferred ${index + 1}`, value]),
      ...insights.evidenceSignals.requiresStudio.map((value, index) => ["Evidence Signals", `Requires Studio ${index + 1}`, value]),
      ...insights.peopleAlsoAsk.flatMap((item, index) => [
        ["Viewer Questions", `Question ${index + 1}`, item.question],
        ["Viewer Questions", `Answer ${index + 1}`, item.answer],
      ]),
      ["Audience", "Primary demographic hypothesis", insights.targetAudience.primaryDemographic],
      ["Audience", "Age-range hypothesis", insights.targetAudience.ageRange],
      ["Audience", "Interests", joined(insights.targetAudience.interests)],
      ["Audience", "Pain points", joined(insights.targetAudience.painPoints)],
      ["Audience", "Content preferences", joined(insights.targetAudience.contentPreferences)],
      ["Niche", "Competition level", insights.nicheAnalysis.competitionLevel],
      ["Niche", "Growth trend", insights.nicheAnalysis.growthTrend],
      ["Niche", "Posting-time hypotheses", joined(insights.nicheAnalysis.bestPostingTimes)],
      ["Niche", "Recommended formats", joined(insights.nicheAnalysis.recommendedFormats)],
      ["Niche", "Monetization hypothesis", insights.nicheAnalysis.monetizationPotential],
      ...insights.contentGaps.map((value, index) => ["Content Gaps", `Gap ${index + 1}`, value]),
      ...insights.trendingSubtopics.map((value, index) => ["Subtopics", `Subtopic ${index + 1}`, value]),
      ...insights.recommendedActions.flatMap((item, index) => [
        ["Recommended Actions", `Action ${index + 1}`, item.title],
        ["Recommended Actions", `Rationale ${index + 1}`, item.rationale],
        ["Recommended Actions", `Format ${index + 1}`, item.format],
      ]),
      ["Methodology", "Sample size", insights.methodology.sampleSize],
      ["Methodology", "Basis", insights.methodology.basis],
      ...insights.methodology.limitations.map((value, index) => ["Methodology", `Limitation ${index + 1}`, value]),
    ],
  };

  const evidence: ExportTable = {
    name: "Evidence",
    columns: ["ID", "Class", "Claim", "Confidence", "Source video IDs", "Limitations", "Snapshot ID"],
    rows: insights.evidenceClaims.map((claim) => [
      claim.id,
      claim.evidenceClass,
      claim.claim,
      claim.confidence,
      joined(claim.sourceVideoIds),
      joined(claim.limitations),
      claim.snapshotId,
    ]),
  };

  const ideas: ExportTable = {
    name: "Ideas",
    columns: [
      "Idea", "Title", "Description", "Keywords", "Format", "Difficulty", "Discovery surface",
      "Honest promise", "Payoff", "Thumbnail concept", "Studio metric", "Experiment rule",
      "Evidence claim IDs", "Source video IDs",
    ],
    rows: data.ideas.map((idea, index) => [
      index + 1,
      idea.title,
      idea.description,
      joined(idea.keywords),
      idea.format,
      idea.difficulty,
      idea.discoverySurface,
      idea.honestPromise,
      idea.payoff,
      idea.thumbnailConcept,
      idea.studioMetric,
      idea.experimentRule,
      joined(idea.evidenceClaims.map((claim) => claim.id)),
      joined(Array.from(new Set(idea.evidenceClaims.flatMap((claim) => claim.sourceVideoIds)))),
    ]),
  };

  const provenance: ExportTable = {
    name: "Coverage & Sources",
    columns: ["Section", "Field", "Value"],
    rows: [
      ["Provenance", "Provider", data.provenance.provider],
      ["Provenance", "Query", data.provenance.query],
      ["Provenance", "Ordered video IDs", joined(data.provenance.orderedVideoIds)],
      ...Object.entries(data.enrichment).flatMap(([stage, detail]) => [
        ["Enrichment", `${stage} status`, detail.status],
        ["Enrichment", `${stage} requested`, detail.requested],
        ["Enrichment", `${stage} returned`, detail.returned],
      ]),
      ...data.warnings.map((warning, index) => [
        "Warnings",
        `${index + 1}. ${warning.code}`,
        `${warning.stage}: ${warning.message}`,
      ]),
    ],
  };

  return [summary, overview, videos, aiInsights, evidence, ideas, provenance];
}

function csvCell(value: Cell): string {
  const text = readable(value).replace(/\r?\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildResearchCsv(data: ResearchReportData): string {
  const rows: Cell[][] = [["Table", "Row", "Field", "Value"]];
  for (const table of buildResearchExportTables(data)) {
    table.rows.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        rows.push([table.name, rowIndex + 1, table.columns[columnIndex], readable(value)]);
      });
    });
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function xml(value: Cell): string {
  return readable(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlCell(value: Cell, header = false): string {
  const numeric = typeof value === "number" && Number.isFinite(value);
  const style = header ? ' ss:StyleID="Header"' : "";
  return `<Cell${style}><Data ss:Type="${numeric ? "Number" : "String"}">${xml(value)}</Data></Cell>`;
}

export function buildResearchXls(data: ResearchReportData): string {
  const worksheets = buildResearchExportTables(data).map((table) => {
    const header = `<Row>${table.columns.map((column) => xmlCell(column, true)).join("")}</Row>`;
    const rows = table.rows.map((row) => `<Row>${row.map((value) => xmlCell(value)).join("")}</Row>`).join("");
    const columns = table.columns.map((column, index) => {
      const longest = Math.max(column.length, ...table.rows.slice(0, 100).map((row) => readable(row[index]).length));
      return `<Column ss:AutoFitWidth="0" ss:Width="${Math.min(320, Math.max(70, longest * 6))}"/>`;
    }).join("");
    return `<Worksheet ss:Name="${xml(table.name.slice(0, 31))}"><Table>${columns}${header}${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#B9563F" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style></Styles>${worksheets}</Workbook>`;
}

function download(contents: BlobPart, mime: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadResearchCsv(data: ResearchReportData): void {
  download(
    buildResearchCsv(data),
    "text/csv;charset=utf-8",
    `youtube-research-${safeExportStem(data.query)}.csv`,
  );
}

export function downloadResearchXls(data: ResearchReportData): void {
  download(
    buildResearchXls(data),
    "application/vnd.ms-excel;charset=utf-8",
    `youtube-research-${safeExportStem(data.query)}.xls`,
  );
}
