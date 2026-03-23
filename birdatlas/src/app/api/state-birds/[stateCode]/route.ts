import { NextRequest, NextResponse } from "next/server";
import { makeCacheKey, readCacheJson, writeCacheJson } from "@/lib/cache";

type BirdRank = {
  speciesCode: string;
  commonName: string;
  scientificName: string;
  score: number;
};

type EbirdRecentObservation = {
  speciesCode?: string;
  comName?: string;
  sciName?: string;
  howMany?: number | string | null;
  exoticCategory?: string | null;
  exoticCode?: string | null;
};

const isUsStateCode = (value: string): boolean => /^US-[A-Z]{2}$/.test(value);

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isNativeObservation(obs: EbirdRecentObservation): boolean {
  // Best-effort "native" approximation:
  // - If eBird provides `exoticCategory` and it is non-empty, treat as non-native.
  // - If it provides `exoticCode` (naturalized/provisional/escapee) treat non-empty as non-native.
  // - If neither exists, fall back to "allow".
  const exoticCategory = typeof obs.exoticCategory === "string" ? obs.exoticCategory.trim() : "";
  if (exoticCategory) return false;

  const exoticCode = typeof obs.exoticCode === "string" ? obs.exoticCode.trim() : "";
  if (exoticCode) return false;

  return true;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ stateCode: string }> }
) {
  const { stateCode } = await context.params;

  if (!isUsStateCode(stateCode)) {
    return NextResponse.json({ error: "Invalid state code. Expected US-XX." }, { status: 400 });
  }

  const apiKey = process.env.EBIRD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing EBIRD_API_KEY on the server." }, { status: 500 });
  }

  // eBird v2 "recent" is typically limited to a small lookback window. We start with `back=30`.
  // Later we can improve the time window via batching if eBird exposes a workable date-range mechanism.
  const backDays = 30;
  const maxResults = 10000;

  const cacheKey = makeCacheKey({ stateCode, backDays });
  const cached = await readCacheJson<{
    stateCode: string;
    rankingWindow: { backDays: number };
    top4: BirdRank[];
    top20: BirdRank[];
  }>(cacheKey);

  if (cached) return NextResponse.json(cached);

  const url = `https://api.ebird.org/v2/data/obs/${encodeURIComponent(
    stateCode
  )}/recent?back=${backDays}&maxResults=${maxResults}`;

  const resp = await fetch(url, {
    headers: {
      "X-eBirdApiToken": apiKey,
    },
  });

  if (!resp.ok) {
    const message = await resp.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to fetch eBird observations.", details: message || undefined },
      { status: resp.status }
    );
  }

  const observations = (await resp.json()) as EbirdRecentObservation[];

  const bySpecies = new Map<
    string,
    {
      speciesCode: string;
      commonName: string;
      scientificName: string;
      score: number;
    }
  >();

  for (const obs of observations) {
    const speciesCode = obs.speciesCode;
    if (!speciesCode) continue;

    if (!isNativeObservation(obs)) continue;

    const commonName = obs.comName?.trim() || speciesCode;
    const scientificName = obs.sciName?.trim() || speciesCode;

    // Prefer numeric "howMany" when available, otherwise count rows.
    const howMany = toNumber(obs.howMany);
    const increment = howMany !== null ? howMany : 1;

    const existing = bySpecies.get(speciesCode);
    if (!existing) {
      bySpecies.set(speciesCode, {
        speciesCode,
        commonName,
        scientificName,
        score: increment,
      });
    } else {
      existing.score += increment;
      // Keep first names; they should be stable per speciesCode.
    }
  }

  const ranked: BirdRank[] = Array.from(bySpecies.values())
    .map((x) => ({
      speciesCode: x.speciesCode,
      commonName: x.commonName,
      scientificName: x.scientificName,
      score: x.score,
    }))
    .sort((a, b) => b.score - a.score);

  const top4 = ranked.slice(0, 4);
  const top20 = ranked.slice(0, 20);

  const payload = {
    stateCode,
    rankingWindow: { backDays },
    top4,
    top20,
  };

  // Cache best-effort. If writing fails, still return fresh computed results.
  writeCacheJson(cacheKey, payload).catch(() => {});

  return NextResponse.json(payload);
}

