'use client';

import React, { useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import { feature as topoFeature } from "topojson-client";
import usStatesTopo from "us-atlas/states-10m.json";

export type UsMapProps = {
  selectedStateCode?: string | null;
  onStateSelected: (stateCode: string) => void;
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

export default function UsMap({ selectedStateCode, onStateSelected }: UsMapProps) {
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const usStatesGeoJson = useMemo(() => {
    // Convert TopoJSON to GeoJSON. `states-10m.json` stores state polygons under `objects.states`.
    const topo = usStatesTopo as unknown as { objects: { states: unknown } };
    return topoFeature(topo as unknown, topo.objects.states) as unknown;
  }, []);

  if (!mounted) return null;

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
          data={usStatesGeoJson as unknown as GeoJSON.GeoJsonObject}
          style={(feature: unknown) => {
            const props = (feature as { properties?: UsAtlasProperties }).properties;
            const stateCode = toStateCode(props?.name);
            return stateCode && stateCode === selectedStateCode ? selectedStyle : defaultStyle;
          }}
          onEachFeature={(feature: unknown, layer: L.Layer) => {
            const props = (feature as { properties?: UsAtlasProperties }).properties;
            const stateCode = toStateCode(props?.name);
            if (!stateCode) return;

            const pathLayer = layer as L.Path;
            layer.on({
              click: () => onStateSelected(stateCode),
              mouseover: () => {
                const isSelected = stateCode === selectedStateCode;
                pathLayer.setStyle(isSelected ? hoverSelectedStyle : hoverStyle);
                const el = pathLayer.getElement?.();
                if (el instanceof HTMLElement) el.style.cursor = "pointer";
              },
              mouseout: () => {
                const style = stateCode === selectedStateCode ? selectedStyle : defaultStyle;
                pathLayer.setStyle(style);
              },
            });
          }}
        />
      </MapContainer>
    </div>
  );
}

