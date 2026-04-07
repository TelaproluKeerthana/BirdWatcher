# Bird Atlas

An interactive US map that ranks birds by recent non-exotic sightings per state, powered by the [eBird API 2.0](https://ebird.org/home). Click any state to see its top-reported species, then click **"Where?"** on a bird to see which other states recently reported it.

## Features

**State bird rankings** -- Click a state on the Leaflet map. The side panel shows the top 4 (expandable to 20) species ranked by total reported count over the last 30 days, with Wikipedia thumbnail images fetched on the fly.

**Species presence choropleth** -- Click **"Where?"** next to any bird. The map recolors as a choropleth: greener states had more recent reports of that species, dimmed states had none. Hover a state for the exact count.

**Non-exotic filtering** -- Observations flagged by eBird as introduced, naturalized, provisional, or escapee (`exoticCategory` / `exoticCode`) are excluded. This is an operational "non-exotic" filter, not the same as strict biogeographic nativity (see the in-app details panel for the distinction).

**Disk cache** -- All eBird and Wikipedia responses are cached to `.birdatlas-cache/` for 24 hours to minimize repeat API calls.

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5, React 19 |
| Map | Leaflet + react-leaflet, us-atlas TopoJSON |
| Styling | Tailwind CSS 4 |
| Data | eBird API 2.0, Wikipedia REST API |

## Project structure

```
birdatlas/
  src/
    app/
      page.tsx                              Main page (map + panel layout)
      api/
        state-birds/[stateCode]/route.ts    Ranked birds for one US state
        species-presence/[speciesCode]/route.ts  Cross-state presence for one species
        wiki-thumbnail/route.ts             Wikipedia thumbnail proxy
    components/
      UsMap.tsx                             Leaflet map with choropleth support
      BirdPanel.tsx                         Scrollable bird list with "Where?" buttons
    lib/
      cache.ts                              Disk-based JSON cache (24h TTL)
    types/
      state-birds.ts                        StateBirdsResponse, BirdRank
      species-presence.ts                   SpeciesPresenceResponse
  .birdatlas-cache/                         Cached API responses (gitignored)
```

## Getting started

1. Get a free eBird API key from [ebird.org/api/keygen](https://ebird.org/api/keygen).

2. Create the environment file:

```bash
cp .env.example .env.local
```

Set `EBIRD_API_KEY` in `.env.local`. Do not commit this file.

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

### State bird ranking (`/api/state-birds/[stateCode]`)

Calls `GET /v2/data/obs/{US-XX}/recent?back=30&maxResults=10000`. For each observation, rows with non-empty `exoticCategory` or `exoticCode` are dropped. Remaining rows are grouped by `speciesCode` and scored by summing `howMany` (or 1 when no count is provided). The response includes a `metric` object describing the scoring and filtering logic.

### Species presence (`/api/species-presence/[speciesCode]`)

Queries all 51 US states individually using `GET /v2/data/obs/{stateCode}/recent/{speciesCode}?back=30&maxResults=200`, batched 10 at a time. The state code is known from the request path, so the route does not depend on any state-level fields in the eBird response body. Results are aggregated and cached as a single payload.

### Caching

Both API routes use a shared disk cache (`src/lib/cache.ts`) with a 24-hour TTL. Cache keys include the query parameters and a version number. Bumping the version invalidates old entries when the payload shape changes.

## What changed recently

- **Non-exotic metric definition** -- The API response now includes structured `metric` and `rankingWindow` fields documenting how scores are computed and what "non-exotic" means, with in-app copy clarifying the distinction from true native range.

- **Species presence across states** -- New "Where?" button per bird. Queries eBird for that species across all US states (per-state batched calls) and renders a green choropleth on the map with hover tooltips showing counts.

- **Scrollable bird list** -- The panel height matches the map. When expanded to 20 birds, the list scrolls within a fixed container with pinned header and footer.

- **Cache version bump** -- Cache version incremented to v2 (state-birds) / v3 (species-presence) to invalidate stale entries from earlier payload formats.

## What could change next

- **Checklist frequency ranking** -- The current metric (summed `howMany`) over-weights large flocks. A better ranking would be *percentage of checklists that include a species*, but that data is not available through the lightweight eBird JSON API. It would require the [eBird Basic Dataset](https://ebird.org/data/download) or bulk exports.

- **Seasonal migration / range maps** -- The eBird observation API does not expose migration paths or seasonal range shifts. True seasonal maps would need [eBird Status & Trends](https://science.ebird.org/en/status-and-trends) products (raster/polygon data, separate access) or external flyway layers from USFWS or BirdLife International.

- **Taxonomic category filtering** -- The `/recent` endpoint does not accept a `categories` parameter. The historic observations endpoint (`/data/obs/{region}/historic/{Y}/{M}/{D}`) does support `categories=species` for filtering to species-level taxa only, which could be used with day-based sampling.

- **Longer time windows** -- eBird limits `back` to 30 days on the recent endpoint. Covering a full year would require batching historic single-day calls across dates, which is expensive and rate-limit-sensitive.

- **State-level search** -- Let users search for a species by name across the ranked list instead of scrolling.

## License and terms

Use of eBird data is subject to the [eBird API Terms of Use](https://birds.cornell.edu/home/ebird-api-terms-of-use). Wikipedia thumbnails are served under Wikimedia's terms.
