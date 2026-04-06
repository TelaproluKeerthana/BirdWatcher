This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Bird Atlas setup

This app uses the [eBird API 2.0](https://ebird.org/home) to rank species by **relative abundance in recent observations** for each US state (`US-XX` subnational codes), after filtering out rows eBird flags with **exotic** metadata (`exoticCategory` / `exoticCode`). That is an operational “non-exotic” signal, **not** the same as mapping true biogeographic nativity (native breeding range, etc.), which would require merging external range data.

**Metric (v1):** `recent_non_exotic_abundance_v1` — sum of `howMany` per species over the lookback window (or `1` per row when no count), using `GET /v2/data/obs/{region}/recent` with `back=30` and `maxResults` up to 10,000. The JSON response includes `metric` and `rankingWindow` fields documenting this.

**API note:** Regional **checklist frequency** (percentage of checklists reporting a species) is not exposed through this lightweight JSON API the same way; obtaining that typically means working with the **eBird Basic Dataset** or other bulk products under eBird’s data terms, not `product/spplist` alone (which is presence-only).

Use the API under the [eBird API Terms of Use](https://birds.cornell.edu/home/ebird-api-terms-of-use).

1. Create your environment file:

   - Copy `.env.example` to `.env.local`
   - Set `EBIRD_API_KEY` in `.env.local`
   - Do not commit `.env.local` (it is ignored by `.gitignore`)

2. Start the dev server:

```bash
npm run dev
```

The `/v2/data/obs/{regionCode}/recent` endpoint limits `back` to at most 30 days; the app uses `back=30`.

### Species presence across states

Clicking **"Where?"** on a bird in the panel queries `GET /v2/data/obs/{stateCode}/recent/{speciesCode}` for each US state (batched 10 at a time, aggregate cached 24 hours) and colors the map as a choropleth — greener states had more recent reports. Hover a state for the count.

This shows **where eBird users recently reported a species**, not migration paths. The eBird JSON API does not expose inter-region movement vectors, flyway data, or seasonal range shifts.

### Migration / seasonal range data (future)

True **seasonal migration or range-shift** maps require a different data tier:

- **[eBird Status & Trends](https://science.ebird.org/en/status-and-trends)** products provide seasonal relative abundance surfaces and range polygons suitable for animation. Access is separate from the basic API key and typically involves raster/polygon datasets consumed via R (`ebirdst`) or GIS workflows.
- Alternatively, **external flyway / range layers** (USFWS, BirdLife International, etc.) can be overlaid.

Neither of these is integrated yet; this would be a separate feature.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
