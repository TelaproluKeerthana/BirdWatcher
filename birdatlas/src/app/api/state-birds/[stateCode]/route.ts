import { NextRequest, NextResponse } from "next/server";
import { makeCacheKey, readCacheJson, writeCacheJson } from "@/lib/cache";
import type { BirdRank, StateBirdsResponse } from "@/types/state-birds";

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

/**
 * Non-exotic rows for this checklist observation (eBird operational sense).
 * eBird uses empty/NA exoticCategory for native-range reporting; N/P/X flags mark introduced taxa.
 * This is not the same as “species native to the state’s ecosystems” (requires external range data).
 */
function isNonExoticObservation(obs: EbirdRecentObservation): boolean {
  const exoticCategory = typeof obs.exoticCategory === "string" ? obs.exoticCategory.trim() : "";
  if (exoticCategory) return false;

  const exoticCode = typeof obs.exoticCode === "string" ? obs.exoticCode.trim() : "";
  if (exoticCode) return false;

  return true;
}

/** v1 metric metadata (same for all cached responses). */
const METRIC_V1: StateBirdsResponse["metric"] = {
  id: "recent_non_exotic_abundance_v1",
  scoreDescription:
    "Per species: sum of reported counts (howMany) across non-exotic rows, or 1 per row when no count.",
  nonExoticFilterDescription:
    "Includes only rows where eBird does not set exoticCategory or exoticCode on the observation.",
  nativityNote:
    "True biogeographic nativity (breeding residents vs migrants, native vs introduced range) is not in the eBird JSON API; this list ranks recent non-exotic sightings only.",
};

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

  // eBird v2 `back` is limited (1–30 days). The `/recent` endpoint does not accept taxonomic
  // `categories` (see rebird’s `ebirdregion` vs `ebirdhistorical`); the historic observations
  // call supports `categories` for a single calendar date if we add day-based sampling later.
  const backDays = 30;
  const maxResults = 10000;

  const cacheKey = makeCacheKey({ stateCode, backDays });
  const cached = await readCacheJson<StateBirdsResponse>(cacheKey);

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

    if (!isNonExoticObservation(obs)) continue;

    const commonName = obs.comName?.trim() || speciesCode;
    const scientificName = obs.sciName?.trim() || speciesCode;

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

  const payload: StateBirdsResponse = {
    stateCode,
    rankingWindow: {
      backDays,
      label: `Last ${backDays} days (eBird recent observations)`,
    },
    metric: METRIC_V1,
    top4,
    top20,
  };

  writeCacheJson(cacheKey, payload).catch(() => {});

  return NextResponse.json(payload);
}
