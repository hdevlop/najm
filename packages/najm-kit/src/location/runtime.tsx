"use client";

import React from "react";
import { NLocationProvider } from "./provider";
import type { NLocationMapAdapter } from "./types";
import type { NLocationRuntimeProviderProps } from "./runtimeTypes";

function createRuntimeAdapter(
  config: NLocationRuntimeProviderProps["config"],
): NLocationMapAdapter | null {
  if (config.provider === "disabled") return null;

  if (config.provider === "leaflet") {
    const options = config.leaflet;
    const Map = React.lazy(async () => {
      const { createLeafletLocationAdapter } = await import("./leaflet");
      return { default: createLeafletLocationAdapter(options).Map };
    });
    return { id: "leaflet", Map };
  }

  const options = config.google;
  const Map = React.lazy(async () => {
    const { createGoogleLocationAdapter } = await import("./google");
    return { default: createGoogleLocationAdapter(options).Map };
  });
  return { id: "google", Map };
}

/**
 * Turns a serializable runtime configuration into the matching lazy map
 * adapter. Provider SDK code is not requested until the dialog renders its map.
 */
export function NLocationRuntimeProvider({
  children,
  config,
  geocoder = null,
  labels,
  searchMode,
  unavailableReason,
}: NLocationRuntimeProviderProps) {
  const adapter = React.useMemo(() => createRuntimeAdapter(config), [config]);

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
  NGoogleLocationRuntimeConfig,
  NLeafletLocationRuntimeConfig,
  NLocationRuntimeConfig,
  NLocationRuntimeProviderProps,
} from "./runtimeTypes";
