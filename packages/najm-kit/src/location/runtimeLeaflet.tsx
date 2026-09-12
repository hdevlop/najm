"use client";

import React from "react";
import { NLocationProvider } from "./provider";
import type { NLocationMapAdapter } from "./types";
import type {
  NDisabledLocationRuntimeConfig,
  NLeafletLocationRuntimeConfig,
  NLocationRuntimeProviderProps,
} from "./runtimeTypes";

export interface NLeafletLocationRuntimeProviderProps
  extends Omit<NLocationRuntimeProviderProps, "config"> {
  config: NDisabledLocationRuntimeConfig | NLeafletLocationRuntimeConfig;
}

/**
 * Leaflet-only runtime boundary for applications that intentionally do not
 * install or bundle the optional Google Maps loader.
 */
export function NLeafletLocationRuntimeProvider({
  children,
  config,
  geocoder = null,
  labels,
  searchMode,
  unavailableReason,
}: NLeafletLocationRuntimeProviderProps) {
  const adapter = React.useMemo<NLocationMapAdapter | null>(() => {
    if (config.provider === "disabled") return null;

    const options = config.leaflet;
    const Map = React.lazy(async () => {
      const { createLeafletLocationAdapter } = await import("./leaflet");
      return { default: createLeafletLocationAdapter(options).Map };
    });
    return { id: "leaflet", Map };
  }, [config]);

  return (
    <NLocationProvider
      adapter={adapter}
      geocoder={geocoder}
      defaultCenter={config.defaultCenter}
      defaultZoom={config.defaultZoom}
      labels={labels}
      searchMode={searchMode}
      unavailableReason={unavailableReason}
    >
      {children}
    </NLocationProvider>
  );
}

export type {
  NDisabledLocationRuntimeConfig,
  NLeafletLocationRuntimeConfig,
} from "./runtimeTypes";
