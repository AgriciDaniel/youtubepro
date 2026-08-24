# YouTube Pro launch-video package

This folder contains the production-ready materials for an approximately five-minute private-preview video.

## Files

- [`five-minute-script.md`](five-minute-script.md): Teleprompter-ready narration, timing, title, CTA, and thumbnail recommendation.
- [`presentation.html`](presentation.html): Seven-slide local presentation. Use Left Arrow, Right Arrow, Page Up, Page Down, Space, Home, or End to navigate.
- [`presentation-outline.md`](presentation-outline.md): Slide-by-slide content, speaker notes, visual direction, and a Canva generation brief.
- [`shot-list.md`](shot-list.md): Recording plan, demo-data guidance, public-claim guardrails, and pre-publish review.
- [`youtube-package.md`](youtube-package.md): Title, thumbnail direction, description, chapters, pinned comment, and restrained tags.

## Open the presentation

Open `presentation.html` directly in a browser, or serve the repository locally:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/docs/launch-video/presentation.html
```

Use the browser print dialog to export the slides to PDF. Enable background graphics and use landscape orientation.

## Recommended production sequence

1. Read the script aloud once and mark words that do not sound natural in your voice.
2. Prepare a narrow, pre-reviewed research workflow in a dedicated browser profile.
3. Record the complete product flow using the shot list.
4. Record narration separately with the final screen timing visible.
5. Add presentation slides only at the hook, problem, evidence model, and close.
6. Run the pre-publish review before describing the project as publicly available or open source.

## Current release boundary

The repository is private and no open-source license has been selected. The current video should say **private preview**, **upcoming project**, or **preparing for a wider release**. Update the CTA only after the repository, license, and release status change.
