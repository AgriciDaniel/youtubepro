import { jsPDF } from "jspdf";
import type { ResearchReportData } from "@/lib/research-export";
import { safeExportStem } from "@/lib/research-export";

const INK: [number, number, number] = [35, 35, 35];
const MUTED: [number, number, number] = [102, 102, 102];
const BORDER: [number, number, number] = [218, 218, 218];
const SURFACE: [number, number, number] = [247, 246, 244];
const PRIMARY: [number, number, number] = [185, 86, 63];
const PRIMARY_LIGHT: [number, number, number] = [243, 220, 213];
const BLUE: [number, number, number] = [102, 142, 181];
const TEAL: [number, number, number] = [92, 155, 145];
const GOLD: [number, number, number] = [204, 161, 85];
const PURPLE: [number, number, number] = [142, 118, 177];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : value;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).replace(/\s+/g, " ").trim();
}

interface TableColumn {
  label: string;
  width: number;
}

export function buildResearchPDF(data: ResearchReportData): jsPDF {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const contentBottom = pageHeight - 16;
  let y = 0;

  const drawPageHeader = (continuation = true) => {
    pdf.setFillColor(...PRIMARY);
    pdf.rect(0, 0, pageWidth, 4, "F");
    if (continuation) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text("YOUTUBE PRO  /  RESEARCH REPORT", margin, 11);
      pdf.setDrawColor(...BORDER);
      pdf.line(margin, 14, pageWidth - margin, 14);
      y = 21;
    } else {
      y = 16;
    }
  };

  const newPage = () => {
    pdf.addPage();
    drawPageHeader(true);
  };

  const ensure = (height: number) => {
    if (y + height > contentBottom) newPage();
  };

  const addWrapped = (
    value: unknown,
    options: {
      x?: number;
      width?: number;
      size?: number;
      lineHeight?: number;
      color?: [number, number, number];
      bold?: boolean;
      gapAfter?: number;
    } = {},
  ) => {
    const x = options.x ?? margin;
    const width = options.width ?? contentWidth;
    const size = options.size ?? 9;
    const lineHeight = options.lineHeight ?? 4.3;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? INK));
    const lines = pdf.splitTextToSize(text(value), width) as string[];
    for (const line of lines) {
      ensure(lineHeight + 1);
      pdf.text(line, x, y);
      y += lineHeight;
    }
    y += options.gapAfter ?? 1.5;
  };

  const addSection = (title: string, subtitle?: string) => {
    ensure(subtitle ? 24 : 16);
    y += 3;
    pdf.setFillColor(...PRIMARY_LIGHT);
    pdf.roundedRect(margin, y, 3, 9, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...INK);
    pdf.text(title, margin + 7, y + 6.5);
    y += 13;
    if (subtitle) addWrapped(subtitle, { size: 8.2, color: MUTED, gapAfter: 3 });
  };

  const addLabelValue = (label: string, value: unknown) => {
    ensure(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(label.toUpperCase(), margin, y);
    y += 4.5;
    addWrapped(value, { size: 9, gapAfter: 2.5 });
  };

  const addMetricCards = (metrics: { label: string; value: string; note: string }[]) => {
    const columns = 3;
    const gap = 3;
    const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
    const cardHeight = 24;
    metrics.forEach((metric, index) => {
      if (index % columns === 0) ensure(cardHeight + 3);
      const column = index % columns;
      const x = margin + column * (cardWidth + gap);
      pdf.setFillColor(...SURFACE);
      pdf.setDrawColor(...BORDER);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.2);
      pdf.setTextColor(...MUTED);
      pdf.text(metric.label, x + 3, y + 5);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...INK);
      pdf.text(metric.value, x + 3, y + 13);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...MUTED);
      const noteLines = pdf.splitTextToSize(metric.note, cardWidth - 6).slice(0, 2) as string[];
      noteLines.forEach((line, lineIndex) => pdf.text(line, x + 3, y + 18 + lineIndex * 3));
      if (column === columns - 1 || index === metrics.length - 1) y += cardHeight + 3;
    });
    y += 2;
  };

  const addBarChart = (
    title: string,
    rows: { label: string; value: number }[],
    note: string,
    colors: [number, number, number][] = [PRIMARY],
  ) => {
    if (rows.length === 0) return;
    const visibleRows = rows.slice(0, 8);
    const blockHeight = 17 + visibleRows.length * 9;
    ensure(blockHeight);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(margin, y, contentWidth, blockHeight, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...INK);
    pdf.text(title, margin + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...MUTED);
    pdf.text(note, margin + 4, y + 11);
    const max = Math.max(...visibleRows.map((row) => row.value), 1);
    const labelWidth = 62;
    const barX = margin + labelWidth + 5;
    const barMaxWidth = contentWidth - labelWidth - 26;
    visibleRows.forEach((row, index) => {
      const rowY = y + 18 + index * 9;
      const label = row.label.length > 38 ? `${row.label.slice(0, 37)}...` : row.label;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...INK);
      pdf.text(label, margin + 4, rowY);
      pdf.setFillColor(230, 229, 227);
      pdf.roundedRect(barX, rowY - 3.4, barMaxWidth, 4, 1, 1, "F");
      const barWidth = Math.max(row.value > 0 ? 1 : 0, (row.value / max) * barMaxWidth);
      pdf.setFillColor(...colors[index % colors.length]);
      pdf.roundedRect(barX, rowY - 3.4, barWidth, 4, 1, 1, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...INK);
      pdf.text(formatCompact(row.value), pageWidth - margin - 4, rowY, { align: "right" });
    });
    y += blockHeight + 5;
  };

  const addTable = (columns: TableColumn[], rows: unknown[][]) => {
    const rowPadding = 2;
    const lineHeight = 3.5;
    const drawHeader = () => {
      ensure(9);
      pdf.setFillColor(...PRIMARY);
      pdf.rect(margin, y, contentWidth, 8, "F");
      let x = margin;
      columns.forEach((column) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(255, 255, 255);
        pdf.text(column.label, x + rowPadding, y + 5.2);
        x += column.width;
      });
      y += 8;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const lineSets = columns.map((column, columnIndex) =>
        pdf.splitTextToSize(text(row[columnIndex]), column.width - rowPadding * 2) as string[],
      );
      const height = Math.max(8, Math.max(...lineSets.map((lines) => lines.length)) * lineHeight + rowPadding * 2);
      if (y + height > contentBottom) {
        newPage();
        drawHeader();
      }
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(...SURFACE);
        pdf.rect(margin, y, contentWidth, height, "F");
      }
      pdf.setDrawColor(...BORDER);
      pdf.line(margin, y + height, pageWidth - margin, y + height);
      let x = margin;
      lineSets.forEach((lines, columnIndex) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.7);
        pdf.setTextColor(...INK);
        lines.forEach((line, lineIndex) => pdf.text(line, x + rowPadding, y + rowPadding + 2.6 + lineIndex * lineHeight));
        x += columns[columnIndex].width;
      });
      y += height;
    });
    y += 5;
  };

  drawPageHeader(false);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(...INK);
  pdf.text("YouTube Research Report", margin, y + 7);
  y += 14;
  addWrapped(`Research snapshot for "${data.query}"`, { size: 11, color: MUTED, gapAfter: 2 });
  addWrapped(`Retrieved ${readableDate(data.retrievedAt)}  |  ${data.videos.length} returned videos  |  ${data.analytics.uniqueChannels} channels`, {
    size: 8,
    color: MUTED,
    gapAfter: 5,
  });

  addSection("Executive Summary");
  addWrapped(data.insights.summary, { size: 10, lineHeight: 5, gapAfter: 4 });
  addWrapped(`Viewer need: ${data.insights.queryIntent.viewerNeed}`, { size: 9, bold: true });
  addWrapped(`Credibility note: ${data.insights.queryIntent.credibilityNote}`, { size: 8.5, color: MUTED, gapAfter: 4 });

  addMetricCards([
    { label: "Sample views", value: formatCompact(data.analytics.totalViews), note: "Sum across returned videos" },
    { label: "Median views", value: formatCompact(data.analytics.medianViews), note: "Less distorted by viral outliers" },
    { label: "Median views per day", value: formatCompact(data.analytics.medianDailyViews), note: "Age-adjusted directional momentum" },
    { label: "Visible interaction rate", value: data.analytics.avgEngagement === "N/A" ? "N/A" : `${data.analytics.avgEngagement}%`, note: "Likes plus comments per covered view" },
    { label: "Average views", value: formatCompact(data.analytics.avgViews), note: "Use with median to assess skew" },
    { label: "Videos analyzed", value: formatNumber(data.analytics.totalVideos), note: "Maximum 50 per search call" },
  ]);

  addSection("Key Findings With Visual Evidence", "Public YouTube Data API metadata for this returned sample, not channel-owner Analytics.");
  addBarChart(
    "Top videos by views",
    data.analytics.topVideosList.map((video) => ({ label: video.title, value: video.viewCount || 0 })),
    "Absolute public views in the returned sample",
  );
  addBarChart(
    "Momentum leaders",
    data.analytics.velocityLeaders.map(({ video, viewsPerDay }) => ({ label: video.title, value: Math.round(viewsPerDay) })),
    "Views per day normalizes for video age; it is not real-time velocity",
    [BLUE],
  );
  addBarChart(
    "Breakout versus current subscribers",
    data.analytics.breakoutLeaders.map(({ video, viewsPerSubscriber }) => ({ label: video.title, value: Number(viewsPerSubscriber.toFixed(2)) })),
    "Uses current rounded public subscriber counts; it is directional, not publication-time performance",
    [PURPLE],
  );
  addBarChart(
    "Recurring public tags",
    data.analytics.topTags.map((item) => ({ label: item.label, value: item.count })),
    "Count of distinct returned videos using each available public tag",
    [GOLD],
  );
  addBarChart("Video duration distribution", data.analytics.durationData.map((item) => ({ label: item.name, value: item.value })), "Count of returned videos", [PRIMARY, BLUE, GOLD]);
  addBarChart("Publication recency", data.analytics.recencyData.map((item) => ({ label: item.name, value: item.value })), "Freshness mix, not proof of topic growth", [BLUE, TEAL, PURPLE, GOLD]);
  addBarChart(
    "Public data coverage",
    [
      { label: "Views", value: data.analytics.coverage.views },
      { label: "Complete engagement", value: data.analytics.coverage.engagement },
      { label: "Public subscribers", value: data.analytics.coverage.subscribers },
      { label: "Captions available", value: data.analytics.coverage.captions },
      { label: "Public tags", value: data.analytics.coverage.tags },
      { label: "HD definition", value: data.analytics.coverage.hd },
    ],
    `Covered records out of ${data.analytics.totalVideos}; unavailable fields are not converted to zero`,
    [TEAL],
  );

  addSection("Audience And Packaging Interpretation");
  addLabelValue("Primary intent", data.insights.queryIntent.primaryIntent);
  addLabelValue("Likely discovery surface", data.insights.queryIntent.discoverySurface);
  addLabelValue("Audience hypothesis", `${data.insights.targetAudience.primaryDemographic}. Age range hypothesis: ${data.insights.targetAudience.ageRange}.`);
  addLabelValue("Interests", data.insights.targetAudience.interests.join("; "));
  addLabelValue("Pain points", data.insights.targetAudience.painPoints.join("; "));
  addLabelValue("Content preferences", data.insights.targetAudience.contentPreferences.join("; "));
  addLabelValue("Competition", data.insights.nicheAnalysis.competitionLevel);
  addLabelValue("Growth interpretation", data.insights.nicheAnalysis.growthTrend);
  addLabelValue("Recommended formats", data.insights.nicheAnalysis.recommendedFormats.join("; "));
  addLabelValue("Monetization hypothesis", data.insights.nicheAnalysis.monetizationPotential);

  addSection("Content Opportunities And Packaging Inputs");
  addLabelValue("Content gaps", data.insights.contentGaps.map((value, index) => `${index + 1}. ${value}`).join("; "));
  addLabelValue("Subtopics", data.insights.trendingSubtopics.join("; "));
  addLabelValue("Posting-time hypotheses", data.insights.nicheAnalysis.bestPostingTimes.join("; "));

  addSection("Observed, Inferred, And Studio-Only Signals");
  ([
    ["Observed in this public sample", data.insights.evidenceSignals.observed],
    ["Inferred hypotheses", data.insights.evidenceSignals.inferred],
    ["Requires private YouTube Studio data", data.insights.evidenceSignals.requiresStudio],
  ] as const).forEach(([label, values]) => {
    addWrapped(label, { size: 9, bold: true, color: PRIMARY, gapAfter: 1 });
    values.forEach((value, index) => addWrapped(`${index + 1}. ${value}`, { size: 8.5, x: margin + 3, width: contentWidth - 3, gapAfter: 1.5 }));
    y += 2;
  });

  addSection("Recommended Next Steps");
  data.insights.recommendedActions.forEach((action, index) => {
    addWrapped(`${index + 1}. ${action.title}`, { size: 9.5, bold: true, gapAfter: 1 });
    addWrapped(`${action.rationale} Format: ${action.format}.`, { size: 8.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection("Further Questions");
  data.insights.peopleAlsoAsk.forEach((item, index) => {
    addWrapped(`${index + 1}. ${item.question}`, { size: 9, bold: true, gapAfter: 1 });
    addWrapped(item.answer, { size: 8.3, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection("Grounded Idea Packages", "Each package is tied to evidence claim IDs from this snapshot and includes a private-Studio validation rule.");
  data.ideas.forEach((idea, index) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    const titleLines = pdf.splitTextToSize(`${index + 1}. ${text(idea.title)}`, contentWidth - 6) as string[];
    const titleHeight = Math.max(8, titleLines.length * 4.2 + 4);
    ensure(titleHeight + 27);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(margin, y, contentWidth, titleHeight, 1.5, 1.5, "FD");
    pdf.setTextColor(...INK);
    titleLines.forEach((line, lineIndex) => pdf.text(line, margin + 3, y + 5.2 + lineIndex * 4.2));
    y += titleHeight + 4;
    addLabelValue("Package", `${idea.format}  |  ${idea.difficulty}  |  ${idea.discoverySurface}`);
    addLabelValue("Description", idea.description);
    addLabelValue("Keywords", idea.keywords.join(", "));
    addLabelValue("Honest promise", idea.honestPromise);
    addLabelValue("Payoff", idea.payoff);
    addLabelValue("Thumbnail concept", idea.thumbnailConcept);
    addLabelValue("Studio validation", `${idea.studioMetric} Experiment rule: ${idea.experimentRule}`);
    addLabelValue("Evidence claim IDs", idea.evidenceClaims.map((claim) => claim.id).join(", "));
    y += 3;
  });

  addSection("Evidence Ledger", "Observed claims cite source videos. Inferences and Studio-only checks remain labeled as such.");
  data.insights.evidenceClaims.forEach((claim, index) => {
    ensure(24);
    addWrapped(`${index + 1}. ${claim.id}  |  ${claim.evidenceClass.replace("_", " ")}  |  ${claim.confidence} confidence`, {
      size: 9,
      bold: true,
      color: PRIMARY,
      gapAfter: 1,
    });
    addWrapped(claim.claim, { size: 8.5, x: margin + 3, width: contentWidth - 3, gapAfter: 1 });
    addWrapped(`Sources: ${claim.sourceVideoIds.join(", ") || "N/A"}`, { size: 7.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 1 });
    addWrapped(`Limitations: ${claim.limitations.join("; ")}`, { size: 7.5, color: MUTED, x: margin + 3, width: contentWidth - 3, gapAfter: 3 });
  });

  addSection("Video Results Appendix", "Exact public values for the ordered source sample. Detailed descriptions and every available metadata field are included in the XLS and CSV exports.");
  addTable(
    [
      { label: "#", width: 8 },
      { label: "Video and channel", width: 85 },
      { label: "Published", width: 28 },
      { label: "Views", width: 22 },
      { label: "Likes / comments", width: 27 },
      { label: "Duration", width: 12 },
    ],
    data.videos.map((video, index) => [
      index + 1,
      `${video.title}\n${video.channelTitle}\nhttps://www.youtube.com/watch?v=${video.id}`,
      readableDate(video.publishedAt).replace(/, \d{1,2}:.*$/, ""),
      video.viewCount === undefined ? "N/A" : formatNumber(video.viewCount),
      `${video.likeCount === undefined ? "N/A" : formatNumber(video.likeCount)} / ${video.commentCount === undefined ? "N/A" : formatNumber(video.commentCount)}`,
      video.duration || "N/A",
    ]),
  );

  addSection("Detailed Video Metadata", "Complete public fields returned for each ordered source record. Missing values remain N/A.");
  data.videos.forEach((video, index) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    const headerLines = pdf.splitTextToSize(`${index + 1}. ${video.title}`, contentWidth - 6) as string[];
    const headerHeight = Math.max(8, headerLines.length * 4.2 + 4);
    ensure(headerHeight + 18);
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDER);
    pdf.roundedRect(margin, y, contentWidth, headerHeight, 1.5, 1.5, "FD");
    pdf.setTextColor(...INK);
    headerLines.forEach((line, lineIndex) => pdf.text(line, margin + 3, y + 5.2 + lineIndex * 4.2));
    y += headerHeight + 4;
    addLabelValue("Video identity", `Video ID: ${video.id}; URL: https://www.youtube.com/watch?v=${video.id}`);
    addLabelValue("Channel", `${video.channelTitle}; channel ID: ${video.channelId}`);
    addLabelValue("Published and duration", `${readableDate(video.publishedAt)}; duration: ${video.duration || "N/A"}`);
    addLabelValue("Public performance", `Views: ${text(video.viewCount)}; likes: ${text(video.likeCount)}; comments: ${text(video.commentCount)}`);
    addLabelValue("Content metadata", `Category: ${text(video.categoryId)}; live status: ${text(video.liveBroadcastContent)}; definition: ${text(video.definition)}; captions: ${text(video.hasCaptions)}; default language: ${text(video.defaultLanguage)}; audio language: ${text(video.defaultAudioLanguage)}`);
    addLabelValue("Public status fields", `Licensed: ${text(video.licensedContent)}; embeddable: ${text(video.embeddable)}; made for kids: ${text(video.madeForKids)}; paid product placement: ${text(video.hasPaidProductPlacement)}`);
    addLabelValue("Tags", video.tags?.join(", ") || "N/A");
    addLabelValue("Topic categories", video.topicCategories?.join("; ") || "N/A");
    addLabelValue("Live details", video.liveStreamingDetails
      ? Object.entries(video.liveStreamingDetails).map(([key, value]) => `${key}: ${text(value)}`).join("; ")
      : "N/A");
    addLabelValue("Video description", video.description || "N/A");
    addLabelValue("Thumbnail", video.thumbnailUrl);
    const channel = video.channelStatistics;
    addLabelValue("Channel statistics", channel
      ? `Subscribers: ${text(channel.subscriberCount)}; hidden subscribers: ${text(channel.hiddenSubscriberCount)}; videos: ${text(channel.videoCount)}; views: ${text(channel.viewCount)}; published: ${text(channel.publishedAt)}; country: ${text(channel.country)}; custom URL: ${text(channel.customUrl)}; default language: ${text(channel.defaultLanguage)}`
      : "N/A");
    addLabelValue("Channel keywords", channel?.keywords || "N/A");
    addLabelValue("Channel topic categories", channel?.topicCategories?.join("; ") || "N/A");
    addLabelValue("Channel description", channel?.description || "N/A");
    addLabelValue("Channel thumbnail", channel?.thumbnailUrl || "N/A");
    y += 5;
  });

  addSection("Caveats, Coverage, And Source Context");
  addLabelValue("Method", data.insights.methodology.basis);
  addLabelValue("Sample", `${data.insights.methodology.sampleSize} returned videos. YouTube's estimated match count was ${formatNumber(data.totalResults)}${data.totalResultsIsApproximate ? " and is approximate" : ""}.`);
  data.insights.methodology.limitations.forEach((limitation, index) => addWrapped(`${index + 1}. ${limitation}`, { size: 8.5, gapAfter: 2 }));
  addLabelValue("Provider", data.provenance.provider);
  addLabelValue("Filters", `Upload date: ${data.filters.uploadDate}; duration: ${data.filters.duration}; sort: ${data.filters.sortBy}.`);
  addLabelValue("Snapshot ID", data.snapshotId);
  addLabelValue("Search response", `Results per page: ${text(data.resultsPerPage)}; region code: ${text(data.regionCode)}; next-page token: ${text(data.nextPageToken)}`);
  addLabelValue("Enrichment", Object.entries(data.enrichment).map(([stage, detail]) => `${stage}: ${detail.status} (${detail.returned}/${detail.requested})`).join("; "));
  if (data.warnings.length > 0) {
    data.warnings.forEach((warning, index) => addWrapped(`${index + 1}. ${warning.stage}: ${warning.message}`, { size: 8.5, color: MUTED, gapAfter: 2 }));
  } else {
    addWrapped("No provider enrichment warnings were reported for this snapshot.", { size: 8.5, color: MUTED });
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text("Public YouTube metadata plus labeled AI interpretation", margin, pageHeight - 7);
    pdf.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  return pdf;
}

export async function generateResearchPDF(data: ResearchReportData): Promise<void> {
  buildResearchPDF(data).save(`youtube-research-${safeExportStem(data.query)}.pdf`);
}
