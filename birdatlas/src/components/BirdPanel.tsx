'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";

type BirdRank = {
  speciesCode: string;
  commonName: string;
  scientificName: string;
  score: number;
};

type StateBirdsResponse = {
  stateCode: string;
  rankingWindow: { backDays: number };
  top4: BirdRank[];
  top20: BirdRank[];
};

export type BirdPanelProps = {
  selectedStateCode: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BirdPanel({ selectedStateCode }: BirdPanelProps) {
  const [data, setData] = useState<StateBirdsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const thumbsRef = useRef<Record<string, string | null>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    thumbsRef.current = thumbs;
  }, [thumbs]);

  useEffect(() => {
    if (!selectedStateCode) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setExpanded(false);

      try {
        const r = await fetch(`/api/state-birds/${encodeURIComponent(selectedStateCode)}`);
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(text || `Request failed with ${r.status}`);
        }
        const json = (await r.json()) as StateBirdsResponse;
        if (cancelled) return;
        setData(json);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load birds.");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedStateCode]);

  const displayedBirds = useMemo(() => {
    if (!data) return [];
    return expanded ? data.top20 : data.top4;
  }, [data, expanded]);

  useEffect(() => {
    if (!selectedStateCode) return;
    if (!data) return;
    if (!mounted) return;

    let cancelled = false;

    const run = async () => {
      const currentThumbs = thumbsRef.current;
      const missing = displayedBirds.filter(
        (b) => !(b.speciesCode in currentThumbs) && !requestedRef.current.has(b.speciesCode)
      );
      if (missing.length === 0) return;

      // Mark requested immediately to avoid duplicate parallel effects.
      for (const b of missing) requestedRef.current.add(b.speciesCode);

      // Fetch sequentially with a small delay to reduce chances of hitting Wikimedia rate limits.
      for (const b of missing) {
        if (cancelled) return;
        try {
          const query = (b.commonName?.trim() || b.scientificName?.trim() || b.speciesCode).slice(0, 120);
          const r = await fetch(`/api/wiki-thumbnail?query=${encodeURIComponent(query)}`);
          if (!r.ok) throw new Error(`wiki-thumbnail failed: ${r.status}`);
          const json = (await r.json()) as { thumbnailUrl: string | null };
          const url = json.thumbnailUrl;
          if (cancelled) return;
          setThumbs((prev) => ({ ...prev, [b.speciesCode]: url }));
        } catch {
          if (cancelled) return;
          setThumbs((prev) => ({ ...prev, [b.speciesCode]: null }));
        }
        // Small spacing between birds; helps prevent bursts.
        await sleep(250);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedStateCode, data, expanded, displayedBirds, mounted]);

  useEffect(() => {
    // When switching states, reset thumbnails and requested set.
    requestedRef.current = new Set();
    setThumbs({});
  }, [selectedStateCode]);

  if (!selectedStateCode) {
    return (
      <aside className="w-full md:w-[360px] p-4 bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold mb-2">Bird Atlas</div>
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          Click a state on the map to see the top birds.
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-[420px] p-4 bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="font-semibold">Top birds in {selectedStateCode}</div>
          {data ? (
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              Ranking window: last {data.rankingWindow.backDays} days (approx.)
            </div>
          ) : null}
        </div>
        {loading ? <div className="text-xs text-zinc-600 dark:text-zinc-300">Loading...</div> : null}
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</div>
      ) : null}

      {loading || !data ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-300">Fetching ranked birds...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            {(expanded ? data.top20 : data.top4).map((b) => (
              <div
                key={b.speciesCode}
                className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    {mounted && thumbs[b.speciesCode] ? (
                      // Wikimedia thumbnails are regular image URLs; no special Next config required.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbs[b.speciesCode] as string}
                        alt={b.commonName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded bg-zinc-300 dark:bg-zinc-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.commonName}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">{b.scientificName}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              Showing {expanded ? data.top20.length : data.top4.length} birds
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="px-3 py-2 rounded-md text-sm font-medium bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
            >
              {expanded ? "Show less" : "See more"}
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

