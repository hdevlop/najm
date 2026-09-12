import type { ReactNode } from "react";
import type {
  GoogleLocationAdapterOptions,
  LeafletLocationAdapterOptions,
  NCoordinates,
  NLocationGeocoderAdapter,
  NLocationLabels,
} from "./types";

interface NLocationRuntimeBaseConfig {
  defaultCenter: NCoordinates;
  defaultZoom: number;
}

export interface NDisabledLocationRuntimeConfig extends NLocationRuntimeBaseConfig {
  provider: "disabled";
}

export interface NLeafletLocationRuntimeConfig extends NLocationRuntimeBaseConfig {
  provider: "leaflet";
  leaflet: LeafletLocationAdapterOptions;
}

export interface NGoogleLocationRuntimeConfig extends NLocationRuntimeBaseConfig {
  provider: "google";
  google: GoogleLocationAdapterOptions;
}

/**
 * Serializable map configuration resolved on the server and passed through an
 * RSC boundary. It intentionally contains no geocoder function or server
 * secret. A Google browser key is public by design and must be restricted.
 */
export type NLocationRuntimeConfig =
  | NDisabledLocationRuntimeConfig
  | NLeafletLocationRuntimeConfig
  | NGoogleLocationRuntimeConfig;

export interface NLocationRuntimeProviderProps {
  children: ReactNode;
  config: NLocationRuntimeConfig;
  geocoder?: NLocationGeocoderAdapter | null;
  labels?: Partial<NLocationLabels>;
  searchMode?: "submit" | "autocomplete";
  unavailableReason?: string;
}
