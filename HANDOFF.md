# Maintainer Handoff

Read `README.md` first. It describes the current product, local-first access model, exact input limits, and verification commands.

## Current product map

- `client/src/pages/research.tsx`: continuous Research workspace containing overview, analytics, all returned videos, snapshot-bound AI Insights, and automatically generated grounded Ideas.
- `client/src/pages/script.tsx`: selected-Idea handoff, full script generation, editing, and grounded section or paragraph regeneration.
- `client/src/pages/thumbnail.tsx`: step-based Thumbnail Creator with server-selected image model, editable visual controls, validated reference images, and download state.
- `client/src/pages/settings.tsx`: local provider status, replacement keys, and model selection.
- `client/src/lib/workflow-context.tsx`: Research to Script to Thumbnail continuity.
- `server/youtube.ts`: YouTube search, enrichment, provenance, partial-stage warnings, and deterministic snapshot identity.
- `server/gemini.ts`: active Gemini text and image operations.
- `server/routes.ts`: API surface and in-memory rate limiting.
- `server/settings.ts`: local-only Settings policy and owner-only `.env` writes.
- `shared/schema.ts` and `shared/evidence-contracts.ts`: public request, response, and evidence contracts.

## Standing boundaries

- Preserve the snapshot and evidence contracts through Research, Ideas, and Script.
- Never return API keys to the browser or log request or response bodies.
- Keep Settings local-only unless a separately authenticated remote secret-management design is implemented.
- The retired login, initial password, Thumbnail unlock, Pro Script Studio, legacy Replit AI proxy, and database/session stack are not part of this product.
- Do not add a license until the owner selects one.
- Do not make live provider calls during automated verification.

## Verification

```bash
npm test
npm run check
npm run build
```

Paid-provider behavior still needs an explicit live-key acceptance pass. Keep that distinct from contract tests and production build success.
