# Release notes

## 2026-08-24: Restorable local workflows and refreshed research experience

This update makes YouTube Pro easier to leave and resume. Research, generated ideas, scripts, and thumbnail work now stay grouped as local workflows, while the research brief presents dense AI output in a more visual, scan-first format.

### Added

- **Recent workflows:** The sidebar lists the eight most recently updated projects and reopens the last useful Research, Script Writer, or Thumbnail Creator step.
- **Browser-local persistence:** Research snapshots, AI Insights, grounded ideas, script output and revisions, thumbnail briefs, and generated thumbnail results are stored in IndexedDB.
- **Independent projects:** **New Workflow** starts a fresh project without replacing earlier work in the recent-workflow list.
- **Workflow helper tests:** Shared title, ordering, deduplication, and history-limit behavior now have focused automated coverage.

### Improved

- **Research readability:** AI Insights use compact visual summaries, expandable findings, opportunity cards, and collapsed evidence and methodology details.
- **Evidence clarity:** Observed findings, inferred recommendations, and metrics that require channel-owner YouTube Studio data remain visibly separated.
- **Resume behavior:** Research results are saved as soon as the public-data snapshot returns, then enriched again when AI Insights and grounded ideas finish.
- **Script Writer:** Generated output, supporting metadata, form inputs, and user revisions restore with the selected workflow.
- **Thumbnail Creator:** The brief, advanced visual controls, generated image, and model information restore with the selected workflow.
- **Navigation:** Opening a saved workflow returns to the most useful completed step instead of an empty route.

### Documentation

- Replaced the product-tour captures with five current screenshots covering Research analytics, Source Videos, AI Insights, the Script teleprompter, and Thumbnail Creator.
- Expanded the README with workflow-history behavior, local-storage boundaries, and restoration details.

### Privacy and storage boundaries

- Workflow history remains in the current browser profile. It is not synchronized to a server or another device.
- API keys remain server-side and are not written into workflow history.
- Uploaded thumbnail reference images are not retained. Users must select them again for a later generation.
- Research continues to use public YouTube Data API metadata. Owner-only metrics such as impressions, click-through rate, traffic sources, and retention require YouTube Studio and are not inferred as public facts.

### Verification

- `npm test`: 61 tests passed
- `npm run check`: TypeScript check passed
- `npm run build`: Production client and server builds completed
- README image-reference and source-image checksum checks passed
