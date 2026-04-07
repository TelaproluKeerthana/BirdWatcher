'use client';

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import BirdPanel from "@/components/BirdPanel";
import type { SpeciesPresenceResponse } from "@/types/species-presence";

const UsMap = dynamic(() => import("@/components/UsMap"), { ssr: false });

export default function Home() {
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);

  const [selectedSpecies, setSelectedSpecies] = useState<{
    speciesCode: string;
    commonName: string;
  } | null>(null);
  const [presenceData, setPresenceData] = useState<SpeciesPresenceResponse | null>(null);
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [presenceError, setPresenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSpecies) {
      setPresenceData(null);
      setPresenceError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setPresenceLoading(true);
      setPresenceError(null);

      try {
        const r = await fetch(
          `/api/species-presence/${encodeURIComponent(selectedSpecies.speciesCode)}`
        );
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(text || `Request failed: ${r.status}`);
        }
        const json = (await r.json()) as SpeciesPresenceResponse;
        if (!cancelled) setPresenceData(json);
      } catch (e: unknown) {
        if (!cancelled)
          setPresenceError(e instanceof Error ? e.message : "Failed to load presence data.");
      } finally {
        if (!cancelled) setPresenceLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedSpecies]);

  const speciesPresence = useMemo(() => {
    if (!presenceData) return null;
    const map: Record<string, number> = {};
    for (const s of presenceData.states) {
      map[s.stateCode] = s.totalCount;
    }
    return map;
  }, [presenceData]);

  const handleSpeciesSelected = (speciesCode: string, commonName: string) => {
    if (selectedSpecies?.speciesCode === speciesCode) {
      setSelectedSpecies(null);
    } else {
      setSelectedSpecies({ speciesCode, commonName });
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="font-semibold mb-1">Bird Atlas</div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 max-w-xl">
          Recent non-exotic bird sightings by state (eBird). This is not a strict &quot;native species of
          the state&quot; list&mdash;see the panel for how ranking works.
        </p>

        {/* Presence overlay banner */}
        {selectedSpecies && (
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100 truncate">
                Recent presence: {presenceData?.commonName ?? selectedSpecies.commonName}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300">
                {presenceLoading
                  ? "Loading..."
                  : presenceError
                    ? presenceError
                    : presenceData
                      ? `${presenceData.label} \u00b7 ${presenceData.note}`
                      : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSpecies(null)}
              className="shrink-0 px-2 py-1 rounded text-xs font-medium text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900"
            >
              Close
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 lg:h-[520px]">
          <section className="flex-1 h-[520px] lg:h-full">
            <UsMap
              selectedStateCode={selectedStateCode}
              onStateSelected={setSelectedStateCode}
              speciesPresence={speciesPresence}
            />
          </section>

          <section className="h-[520px] lg:h-full">
            <BirdPanel
              selectedStateCode={selectedStateCode}
              onSpeciesSelected={handleSpeciesSelected}
              activeSpeciesCode={selectedSpecies?.speciesCode ?? null}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
