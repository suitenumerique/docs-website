// The roadmap lists are authored by the team as regular Docs documents
// (shared publicly) and fetched here at build time via the public,
// unauthenticated `formatted-content` API of a Docs instance — see
// https://docs.numerique.gouv.fr. Docs is dogfooding itself as the
// publishing workflow for its own roadmap.

const DOCUMENT_URL = 'https://docs.numerique.gouv.fr/api/v1.0/documents/';
const MARKDOWN_URL = (docId: string) =>
  `${DOCUMENT_URL}${docId}/formatted-content/?content_format=markdown`;
const HTML_URL = (docId: string) =>
  `${DOCUMENT_URL}${docId}/formatted-content/?content_format=html`;
const CHILDREN_URL = (docId: string) => `${DOCUMENT_URL}${docId}/children/`;

export const ROADMAP_SOURCES = {
  planned: '1e2a0b10-bc55-4b47-94f6-6b854acc3050',
  s1_2026: '924009cb-7ee7-4b18-b872-a351e5f6d33c',
  y2025: '9e10fa80-7fbc-412b-a3c3-2bf19ef5d17a',
} as const;

// Parent document listing the above as children — its own content (intro,
// dependencies, "looking for funding" list) is rendered on /roadmap, and
// each child becomes a /roadmap/<slug> subpage.
export const ROADMAP_ROOT_ID = 'd1d3788e-c619-41ff-abe8-2d079da2f084';

const FUNDER_ABBREVIATIONS: Record<string, string> = {
  'European Commission': 'EC',
};

const FLAG_RE = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export interface RoadmapItem {
  titlePrefix: string;
  titleEmphasis: string;
  statusText: string | null;
  statusClass: 'planned' | 'shipped' | null;
  funders: string[];
  links: { label: string; url: string }[];
  depHtml: string | null;
  description: string | null;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTitle(rawTitle: string): { prefix: string; emphasis: string } {
  const title = rawTitle.trim();
  const idx = title.indexOf('✨');
  if (idx === -1) return { prefix: title, emphasis: '' };
  return {
    prefix: title.slice(0, idx).trim(),
    emphasis: title.slice(idx + 1).trim(),
  };
}

function parseFunders(text: string): string[] {
  const tokens = text.trim().split(/,\s*|\s+and\s+/);
  const pills: string[] = [];
  for (let token of tokens) {
    token = token.replace(/^and\s+/i, '').trim();
    if (!token || token === '?') continue;
    const flagMatch = token.match(FLAG_RE);
    const flag = flagMatch ? flagMatch[0] : '';
    let name = token.replace(FLAG_RE, '').trim();
    name = FUNDER_ABBREVIATIONS[name] ?? name;
    pills.push(`${flag} ${name}`.trim());
  }
  return pills;
}

function parseStatus(segment: string): { cssClass: 'planned' | 'shipped'; text: string } {
  // Anything that isn't explicitly shipped (✅) is treated as "planned" —
  // this also covers newer statuses like "To be confirmed `?`" or
  // "🌀 : `in beta`" that don't say the word "Planned" or use 🌀.
  const isPlanned = !segment.includes('✅');
  const codeMatch = segment.match(/`([^`]*)`/);
  const codeRaw = codeMatch ? codeMatch[1] : '';
  const codeClean = codeRaw.replace(/[✅\u{1F300}]/gu, '').trim();
  const codeDisplay = codeClean === '?' ? 'TBD' : codeClean;

  let rest = segment;
  if (codeMatch) rest = rest.replace(codeMatch[0], '');
  rest = rest.replace(/Planned:?/, '').replace(/To be confirmed:?/, '');
  rest = rest.replace(/✅/g, '').replace(/\u{1F300}/gu, '');
  const extra = rest.replace(/^[\s|:]+|[\s|:]+$/g, '').trim();

  const label = isPlanned ? 'Planned' : 'Shipped';
  let text = `${label} · ${codeDisplay}`;
  if (extra) text += ` ${extra}`;
  return { cssClass: isPlanned ? 'planned' : 'shipped', text };
}

function resolveOtherLabel(segment: string, matchIndex: number, label: string): string {
  if (label.toLowerCase() === 'link') {
    let preceding = segment.slice(0, matchIndex);
    preceding = preceding.split('|').pop() ?? '';
    preceding = preceding.trim().replace(/\($/, '').trim();
    if (preceding) return preceding;
  }
  return label.replace(/^[^\w]+/, '').trim();
}

function parseLinks(
  segment: string,
  prLinks: { num: string; url: string }[],
  otherLinks: { label: string; url: string }[]
) {
  for (const match of segment.matchAll(MD_LINK_RE)) {
    const [, label, url] = match;
    const pullMatch = url.match(/\/pull\/(\d+)/);
    const issueMatch = url.match(/\/issues\/(\d+)/);
    if (pullMatch) {
      prLinks.push({ num: pullMatch[1], url });
    } else if (issueMatch) {
      otherLinks.push({ label: `Issue #${issueMatch[1]}`, url });
    } else {
      otherLinks.push({ label: resolveOtherLabel(segment, match.index ?? 0, label), url });
    }
  }
}

