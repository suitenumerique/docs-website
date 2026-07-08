# Docs — landing page

Static site for [Docs](https://github.com/suitenumerique/docs), the open-source collaborative document editor. Built with [Astro](https://astro.build) — no client-side JS framework, just Astro components compiling down to plain HTML/CSS, plus the small bit of vanilla `script.js` for nav/reveal-on-scroll behavior.

> This repo was built with the help of [Claude](https://claude.com/claude-code). Review changes accordingly.

## Pages

- `src/pages/index.astro` — homepage
- `src/pages/manifesto.astro` — manifesto
- `src/pages/roadmap.astro` — roadmap
- `src/pages/fosdem.astro` — FOSDEM talks

Shared chrome (nav, footer, `<head>`) lives in `src/components/Header.astro`, `src/components/Footer.astro`, and `src/layouts/Layout.astro`. The build is configured (`astro.config.mjs`, `build.format: 'file'`) to output flat files (`roadmap.html`, not `roadmap/index.html`), so every existing link/bookmark keeps working unchanged.

## Roadmap sync

The roadmap lists aren't hand-written — they're published live from [Docs](https://docs.numerique.gouv.fr) itself. The team maintains the actual roadmap as regular Docs documents (shared publicly), and this site pulls that content straight from Docs' own public API at **build time**. In other words: the landing page for Docs is itself a Docs user, dogfooding the product it's promoting as its editorial/publishing workflow for the roadmap.

`src/lib/roadmap.ts` fetches those documents via the public `formatted-content` API and parses them into structured items. `src/pages/roadmap.astro` and the homepage's roadmap teaser both render from that same data (via the shared `src/components/RoadmapItem.astro` component) — no duplication, no manual sync between the two.

This is fetched fresh on every build, not cached or committed — so content freshness is entirely a function of how often the site gets rebuilt (see below).

## Blog

Not live yet, but planned: it'll follow the same pattern as the roadmap (and as [we_make_commons-website](https://github.com/virgile-dev/we_make_commons-website)'s blog) — posts authored as Docs documents, fetched at build time via `src/lib/`, rendered through Astro pages. No separate CMS.

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
