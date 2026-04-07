'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { StateBirdsResponse } from "@/types/state-birds";

export type BirdPanelProps = {
  selectedStateCode: string | null;
  onSpeciesSelected?: (speciesCode: string, commonName: string) => void;
  activeSpeciesCode?: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function BirdPanel({ selectedStateCode, onSpeciesSelected, activeSpeciesCode }: BirdPanelProps) {
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
      <aside className="w-full md:w-[360px] h-full p-4 bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold mb-2">Bird Atlas</div>
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          Click a state for ranked recent non-exotic sightings (eBird).
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-[420px] h-full flex flex-col bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="p-4 pb-2 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="font-semibold">Top non-exotic sightings · {selectedStateCode}</div>
            {data ? (
              <>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                  {data.rankingWindow.label}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">{data.metric.scoreDescription}</p>
                <details className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                  <summary className="cursor-pointer select-none">About non-exotic vs native range</summary>
                  <p className="mt-2 pl-0">{data.metric.nonExoticFilterDescription}</p>
                  <p className="mt-1">{data.metric.nativityNote}</p>
                </details>
              </>
            ) : null}
          </div>
          {loading ? <div className="text-xs text-zinc-600 dark:text-zinc-300">Loading...</div> : null}
        </div>

        {error ? (
          <div className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</div>
        ) : null}
      </div>

      {loading || !data ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-300 px-4 pb-4">Fetching ranked birds...</div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-4">
            <div className="grid grid-cols-1 gap-2">
              {(expanded ? data.top20 : data.top4).map((b) => {
                const isActive = activeSpeciesCode === b.speciesCode;
                return (
                  <div
                    key={b.speciesCode}
                    className={
                      "p-3 rounded-md border " +
                      (isActive
                        ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700"
                        : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        {mounted && thumbs[b.speciesCode] ? (
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
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{b.commonName}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">{b.scientificName}</div>
                      </div>
                      {onSpeciesSelected && (
                        <button
                          type="button"
                          onClick={() => onSpeciesSelected(b.speciesCode, b.commonName)}
                          className={
                            "shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors " +
                            (isActive
                              ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800")
                          }
                          title="See which states recently reported this species on the map"
                        >
                          {isActive ? "Viewing" : "Where?"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 pt-3 shrink-0 flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
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