function isLinkOnlyLine(line: string): boolean {
  let remainder = line.replace(MD_LINK_RE, '');
  remainder = remainder.replace(/\band\b/gi, '');
  remainder = remainder.replace(/[^\w]/g, '');
  return remainder === '';
}

function parseItem(title: string, body: string): RoadmapItem {
  const lines = body
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const metaLineIdx = lines.findIndex((l) => l.includes('Funded by:'));

  let status: { cssClass: 'planned' | 'shipped'; text: string } | null = null;
  let funders: string[] = [];
  const otherLinks: { label: string; url: string }[] = [];
  const prLinks: { num: string; url: string }[] = [];
  let depHtml: string | null = null;
  const descLines: string[] = [];

  if (metaLineIdx !== -1) {
    const segments = lines[metaLineIdx].split('|').map((s) => s.trim());
    for (const seg of segments) {
      if (seg.startsWith('Funded by:')) {
        funders = parseFunders(seg.slice('Funded by:'.length));
      } else if (seg.includes('`') || seg.includes('Planned')) {
        status = parseStatus(seg);
      } else {
        parseLinks(seg, prLinks, otherLinks);
      }
    }
  }

  lines.forEach((line, i) => {
    if (i === metaLineIdx) return;
    if (/^Dependenc(y|ies):/i.test(line)) {
      depHtml = line.replace(
        MD_LINK_RE,
        (_full, label: string, url: string) =>
          `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
      );
    } else if (isLinkOnlyLine(line)) {
      parseLinks(line, prLinks, otherLinks);
    } else {
      descLines.push(line);
    }
  });

  const links: { label: string; url: string }[] = [];
  if (prLinks.length === 1) {
    links.push({ label: 'Pull request', url: prLinks[0].url });
  } else if (prLinks.length > 1) {
    for (const { num, url } of prLinks) links.push({ label: `PR #${num}`, url });
  }
  links.push(...otherLinks);

  const { prefix, emphasis } = renderTitle(title);

  return {
    titlePrefix: prefix,
    titleEmphasis: emphasis,
    statusText: status?.text ?? null,
    statusClass: status?.cssClass ?? null,
    funders,
    links,
    depHtml,
    description: descLines.length ? descLines.join(' ') : null,
  };
}

function parseItems(markdownContent: string): RoadmapItem[] {
  // Semester/section subheadings aren't currently needed for structure.
  const content = markdownContent
    .split('\n')
    .filter((line) => !line.startsWith('## '))
    .join('\n');

  const items: RoadmapItem[] = [];
  const headingRe = /^### (.+)$/gm;
  const matches = [...content.matchAll(headingRe)];
  matches.forEach((match, i) => {
    const title = match[1];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? content.length : content.length;
    const body = content.slice(start, end);
    items.push(parseItem(title, body));
  });
  return items;
}

async function fetchMarkdown(docId: string): Promise<string> {
  const res = await fetch(MARKDOWN_URL(docId));
  if (!res.ok) {
    throw new Error(`Failed to fetch Docs document ${docId}: ${res.status}`);
  }
  const payload = await res.json();
  const content = payload.content;
  if (!content) throw new Error(`No content returned for document ${docId}`);
  return content;
}

async function fetchHtml(docId: string): Promise<string> {
  const res = await fetch(HTML_URL(docId));
  if (!res.ok) {
    throw new Error(`Failed to fetch Docs document ${docId}: ${res.status}`);
  }
  const payload = await res.json();
  const content = payload.content;
  if (!content) throw new Error(`No content returned for document ${docId}`);
  return content;
}

// Memoized per document id so pages that both need the same section
// (e.g. the homepage teaser and the roadmap page) only fetch it once
// per build.
const cache = new Map<string, Promise<RoadmapItem[]>>();

export function fetchRoadmapSection(docId: string): Promise<RoadmapItem[]> {
  let promise = cache.get(docId);
  if (!promise) {
    promise = fetchMarkdown(docId).then(parseItems);
    cache.set(docId, promise);
  }
  return promise;
}

export interface RoadmapChild {
  id: string;
  title: string;
  slug: string;
}

function slugify(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // strip emoji/punctuation
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

let childrenCache: Promise<RoadmapChild[]> | null = null;

export function fetchRoadmapChildren(): Promise<RoadmapChild[]> {
  if (!childrenCache) {
    childrenCache = (async () => {
      const res = await fetch(CHILDREN_URL(ROADMAP_ROOT_ID));
      if (!res.ok) {
        throw new Error(`Failed to fetch roadmap children: ${res.status}`);
      }
      const payload = await res.json();
      const results: { id: string; title: string }[] = payload.results ?? [];
      return results.map((r) => ({ id: r.id, title: r.title, slug: slugify(r.title) }));
    })();
  }
  return childrenCache;
}

function splitMarkdownSections(markdown: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  const headingRe = /^## (.+)$/gm;
  const matches = [...markdown.matchAll(headingRe)];
  matches.forEach((match, i) => {
    const heading = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? markdown.length : markdown.length;
    sections.push({ heading, body: markdown.slice(start, end) });
  });
  return sections;
}

function splitHtmlSections(html: string): { heading: string; html: string }[] {
  // Splits on top-level <h2>...</h2> boundaries produced by the Docs HTML export.
  const parts = html.split(/(<h2[^>]*>.*?<\/h2>)/s);
  const sections: { heading: string; html: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const headingMatch = parts[i].match(/<h2[^>]*>(.*?)<\/h2>/s);
    const heading = headingMatch ? headingMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    sections.push({ heading, html: parts[i + 1] ?? '' });
  }
  return sections;
}

export interface RoadmapRoot {
  introHtml: string;
  contributeLead: string | null;
  contributeItems: RoadmapItem[];
}

let rootCache: Promise<RoadmapRoot> | null = null;

export function fetchRoadmapRoot(): Promise<RoadmapRoot> {
  if (!rootCache) {
    rootCache = (async () => {
      const [html, markdown, children] = await Promise.all([
        fetchHtml(ROADMAP_ROOT_ID),
        fetchMarkdown(ROADMAP_ROOT_ID),
        fetchRoadmapChildren(),
      ]);

      // Point the doc's own links to the children (external docs.numerique.gouv.fr
      // URLs) at the subpages we generate for them instead.
      let rewrittenHtml = html;
      for (const child of children) {
        rewrittenHtml = rewrittenHtml.replaceAll(
          `https://docs.numerique.gouv.fr/docs/${child.id}/`,
          `/roadmap/${child.slug}.html`
        );
      }

      const htmlSections = splitHtmlSections(rewrittenHtml);
      const introSection = htmlSections.find((s) => /intro/i.test(s.heading));
      const roadmapSection = htmlSections.find((s) => /^roadmap$/i.test(s.heading));
      let introHtml = (introSection?.html ?? '') + (roadmapSection?.html ?? '');

      // The Docs HTML export emits a bare <table>; reuse our existing
      // .deps-table styling instead of adding new CSS just for this.
      introHtml = introHtml
        .replace(/<table>/g, '<div class="table-wrap"><table class="deps-table">')
        .replace(/<\/table>/g, '</table></div>');

      const markdownSections = splitMarkdownSections(markdown);
      const contributeSection = markdownSections.find((s) => /contribute/i.test(s.heading));

      let contributeLead: string | null = null;
      let contributeItems: RoadmapItem[] = [];
      if (contributeSection) {
        const firstItemIdx = contributeSection.body.search(/^### /m);
        const leadText =
          firstItemIdx === -1
            ? contributeSection.body
            : contributeSection.body.slice(0, firstItemIdx);
        contributeLead = leadText.trim() || null;
        contributeItems = parseItems(contributeSection.body);
      }

      return { introHtml, contributeLead, contributeItems };
    })();
  }
  return rootCache;
}
