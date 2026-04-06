'use client';

import React, { useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import { feature as topoFeature } from "topojson-client";
import usStatesTopo from "us-atlas/states-10m.json";

export type UsMapProps = {
  selectedStateCode?: string | null;
  onStateSelected: (stateCode: string) => void;
  /** stateCode -> totalCount; when provided the map shows a presence choropleth. */
  speciesPresence?: Record<string, number> | null;
};

// US state name -> 2-letter abbreviation (matches eBird region codes: "US-XX").
const stateNameToAbbr: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

const toStateCode = (stateName: string | undefined): string | null => {
  if (!stateName) return null;
  const abbr = stateNameToAbbr[stateName];
  return abbr ? `US-${abbr}` : null;
};

type UsAtlasProperties = { name?: string };

const defaultStyle: L.PathOptions = {
  weight: 1,
  color: "#4b5563",
  fillColor: "#e5e7eb",
  fillOpacity: 0.9,
};

const selectedStyle: L.PathOptions = {
  weight: 2,
  color: "#111827",
  fillColor: "#2563eb",
  fillOpacity: 0.95,
};

/** Highlight when pointer is over a state (not the same as selected). */
const hoverStyle: L.PathOptions = {
  weight: 2,
  color: "#b45309",
  fillColor: "#fcd34d",
  fillOpacity: 0.9,
};

/** Slightly brighter blue when hovering the already-selected state. */
const hoverSelectedStyle: L.PathOptions = {
  weight: 3,
  color: "#1e3a8a",
  fillColor: "#3b82f6",
  fillOpacity: 0.98,
};

/** Dimmed style for states with no reports when presence choropleth is active. */
const noPresenceStyle: L.PathOptions = {
  weight: 1,
  color: "#d1d5db",
  fillColor: "#f9fafb",
  fillOpacity: 0.5,
};

function presenceStyle(count: number, maxCount: number): L.PathOptions {
  const t = Math.min(count / Math.max(maxCount, 1), 1);
  return {
    weight: 1,
    color: "#166534",
    fillColor: "#16a34a",
    fillOpacity: 0.25 + 0.65 * t,
  };
}

export default function UsMap({ selectedStateCode, onStateSelected, speciesPresence }: UsMapProps) {
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const usStatesGeoJson = useMemo(() => {
    const topo = usStatesTopo as unknown as { objects: { states: unknown } };
    return topoFeature(topo as unknown, topo.objects.states) as unknown;
  }, []);

  const maxPresenceCount = useMemo(() => {
    if (!speciesPresence) return 0;
    const vals = Object.values(speciesPresence);
    return vals.length > 0 ? Math.max(...vals) : 0;
  }, [speciesPresence]);

  // Force GeoJSON re-mount when visual state changes so styles + handlers re-bind.
  const geoKey = useMemo(() => {
    const sel = selectedStateCode ?? "none";
    const pres = speciesPresence ? Object.keys(speciesPresence).sort().join(",") : "off";
    return `${sel}_${pres}`;
  }, [selectedStateCode, speciesPresence]);

  if (!mounted) return null;

  const getBaseStyle = (stateCode: string | null): L.PathOptions => {
    if (stateCode && stateCode === selectedStateCode) return selectedStyle;
    if (speciesPresence) {
      if (stateCode && stateCode in speciesPresence) {
        return presenceStyle(speciesPresence[stateCode], maxPresenceCount);
      }
      return noPresenceStyle;
    }
    return defaultStyle;
  };

  return (
    <div className="w-full h-[520px] rounded-lg overflow-hidden">
      <MapContainer
        center={[37.8, -96]}
        zoom={4.2}
        scrollWheelZoom={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

        <GeoJSON
          key={geoKey}
          data={usStatesGeoJson as unknown as GeoJSON.GeoJsonObject}
          style={(feature: unknown) => {
            const props = (feature as { properties?: UsAtlasProperties }).properties;
            return getBaseStyle(toStateCode(props?.name));
          }}
          onEachFeature={(feature: unknown, layer: L.Layer) => {
            const props = (feature as { properties?: UsAtlasProperties }).properties;
            const stateCode = toStateCode(props?.name);
            if (!stateCode) return;

            const pathLayer = layer as L.Path;

            if (speciesPresence && stateCode in speciesPresence) {
              const count = speciesPresence[stateCode];
              pathLayer.bindTooltip(`${props?.name}: ${count.toLocaleString()} reported`, {
                sticky: true,
              });
            }

            layer.on({
              click: () => onStateSelected(stateCode),
              mouseover: () => {
                const isSelected = stateCode === selectedStateCode;
                pathLayer.setStyle(isSelected ? hoverSelectedStyle : hoverStyle);
                const el = pathLayer.getElement?.();
                if (el instanceof HTMLElement) el.style.cursor = "pointer";
              },
              mouseout: () => {
                pathLayer.setStyle(getBaseStyle(stateCode));
              },
            });
          }}
        />
      </MapContainer>
    </div>
  );
}
