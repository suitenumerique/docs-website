# Docs — landing page

Static site for [Docs](https://github.com/suitenumerique/docs), the open-source collaborative document editor. Built with [Astro](https://astro.build) — no client-side JS framework, just Astro components compiling down to plain HTML/CSS, plus the small bit of vanilla `script.js` for nav/reveal-on-scroll behavior.

> This repo was built with the help of [Claude](https://claude.com/claude-code). Review changes accordingly.

## Pages

- `src/pages/index.astro` — homepage
- `src/pages/manifesto.astro` — manifesto
- `src/pages/roadmap.astro` — roadmap
- `src/pages/community-calls.astro` — community calls
- `src/pages/fosdem.astro` — FOSDEM talks

Shared chrome (nav, footer, `<head>`) lives in `src/components/Header.astro`, `src/components/Footer.astro`, and `src/layouts/Layout.astro`. The build is configured (`astro.config.mjs`, `build.format: 'file'`) to output flat files (`roadmap.html`, not `roadmap/index.html`), so every existing link/bookmark keeps working unchanged.

## Content from Docs

Most of this site's editorial content isn't hard-coded — it's fetched and laid out directly from public [Docs](https://docs.numerique.gouv.fr) documents at **build time**, via Docs' own public `formatted-content` API. The team authors the roadmap, the manifesto, and community call recaps as regular Docs documents (shared publicly), and this site pulls that content straight in. In other words: the landing page for Docs is itself a Docs user, dogfooding the product it's promoting as its editorial/publishing workflow.

That gets us real flexibility on the publishing side: updating a roadmap item, tweaking the manifesto, or posting a community call recap is just editing a Docs document — no PR, no manual redeploy, no separate CMS.

Each `src/lib/*.ts` file (`roadmap.ts`, `manifesto.ts`, `community-calls.ts`) fetches its source document(s) via the public API and parses them into structured data or ready-to-render HTML; the corresponding `src/pages/*.astro` files render from that data, sharing components where it makes sense (e.g. `src/components/RoadmapItem.astro`, used by both `roadmap.astro` and the homepage's roadmap teaser) — no duplication, no manual sync.

Content is fetched fresh on every build, never cached or committed — so freshness is entirely a function of how often the site gets rebuilt (see Deployment below). A blog, were we to add one, would follow the exact same pattern (and as [we_make_commons-website](https://github.com/virgile-dev/we_make_commons-website)'s blog already does): posts authored as Docs documents, fetched at build time, rendered through Astro pages.

## Deployment

`.github/workflows/deploy.yml` runs `npm run build` on push to `main`, on a schedule (every 6 hours), and on manual dispatch, then deploys `dist/` as a GitHub Actions Pages artifact. Nothing fetched at build time is ever committed back to git — the scheduled rebuild is what keeps the roadmap current.

This means **GitHub Pages must be set to deploy from "GitHub Actions"** (repo Settings → Pages → Source), not from the `main` branch.

## Running locally

```
npm install
npm run dev
```

Then open `http://localhost:4321`. This fetches live roadmap content on every request in dev mode, same as production builds.

To build and preview the production output:

```
npm run build
npm run preview
```

## Contributing

This repo is just the landing page. If you want to make a bigger impact, consider contributing directly to:

- [Docs](https://github.com/suitenumerique/docs) — the product itself
- [Yjs](https://github.com/yjs/yjs) — the CRDT engine Docs is built on
- [BlockNote](https://github.com/TypeCellOS/BlockNote) — the editor framework Docs is built on

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute to this site.

## License

MIT — see [LICENSE](LICENSE).
