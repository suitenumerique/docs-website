// The roadmap lists are authored by the team as regular Docs documents
// (shared publicly) and fetched here at build time via the public,
// unauthenticated `formatted-content` API of a Docs instance — see
// https://docs.numerique.gouv.fr. Docs is dogfooding itself as the
// publishing workflow for its own roadmap.

const DOCUMENT_URL = 'https://docs.numerique.gouv.fr/api/v1.0/documents/';
const CONTENT_URL = (docId: string) =>
  `${DOCUMENT_URL}${docId}/formatted-content/?content_format=markdown`;

export const ROADMAP_SOURCES = {
  planned: '1e2a0b10-bc55-4b47-94f6-6b854acc3050',
  s1_2026: '924009cb-7ee7-4b18-b872-a351e5f6d33c',
  y2025: '9e10fa80-7fbc-412b-a3c3-2bf19ef5d17a',
} as const;

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
    if (!token) continue;
    const flagMatch = token.match(FLAG_RE);
    const flag = flagMatch ? flagMatch[0] : '';
    let name = token.replace(FLAG_RE, '').trim();
    name = FUNDER_ABBREVIATIONS[name] ?? name;
    pills.push(`${flag} ${name}`.trim());
  }
  return pills;
}

function parseStatus(segment: string): { cssClass: 'planned' | 'shipped'; text: string } {
  const isPlanned = segment.includes('\u{1F300}') || segment.includes('Planned');
  const codeMatch = segment.match(/`([^`]*)`/);
  const codeRaw = codeMatch ? codeMatch[1] : '';
  const codeClean = codeRaw.replace(/[✅\u{1F300}]/gu, '').trim();
  const codeDisplay = codeClean === '?' ? 'TBD' : codeClean;

  let rest = segment;
  if (codeMatch) rest = rest.replace(codeMatch[0], '');
  rest = rest.replace(/Planned:?/, '');
  rest = rest.replace(/✅/g, '').replace(/\u{1F300}/gu, '');
  const extra = rest.replace(/^[\s|]+|[\s|]+$/g, '').trim();

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
    const [full, label, url] = match;
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
  const res = await fetch(CONTENT_URL(docId));
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
