export type BirdRank = {
  speciesCode: string;
  commonName: string;
  scientificName: string;
  score: number;
};

/** Response shape for GET /api/state-birds/[stateCode] */
export type StateBirdsResponse = {
  stateCode: string;
  rankingWindow: {
    /** eBird `back` parameter (days). */
    backDays: number;
    /** Short description for UI. */
    label: string;
  };
  metric: {
    id: "recent_non_exotic_abundance_v1";
    /** How `score` is computed per species. */
    scoreDescription: string;
    /** What we filter out using eBird checklist fields. */
    nonExoticFilterDescription: string;
    /** Clarifies limits vs “native range” biogeography. */
    nativityNote: string;
  };
  top4: BirdRank[];
  top20: BirdRank[];
};
