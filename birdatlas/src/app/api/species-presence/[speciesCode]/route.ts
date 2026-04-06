import { NextRequest, NextResponse } from "next/server";
import { readCacheJson, writeCacheJson } from "@/lib/cache";
import type { SpeciesPresenceResponse } from "@/types/species-presence";

type EbirdObservation = {
  speciesCode?: string;
  comName?: string;
  sciName?: string;
  howMany?: number | string | null;
};

const ALL_US_STATES = [
  "US-AL", "US-AK", "US-AZ", "US-AR", "US-CA", "US-CO", "US-CT", "US-DE",
  "US-DC", "US-FL", "US-GA", "US-HI", "US-ID", "US-IL", "US-IN", "US-IA",
  "US-KS", "US-KY", "US-LA", "US-ME", "US-MD", "US-MA", "US-MI", "US-MN",
  "US-MS", "US-MO", "US-MT", "US-NE", "US-NV", "US-NH", "US-NJ", "US-NM",
  "US-NY", "US-NC", "US-ND", "US-OH", "US-OK", "US-OR", "US-PA", "US-RI",
  "US-SC", "US-SD", "US-TN", "US-TX", "US-UT", "US-VT", "US-VA", "US-WA",
  "US-WV", "US-WI", "US-WY",
];

const VALID_SPECIES_CODE = /^[a-zA-Z][a-zA-Z0-9]{1,9}$/;
const BATCH_SIZE = 10;

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Query one US state for recent observations of a species.
 * Returns aggregated count or null if no observations.
 */
async function fetchStatePresence(
  stateCode: string,
  speciesCode: string,
  backDays: number,
  apiKey: string,
): Promise<{
  stateCode: string;
  totalCount: number;
  observationCount: number;
  commonName: string | null;
  scientificName: string | null;
} | null> {
  const url = `https://api.ebird.org/v2/data/obs/${stateCode}/recent/${encodeURIComponent(
    speciesCode,
  )}?back=${backDays}&maxResults=200`;

  try {
    const resp = await fetch(url, {
      headers: { "X-eBirdApiToken": apiKey },
    });
    if (!resp.ok) return null;

    const observations = (await resp.json()) as EbirdObservation[];
    if (!observations || observations.length === 0) return null;

    let totalCount = 0;
    let commonName: string | null = null;
    let scientificName: string | null = null;

    for (const obs of observations) {
      const howMany = toNumber(obs.howMany);
      totalCount += howMany !== null ? howMany : 1;
      if (!commonName && obs.comName) commonName = obs.comName.trim();
      if (!scientificName && obs.sciName) scientificName = obs.sciName.trim();
    }

    return {
      stateCode,
      totalCount,
      observationCount: observations.length,
      commonName,
      scientificName,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ speciesCode: string }> },
) {
  const { speciesCode } = await context.params;

  if (!VALID_SPECIES_CODE.test(speciesCode)) {
    return NextResponse.json({ error: "Invalid species code." }, { status: 400 });
  }

  const apiKey = process.env.EBIRD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing EBIRD_API_KEY on the server." }, { status: 500 });
  }

  const backDays = 30;

  // v3 key invalidates broken v2 caches that stored 0-state results.
  const cacheKey = `species_presence_v3_${speciesCode}_back_${backDays}`;
  const cached = await readCacheJson<SpeciesPresenceResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Query each US state individually for this species (the state code is known
  // from the request path, so we don't need the response to include it).
  // Batched to avoid flooding the eBird API.
  const results: NonNullable<Awaited<ReturnType<typeof fetchStatePresence>>>[] = [];

  for (let i = 0; i < ALL_US_STATES.length; i += BATCH_SIZE) {
    const batch = ALL_US_STATES.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((sc) => fetchStatePresence(sc, speciesCode, backDays, apiKey)),
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }

  let commonName = speciesCode;
  let scientificName = speciesCode;
  for (const r of results) {
    if (r.commonName) { commonName = r.commonName; break; }
  }
  for (const r of results) {
    if (r.scientificName) { scientificName = r.scientificName; break; }
  }

  const states = results
    .map((r) => ({
      stateCode: r.stateCode,
      totalCount: r.totalCount,
      observationCount: r.observationCount,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  const stateCount = states.length;

  const payload: SpeciesPresenceResponse = {
    speciesCode,
    commonName,
    scientificName,
    backDays,
    label: `Reported in ${stateCount} state${stateCount !== 1 ? "s" : ""} in the last ${backDays} days`,
    note: "Recent eBird reports, not a migration map. For seasonal range data see eBird Status & Trends.",
    states,
  };

  writeCacheJson(cacheKey, payload).catch(() => {});

  return NextResponse.json(payload);
}
