import type { NCoordinates, NLocationValue } from "./types";

export const DEFAULT_LOCATION_VALUE: NLocationValue = {
  address: "",
  latitude: null,
  longitude: null,
};

export function isCompleteCoordinatePair(value: Pick<NLocationValue, "latitude" | "longitude">): boolean {
  const { latitude, longitude } = value;
  return (
    typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
  );
}

export function normalizeLocationValue(value?: Partial<NLocationValue> | null): NLocationValue {
  const address = typeof value?.address === "string" ? value.address : "";
  if (!isCompleteCoordinatePair({ latitude: value?.latitude ?? null, longitude: value?.longitude ?? null })) {
    return { address, latitude: null, longitude: null };
  }
  return { address, latitude: value!.latitude!, longitude: value!.longitude! };
}

export function locationCoordinates(value: NLocationValue): NCoordinates | null {
  return isCompleteCoordinatePair(value)
    ? { latitude: value.latitude!, longitude: value.longitude! }
    : null;
}

export function moveCoordinates(value: NCoordinates, latitudeDelta: number, longitudeDelta: number): NCoordinates {
  return {
    latitude: Math.max(-90, Math.min(90, value.latitude + latitudeDelta)),
    longitude: Math.max(-180, Math.min(180, value.longitude + longitudeDelta)),
  };
}
