// Community calls are authored by the team as regular Docs documents (one
// child doc per call, listed under a shared root doc) and fetched here at
// build time via the public, unauthenticated `formatted-content` API of a
// Docs instance — same approach as the roadmap, see ./roadmap.ts.
//
// Each call doc starts with a small front-matter block the author fills in
// by hand, formatted as a "hidden" block (transparent text on a dark
// highlight) so it doesn't clutter the doc when read in Docs itself:
//
//   ---
//   date: 2026/07/09
//   author: virgile-dev
//   ---
//
// We read date/author from the markdown export (plain text, easy to parse)
// and strip the equivalent hidden paragraphs from the HTML export before
// rendering the rest of the doc as the call's body.

const DOCUMENT_URL = 'https://docs.numerique.gouv.fr/api/v1.0/documents/';
const MARKDOWN_URL = (docId: string) =>
  `${DOCUMENT_URL}${docId}/formatted-content/?content_format=markdown`;
const HTML_URL = (docId: string) =>
  `${DOCUMENT_URL}${docId}/formatted-content/?content_format=html`;
const CHILDREN_URL = (docId: string) => `${DOCUMENT_URL}${docId}/children/`;

export const COMMUNITY_CALLS_ROOT_ID = 'f5184fe4-9128-4397-8317-6d792dc09226';

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

function slugify(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // strip emoji/punctuation
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

// Splits a leading `--- ... ---` block off the markdown export and pulls
// `date:`/`author:` out of it. Tolerant of the blank lines and trailing
// `\` (markdown hard-break escape) the Docs editor adds around it.
const FRONTMATTER_RE = /^-{3,}[ \t]*\n([\s\S]*?)\n-{3,}[ \t]*\n?/;

function parseFrontmatter(markdown: string): { date: string; author: string } {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) return { date: '', author: '' };
  const header = match[1];
  const dateMatch = header.match(/date:\s*([0-9]{4})\/([0-9]{2})\/([0-9]{2})/);
  const authorMatch = header.match(/author:\s*([^\n\\]+)/);
  return {
    date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '',
    author: authorMatch ? authorMatch[1].trim() : '',
  };
}

// Mirrors FRONTMATTER_RE but on the HTML export, where the same block
// renders as leading <p> elements with transparent-on-dark "hidden text"
// styling instead of plain `---` lines.
const HIDDEN_FRONTMATTER_P_RE = /^<p>(?:(?!<\/p>)[\s\S])*?rgba\(0,\s*0,\s*0,\s*0\)(?:(?!<\/p>)[\s\S])*?<\/p>/;

function stripFrontmatterHtml(html: string): string {
  let rest = html.trimStart();
  while (HIDDEN_FRONTMATTER_P_RE.test(rest)) {
    rest = rest.replace(HIDDEN_FRONTMATTER_P_RE, '').trimStart();
  }
  return rest;
}

// The Docs HTML export emits bare `<video src="...">` tags (no playback
// UI) for embedded recordings; add `controls` so they're actually usable.
function addVideoControls(html: string): string {
  return html.replace(/<video(?![^>]*\bcontrols\b)/g, '<video controls');
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export interface CommunityCallChild {
  id: string;
  title: string;
  slug: string;
}

let childrenCache: Promise<CommunityCallChild[]> | null = null;

export function fetchCommunityCallChildren(): Promise<CommunityCallChild[]> {
  if (!childrenCache) {
    childrenCache = (async () => {
      const res = await fetch(CHILDREN_URL(COMMUNITY_CALLS_ROOT_ID));
      if (!res.ok) {
        throw new Error(`Failed to fetch community calls children: ${res.status}`);
      }
      const payload = await res.json();
      const results: { id: string; title: string }[] = payload.results ?? [];
      return results.map((r) => ({ id: r.id, title: r.title, slug: slugify(r.title) }));
    })();
  }
  return childrenCache;
}

export interface CommunityCall {
  id: string;
  title: string;
  slug: string;
  date: string; // ISO yyyy-mm-dd, or '' if the doc's front-matter is missing/malformed
  dateDisplay: string;
  author: string;
  contentHtml: string;
}

const callCache = new Map<string, Promise<CommunityCall>>();

export function fetchCommunityCall(child: CommunityCallChild): Promise<CommunityCall> {
  let promise = callCache.get(child.id);
  if (!promise) {
    promise = (async () => {
      const [markdown, html] = await Promise.all([fetchMarkdown(child.id), fetchHtml(child.id)]);
      const { date, author } = parseFrontmatter(markdown);
      return {
        id: child.id,
        title: child.title,
        slug: child.slug,
        date,
        dateDisplay: formatDateDisplay(date),
        author,
        contentHtml: addVideoControls(stripFrontmatterHtml(html)),
      };
    })();
    callCache.set(child.id, promise);
  }
  return promise;
}

let allCallsCache: Promise<CommunityCall[]> | null = null;

// All calls, newest first (undated calls sort last).
export function fetchCommunityCalls(): Promise<CommunityCall[]> {
  if (!allCallsCache) {
    allCallsCache = (async () => {
      const children = await fetchCommunityCallChildren();
      const calls = await Promise.all(children.map(fetchCommunityCall));
      return calls.sort((a, b) => b.date.localeCompare(a.date));
    })();
  }
  return allCallsCache;
}

let introCache: Promise<string> | null = null;

// The root doc's own content (e.g. "Every quarter we'll organize a
// community call...") is rendered as the intro on /community-calls.
export function fetchCommunityCallsIntro(): Promise<string> {
  if (!introCache) {
    introCache = fetchHtml(COMMUNITY_CALLS_ROOT_ID);
  }
  return introCache;
}
