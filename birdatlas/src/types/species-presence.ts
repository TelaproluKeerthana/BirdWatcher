export type SpeciesPresenceEntry = {
  stateCode: string;
  totalCount: number;
  observationCount: number;
};

/** Response shape for GET /api/species-presence/[speciesCode] */
export type SpeciesPresenceResponse = {
  speciesCode: string;
  commonName: string;
  scientificName: string;
  backDays: number;
  label: string;
  note: string;
  states: SpeciesPresenceEntry[];
};
