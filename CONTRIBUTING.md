# Contributing to YouTube Pro

YouTube Pro is currently under private review. Contributions should preserve the continuous workflow from Research to Insights to Ideas to Script Writer to Thumbnail Creator.

## Local setup

1. Install Node.js 20.19 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and add your own provider keys, or configure them through the local Settings page.
4. Run `npm run dev` and open `http://127.0.0.1:5000`.

Never commit `.env`, provider keys, generated private data, or exports containing private channel information.

## Required checks

Run all checks before opening a pull request:

```bash
npm test
npm run check
npm run build
```

The automated suite uses fixtures and mocks. It must not spend YouTube or Gemini quota.

## Pull requests

- Keep each change focused and explain its user-facing effect.
- Preserve snapshot IDs and source-video evidence through the Research, Insights, Ideas, and Script stages.
- Keep provider credentials and paid calls on the server.
- Add or update focused tests when changing request contracts, provider behavior, evidence rules, exports, or security boundaries.
- Include screenshots for meaningful interface changes in both dark and light themes when practical.
- State which checks were run and any acceptance work that remains.

## Public release boundary

No open-source license has been selected. Do not copy or redistribute the repository outside the approved private organization until a license and public release are explicitly approved.
