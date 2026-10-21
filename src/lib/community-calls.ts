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
//   when: 2026/07/16 13:00 CEST
//   ---
//
// `date` is when the post was written; the optional `when` is when the call
// itself takes place (date, then free-form time text) and drives the
// upcoming/past split on /community-calls. Without it we fall back to `date`.
//
// We read date/author/when from the markdown export (plain text, easy to parse)
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

interface Frontmatter {
  date: string;
  author: string;
  when: string; // ISO yyyy-mm-dd, or ''
  whenTime: string; // free-form time text after the date, e.g. "13:00 CEST"
}

function parseFrontmatter(markdown: string): Frontmatter {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) return { date: '', author: '', when: '', whenTime: '' };
  const header = match[1];
  const dateMatch = header.match(/date:\s*([0-9]{4})\/([0-9]{2})\/([0-9]{2})/);
  const authorMatch = header.match(/author:\s*([^\n\\]+)/);
  const whenMatch = header.match(/when:\s*([0-9]{4})\/([0-9]{2})\/([0-9]{2})[ \t]*([^\n\\]*)/);
  return {
    date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '',
    author: authorMatch ? authorMatch[1].trim() : '',
    when: whenMatch ? `${whenMatch[1]}-${whenMatch[2]}-${whenMatch[3]}` : '',
    whenTime: whenMatch ? whenMatch[4].trim() : '',
  };
}

// Mirrors FRONTMATTER_RE but on the HTML export, where the same block
// renders as leading <p> elements (styled as "hidden text", though authors
// don't always apply that styling consistently). We match on the text
// itself: if the doc opens with a `---` paragraph, drop paragraphs up to and
// including the one that closes the block with `---`.
const LEADING_P_RE = /^<p>([\s\S]*?)<\/p>/;
const FRONTMATTER_TEXT_RE = /^-{3,}[\s\S]+-{3,}$/;

function paragraphText(innerHtml: string): string {
  return innerHtml.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').trim();
}

function stripFrontmatterHtml(html: string): string {
  let rest = html.trimStart();
  let text = '';
  let match: RegExpMatchArray | null;
  while ((match = rest.match(LEADING_P_RE))) {
    const pText = paragraphText(match[1]);
    if (!text && !pText.startsWith('---')) break;
    text = text ? `${text}\n${pText}` : pText;
    rest = rest.slice(match[0].length).trimStart();
    if (FRONTMATTER_TEXT_RE.test(text)) return rest;
  }
  // No complete `--- ... ---` block at the top: leave the doc untouched.
  return html;
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

const TZ_OFFSETS: Record<string, string> = {
  UTC: 'Z',
  GMT: 'Z',
  CET: '+01:00',
  CEST: '+02:00',
};

// Reads the last HH:MM in e.g. "13:00 CEST" or "13:00 – 14:00 CEST" (so a
// range resolves to its end time) plus a known timezone abbreviation.
function parseEventEnd(isoDate: string, timeText: string): number | null {
  const times = [...timeText.matchAll(/\b([0-9]{1,2}):([0-9]{2})\b/g)];
  const tz = timeText.match(/\b(UTC|GMT|CEST|CET)\b/);
  if (!times.length || !tz) return null;
  const [, hh, mm] = times[times.length - 1];
  const ts = Date.parse(`${isoDate}T${hh.padStart(2, '0')}:${mm}:00${TZ_OFFSETS[tz[1]]}`);
  return Number.isNaN(ts) ? null : ts;
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
      // Skip children whose title slugifies to nothing (e.g. a freshly
      // created, still-untitled doc) — they'd produce an empty route param.
      return results
        .map((r) => ({ id: r.id, title: r.title, slug: slugify(r.title) }))
        .filter((child) => child.slug);
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
  // When the call takes place: the `when` front-matter if set, else `date`.
  eventDate: string;
  eventDisplay: string;
  // End of the call (or start, if no end time is given) as a Unix ms
  // timestamp, when `when` has a parseable time and timezone; else null.
  eventEndsAt: number | null;
  contentHtml: string;
}

const callCache = new Map<string, Promise<CommunityCall>>();

export function fetchCommunityCall(child: CommunityCallChild): Promise<CommunityCall> {
  let promise = callCache.get(child.id);
  if (!promise) {
    promise = (async () => {
      const [markdown, html] = await Promise.all([fetchMarkdown(child.id), fetchHtml(child.id)]);
      const { date, author, when, whenTime } = parseFrontmatter(markdown);
      const eventDate = when || date;
      const eventDisplay = [formatDateDisplay(eventDate), when && whenTime].filter(Boolean).join(' · ');
      return {
        id: child.id,
        title: child.title,
        slug: child.slug,
        date,
        dateDisplay: formatDateDisplay(date),
        author,
        eventDate,
        eventDisplay,
        eventEndsAt: when ? parseEventEnd(when, whenTime) : null,
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

// Splits calls around the build time: calls that haven't ended yet are
// upcoming (soonest first), the rest are past (newest first). A call whose
// `when` has a time + timezone ends at that time; otherwise it stays
// upcoming through the whole day. Undated calls count as past. Since this runs at build time, a call only moves to "past"
// on the next rebuild after it happens.
export function splitCommunityCalls(calls: CommunityCall[]): {
  upcoming: CommunityCall[];
  past: CommunityCall[];
} {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const isUpcoming = (c: CommunityCall) =>
    c.eventEndsAt !== null ? c.eventEndsAt > now : Boolean(c.eventDate) && c.eventDate >= today;
  const upcoming = calls
    .filter(isUpcoming)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const past = calls
    .filter((c) => !isUpcoming(c))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return { upcoming, past };
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
