"use client";

import React from "react";
import { DEFAULT_LOCATION_LABELS } from "./labels";
import type { NCoordinates, NLocationLabels, NLocationProviderProps } from "./types";

const DEFAULT_CENTER: NCoordinates = { latitude: 33.5731, longitude: -7.5898 };

interface NLocationContextValue {
  adapter: NLocationProviderProps["adapter"];
  geocoder: NLocationProviderProps["geocoder"];
  defaultCenter: NCoordinates;
  defaultZoom: number;
  labels: NLocationLabels;
  searchMode: "submit" | "autocomplete";
  unavailableReason?: string;
}

const NLocationContext = React.createContext<NLocationContextValue | null>(null);

export function NLocationProvider({
  children,
  adapter = null,
  geocoder = null,
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = 12,
  labels,
  searchMode = "submit",
  unavailableReason,
}: NLocationProviderProps) {
  const value = React.useMemo<NLocationContextValue>(() => ({
    adapter,
    geocoder,
    defaultCenter,
    defaultZoom,
    labels: { ...DEFAULT_LOCATION_LABELS, ...labels },
    searchMode,
    unavailableReason,
  }), [adapter, defaultCenter, defaultZoom, geocoder, labels, searchMode, unavailableReason]);
  return <NLocationContext.Provider value={value}>{children}</NLocationContext.Provider>;
}

export function useNLocationProvider(): NLocationContextValue {
  const value = React.useContext(NLocationContext);
  if (!value) {
    return {
      adapter: null,
      geocoder: null,
      defaultCenter: DEFAULT_CENTER,
      defaultZoom: 12,
      labels: DEFAULT_LOCATION_LABELS,
      searchMode: "submit",
      unavailableReason: DEFAULT_LOCATION_LABELS.unavailable,
    };
  }
  return value;
}
