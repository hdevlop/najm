import type { ComponentType, ReactNode } from "react";
import type { FormInputBackground } from "../components/form/types";
import type { FormSlotClassNames } from "../components/form/VariantContext";

export interface NCoordinates {
  latitude: number;
  longitude: number;
}

export interface NLocationValue {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Optional provider-owned identity for a committed location selection.
 *
 * Kept separate from `NLocationValue` so provider-neutral applications never
 * persist Google-specific state. Applications that already store a Place ID
 * can bind it through `providerMeta`/`onProviderMetaChange` without copying the
 * map or search dialog.
 */
export interface NLocationProviderSelectionMeta {
  provider: "google";
  placeId: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface NLocationCandidate {
  id: string;
  label: string;
  description?: string;
  coordinates?: NCoordinates;
  providerId?: string;
}

export interface NLocationSearchContext {
  signal: AbortSignal;
  center: NCoordinates;
  language?: string;
}

export interface NLocationGeocoderAdapter {
  id: string;
  search(query: string, context: NLocationSearchContext): Promise<readonly NLocationCandidate[]>;
  resolve?(candidate: NLocationCandidate, signal: AbortSignal): Promise<NLocationCandidate>;
  reverse?(coordinates: NCoordinates, signal: AbortSignal): Promise<NLocationCandidate | null>;
  resetSession?(): void;
}

export interface NLocationMapControls {
  zoomIn(): void;
  zoomOut(): void;
  recenter(coordinates: NCoordinates): void;
}

export interface NLocationMapProps {
  value: NCoordinates | null;
  initialCenter: NCoordinates;
  initialZoom: number;
  onChange: (coordinates: NCoordinates) => void;
  onReady?: () => void;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (error: Error) => void;
  onControlsReady?: (controls: NLocationMapControls | null) => void;
  reducedMotion?: boolean;
  className?: string;
}

export interface NLocationMapAdapter {
  id: string;
  Map: ComponentType<NLocationMapProps>;
}

export interface NLocationLabels {
  dialogTitle: string;
  dialogDescription: string;
  openMap: string;
  close: string;
  cancel: string;
  confirm: string;
  clearPin: string;
  searchPlaceholder: string;
  search: string;
  searching: string;
  searchEmpty: string;
  searchError: string;
  findingAddress: string;
  selected: string;
  notSelected: string;
  changedAfterPin: string;
  loading: string;
  unavailable: string;
  retry: string;
  currentLocation: string;
  zoomIn: string;
  zoomOut: string;
  mapInstructions: string;
  readyAnnouncement: string;
  selectedAnnouncement: string;
  addressUpdatedAnnouncement: string;
  clearedAnnouncement: string;
  geolocationUnsupported: string;
  geolocationDenied: string;
  geolocationTimeout: string;
  geolocationUnavailable: string;
  providerError: string;
  resultsAnnouncement: (count: number) => string;
}

export interface NLocationClassNames {
  root?: string;
  input?: string;
  status?: string;
  dialog?: string;
  search?: string;
  map?: string;
  footer?: string;
}

export interface NLocationProviderProps {
  children: ReactNode;
  adapter?: NLocationMapAdapter | null;
  geocoder?: NLocationGeocoderAdapter | null;
  defaultCenter?: NCoordinates;
  defaultZoom?: number;
  labels?: Partial<NLocationLabels>;
  searchMode?: "submit" | "autocomplete";
  unavailableReason?: string;
}

export interface NLocationDialogProps {
  open: boolean;
  value: NLocationValue;
  providerMeta?: NLocationProviderSelectionMeta | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    value: NLocationValue,
    providerMeta?: NLocationProviderSelectionMeta | null,
  ) => void;
  labels?: Partial<NLocationLabels>;
  classNames?: NLocationClassNames;
}

export interface NLocationInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className"> {
  value: NLocationValue;
  onChange: (value: NLocationValue) => void;
  /** Provider identity stored separately from the common location value. */
  providerMeta?: NLocationProviderSelectionMeta | null;
  /**
   * Called atomically with a location update. Manual address edits and pin
   * clears pass `null`, preventing a stale Place ID from surviving a change.
   */
  onProviderMetaChange?: (providerMeta: NLocationProviderSelectionMeta | null) => void;
  labels?: Partial<NLocationLabels>;
  classNames?: NLocationClassNames;
  status?: "default" | "error";
  bordered?: boolean;
  className?: string;
}

export interface FormLocationInputProps extends Omit<NLocationInputProps, "value" | "onChange" | "status"> {
  name: string;
  formLabel?: ReactNode;
  formDescription?: ReactNode;
  required?: boolean;
  hidden?: boolean;
  background?: FormInputBackground;
  classNames?: NLocationClassNames & FormSlotClassNames;
  onChange?: (value: NLocationValue) => void;
}

export interface LeafletLocationAdapterOptions {
  tileUrl: string;
  attribution: string;
  tileOptions?: { maxZoom?: number; minZoom?: number };
}

export interface GoogleLocationAdapterOptions {
  apiKey: string;
  mapId?: string;
  language?: string;
  region?: string;
}
