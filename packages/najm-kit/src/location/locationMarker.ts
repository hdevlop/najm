import markerAsset from "./assets/location-marker.webp";

// tsup's data-url loader returns a string, while a Next.js source-alias import
// returns static-image metadata. Supporting both keeps Playground development
// and the published package on the same package-owned asset.
export const locationMarkerUrl = typeof markerAsset === "string"
  ? markerAsset
  : (markerAsset as unknown as { src: string }).src;
