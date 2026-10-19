// GitHub star count and star history for suitenumerique/docs, fetched at
// build time (the deploy workflow rebuilds every 6 hours, so this stays
// fresh without a code push).
//
// The total comes from the public, unauthenticated repo endpoint. For the
// history chart, past milestones are frozen below; newer 1000-star
// milestones are sampled from the stargazers API, which needs a token —
// in CI that's the workflow's GITHUB_TOKEN. Without one (e.g. local
// builds) the chart just gets the frozen points plus today's total.
//
// GitHub being down or rate-limiting us must not break the deploy, so any
// failure falls back to the frozen data with a warning.

const REPO_URL = 'https://api.github.com/repos/suitenumerique/docs';
const STARGAZERS_URL = (page: number) => `${REPO_URL}/stargazers?per_page=100&page=${page}`;

export interface StarPoint {
  date: string; // ISO timestamp
  count: number;
}

// Captured 2026-07-05 from the stargazers API. Each count is the Nth
// current stargazer, so these never change except through unstars.
const FROZEN_HISTORY: StarPoint[] = [
  { date: '2024-04-30T19:01:10Z', count: 1 },
  { date: '2024-09-04T14:28:13Z', count: 6 },
  { date: '2024-12-16T23:19:02Z', count: 11 },
  { date: '2025-01-14T20:42:24Z', count: 21 },
  { date: '2025-01-31T11:07:59Z', count: 31 },
  { date: '2025-03-16T11:36:25Z', count: 76 },
  { date: '2025-03-16T13:00:50Z', count: 100 },
  { date: '2025-03-16T16:50:31Z', count: 1000 },
  { date: '2025-03-17T10:53:47Z', count: 4000 },
  { date: '2025-03-18T09:56:26Z', count: 6000 },
  { date: '2025-03-20T10:23:09Z', count: 8000 },
  { date: '2025-03-27T20:25:11Z', count: 10000 },
  { date: '2025-04-10T08:03:57Z', count: 11000 },
  { date: '2025-05-22T13:08:51Z', count: 12000 },
  { date: '2025-08-24T16:04:38Z', count: 13000 },
  { date: '2025-11-01T23:30:25Z', count: 14000 },
  { date: '2025-12-27T14:14:47Z', count: 15000 },
  { date: '2026-02-24T06:33:43Z', count: 16000 },
];
const FROZEN_SNAPSHOT: StarPoint = { date: '2026-07-05T11:30:36Z', count: 16641 };

function headers(accept = 'application/vnd.github+json'): Record<string, string> {
  const h: Record<string, string> = { Accept: accept, 'User-Agent': 'docs-website-build' };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchStarCount(): Promise<number> {
  const res = await fetch(REPO_URL, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub repo API returned ${res.status}`);
  const payload = await res.json();
  if (typeof payload.stargazers_count !== 'number') throw new Error('No stargazers_count in GitHub response');
  return payload.stargazers_count;
}

// Date at which the repo got its Nth (current) stargazer.
async function fetchNthStarDate(n: number): Promise<string> {
  const res = await fetch(STARGAZERS_URL(Math.ceil(n / 100)), {
    headers: headers('application/vnd.github.star+json'),
  });
  if (!res.ok) throw new Error(`GitHub stargazers API returned ${res.status}`);
  const page: { starred_at: string }[] = await res.json();
  const entry = page[(n - 1) % 100];
  if (!entry) throw new Error(`No stargazer #${n} in GitHub response`);
  return entry.starred_at;
}

async function fetchNewMilestones(total: number): Promise<StarPoint[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  const last = FROZEN_HISTORY[FROZEN_HISTORY.length - 1].count;
  const milestones: number[] = [];
  for (let n = last + 1000; n <= total; n += 1000) milestones.push(n);
  return Promise.all(milestones.map(async (count) => ({ date: await fetchNthStarDate(count), count })));
}

export interface GitHubStars {
  count: number;
  history: StarPoint[];
}

let starsCache: Promise<GitHubStars> | null = null;

export function fetchGitHubStars(): Promise<GitHubStars> {
  if (!starsCache) {
    starsCache = (async () => {
      try {
        const count = await fetchStarCount();
        let milestones: StarPoint[] = [];
        try {
          milestones = await fetchNewMilestones(count);
        } catch (err) {
          console.warn(`[github-stars] Could not sample star milestones: ${(err as Error).message}`);
        }
        return {
          count,
          history: [...FROZEN_HISTORY, ...milestones, { date: new Date().toISOString(), count }],
        };
      } catch (err) {
        console.warn(`[github-stars] Falling back to frozen star data: ${(err as Error).message}`);
        return { count: FROZEN_SNAPSHOT.count, history: [...FROZEN_HISTORY, FROZEN_SNAPSHOT] };
      }
    })();
  }
  return starsCache;
}

// 16933 -> "16.9k"
export function formatStarCount(count: number): string {
  return count >= 1000 ? `${(Math.floor(count / 100) / 10).toFixed(1)}k` : String(count);
}
