import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

type WikiThumbResponse = {
  thumbnailUrl: string | null;
};

const CACHE_DIR = path.join(process.cwd(), ".birdatlas-cache");
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function cacheFilePath(key: string) {
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

async function readCache<T>(key: string): Promise<T | null> {
  const filePath = cacheFilePath(key);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: { updatedAt: number; value: T } = JSON.parse(raw) as {
      updatedAt: number;
      value: T;
    };
    if (Date.now() - parsed.updatedAt > CACHE_TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, value: T): Promise<void> {
  const filePath = cacheFilePath(key);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const payload = { updatedAt: Date.now(), value };
  await fs.writeFile(filePath, JSON.stringify(payload), "utf-8");
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWith429Retry(url: string, attempt = 0): Promise<Response> {
  const resp = await fetch(url, { headers: { "accept": "application/json" } });
  if (resp.status !== 429) return resp;

  if (attempt >= 2) return resp;

  const retryAfter = resp.headers.get("Retry-After");
  const retrySec = retryAfter ? Number(retryAfter) : NaN;
  const delayMs = Number.isFinite(retrySec) && retrySec > 0 ? retrySec * 1000 : 1000 * (attempt + 1);
  await sleep(delayMs);

  return fetchWith429Retry(url, attempt + 1);
}

type WikipediaSearchHit = { title?: string };
type WikipediaSearchResponse = {
  query?: { search?: WikipediaSearchHit[] };
};

type WikipediaPageImagesResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        thumbnail?: { source?: string | null };
      }
    >;
  };
};

function normalizeTitle(t: string) {
  return t.trim().replace(/_/g, " ").toLowerCase();
}

async function getWikiThumbnailUrl(query: string): Promise<string | null> {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  // 1) Search for candidate titles
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&origin=*&list=search&srnamespace=0&srlimit=3&srsearch=${encodeURIComponent(
    normalized
  )}&format=json`;

  const searchResp = await fetchWith429Retry(searchUrl);
  if (!searchResp.ok) return null;
  const searchJson = (await searchResp.json()) as WikipediaSearchResponse;
  const rawTitles = (searchJson.query?.search || []).map((h) => h.title).filter((t): t is string => Boolean(t));

  const titles = rawTitles
    .map((t) => t.trim())
    .filter((t) => {
      const lower = t.toLowerCase();
      return !(
        lower.startsWith("file:") ||
        lower.startsWith("category:") ||
        lower.startsWith("help:") ||
        lower.startsWith("wikipedia:") ||
        lower.startsWith("template:") ||
        lower.startsWith("portal:")
      );
    })
    .slice(0, 5);

  if (titles.length === 0) return null;

  // 2) Fetch pageimages in one call
  const titlesParam = titles.join("|");
  const pageImagesUrl = `https://en.wikipedia.org/w/api.php?action=query&origin=*&titles=${encodeURIComponent(
    titlesParam
  )}&prop=pageimages&pithumbsize=80&format=json`;

  const pageResp = await fetchWith429Retry(pageImagesUrl);
  if (!pageResp.ok) return null;
  const pageJson = (await pageResp.json()) as WikipediaPageImagesResponse;
  const pages = pageJson.query?.pages;
  if (!pages) return null;

  // 3) Pick the first title (in order) that has a thumbnail source
  for (const wantedTitle of titles) {
    const wanted = normalizeTitle(wantedTitle);
    const match = Object.values(pages).find((p) => (p.title ? normalizeTitle(p.title) === wanted : false));
    const source = match?.thumbnail?.source;
    if (typeof source === "string" && source.length > 0) return source;
  }

  // Fallback: any thumbnail
  for (const p of Object.values(pages)) {
    const source = p.thumbnail?.source;
    if (typeof source === "string" && source.length > 0) return source;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ thumbnailUrl: null } satisfies WikiThumbResponse);
  }

  const normalized = normalizeQuery(query);
  const cacheKey = `wiki:thumb:${normalized}`;

  const cached = await readCache<WikiThumbResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const thumbnailUrl = await getWikiThumbnailUrl(query);
  const payload: WikiThumbResponse = { thumbnailUrl };

  await writeCache(cacheKey, payload).catch(() => {});

  return NextResponse.json(payload);
}

