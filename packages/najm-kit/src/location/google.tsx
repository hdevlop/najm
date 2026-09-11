"use client";

import React from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { cn } from "../lib/cn";
import { locationMarkerUrl } from "./locationMarker";
import type { GoogleLocationAdapterOptions, NLocationCandidate, NLocationGeocoderAdapter, NLocationMapAdapter, NLocationMapProps } from "./types";

let configuredKey: string | null = null;

function configure(options: GoogleLocationAdapterOptions) {
  if (configuredKey && configuredKey !== options.apiKey) throw new Error("Google Maps is already configured");
  if (!configuredKey) {
    setOptions({
      key: options.apiKey,
      v: "weekly",
      language: options.language,
      region: options.region,
      authReferrerPolicy: "origin",
      mapIds: options.mapId ? [options.mapId] : undefined,
    });
    configuredKey = options.apiKey;
  }
}

function createMarkerContent() {
  const image = document.createElement("img");
  image.src = locationMarkerUrl;
  image.alt = "";
  image.width = 40;
  image.height = 50;
  image.draggable = false;
  image.setAttribute("aria-hidden", "true");
  return image;
}

function createMapComponent(options: GoogleLocationAdapterOptions) {
  return function GoogleLocationMap({ value, initialCenter, initialZoom, onChange, onReady, onLoadingChange, onError, onControlsReady, reducedMotion, className }: NLocationMapProps) {
    const elementRef = React.useRef<HTMLDivElement>(null);
    const mapRef = React.useRef<google.maps.Map | null>(null);
    const markerRef = React.useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const setMarkerRef = React.useRef<((latitude: number, longitude: number) => void) | null>(null);
    const onChangeRef = React.useRef(onChange);
    const valueRef = React.useRef(value);
    onChangeRef.current = onChange;
    valueRef.current = value;

    React.useEffect(() => {
      let active = true;
      let listeners: google.maps.MapsEventListener[] = [];
      onLoadingChange?.(true);
      void (async () => {
        try {
          configure(options);
          const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([importLibrary("maps"), importLibrary("marker")]);
          if (!active || !elementRef.current) return;
          const currentValue = valueRef.current;
          const center = currentValue ?? initialCenter;
          const map = new Map(elementRef.current, {
            center: { lat: center.latitude, lng: center.longitude },
            zoom: initialZoom,
            mapId: options.mapId ?? "DEMO_MAP_ID",
            disableDefaultUI: true,
            clickableIcons: false,
            gestureHandling: "greedy",
          });
          const setMarker = (latitude: number, longitude: number) => {
            if (!markerRef.current) {
              const marker = new AdvancedMarkerElement({ map, position: { lat: latitude, lng: longitude }, content: createMarkerContent(), gmpDraggable: true, title: "Selected location" });
              listeners.push(marker.addListener("dragend", () => {
                const position = marker.position;
                const lat = typeof position?.lat === "function" ? position.lat() : position?.lat;
                const lng = typeof position?.lng === "function" ? position.lng() : position?.lng;
                if (typeof lat === "number" && typeof lng === "number") onChangeRef.current({ latitude: lat, longitude: lng });
              }));
              markerRef.current = marker;
            } else markerRef.current.position = { lat: latitude, lng: longitude };
          };
          setMarkerRef.current = setMarker;
          if (currentValue) setMarker(currentValue.latitude, currentValue.longitude);
          listeners.push(map.addListener("click", (event: google.maps.MapMouseEvent) => {
            const point = event.latLng;
            if (!point) return;
            setMarker(point.lat(), point.lng());
            onChangeRef.current({ latitude: point.lat(), longitude: point.lng() });
          }));
          mapRef.current = map;
          onControlsReady?.({
            zoomIn: () => map.setZoom((map.getZoom() ?? initialZoom) + 1),
            zoomOut: () => map.setZoom((map.getZoom() ?? initialZoom) - 1),
            recenter: (point) => map.panTo({ lat: point.latitude, lng: point.longitude }),
          });
          onLoadingChange?.(false);
          onReady?.();
        } catch {
          if (!active) return;
          onLoadingChange?.(false);
          onError?.(new Error("Google map unavailable"));
        }
      })();
      return () => {
        active = false;
        listeners.forEach((listener) => listener.remove());
        listeners = [];
        if (markerRef.current) markerRef.current.map = null;
        markerRef.current = null;
        setMarkerRef.current = null;
        mapRef.current = null;
        onControlsReady?.(null);
      };
    // One map and one official loader configuration per mounted adapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
      if (!value && markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      } else if (value && mapRef.current) {
        setMarkerRef.current?.(value.latitude, value.longitude);
        mapRef.current.panTo({ lat: value.latitude, lng: value.longitude });
      }
    }, [value]);

    return <div ref={elementRef} data-location-map="google" className={cn("absolute inset-0 z-0 h-full min-h-72 w-full", reducedMotion && "[&_*]:!transition-none", className)} />;
  };
}

export function createGoogleLocationAdapter(options: GoogleLocationAdapterOptions): NLocationMapAdapter {
  return { id: "google", Map: createMapComponent(options) };
}

export function createGooglePlacesGeocoder(options: GoogleLocationAdapterOptions): NLocationGeocoderAdapter {
  let token: google.maps.places.AutocompleteSessionToken | null = null;
  const predictions = new Map<string, google.maps.places.PlacePrediction>();
  return {
    id: "google-places",
    async search(query, context) {
      if (context.signal.aborted) return [];
      configure(options);
      const { AutocompleteSessionToken, AutocompleteSuggestion } = await importLibrary("places");
      token ??= new AutocompleteSessionToken();
      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: token,
        language: context.language,
        locationBias: { lat: context.center.latitude, lng: context.center.longitude },
      });
      if (context.signal.aborted) return [];
      predictions.clear();
      return response.suggestions.flatMap((suggestion): NLocationCandidate[] => {
        const prediction = suggestion.placePrediction;
        if (!prediction) return [];
        predictions.set(prediction.placeId, prediction);
        return [{ id: prediction.placeId, providerId: prediction.placeId, label: prediction.mainText?.toString() ?? prediction.text.toString(), description: prediction.secondaryText?.toString() }];
      });
    },
    async resolve(candidate, signal) {
      const prediction = predictions.get(candidate.providerId ?? candidate.id);
      if (!prediction) throw new Error("Place prediction expired");
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location", "displayName"] });
      token = null;
      predictions.clear();
      if (signal.aborted || !place.location) throw new DOMException("Aborted", "AbortError");
      return {
        ...candidate,
        label: place.formattedAddress || place.displayName || candidate.label,
        coordinates: { latitude: place.location.lat(), longitude: place.location.lng() },
      };
    },
    async reverse(coordinates, signal) {
      configure(options);
      const { Geocoder } = await importLibrary("geocoding");
      if (signal.aborted) return null;
      const response = await new Geocoder().geocode({
        location: { lat: coordinates.latitude, lng: coordinates.longitude },
      });
      if (signal.aborted || !response.results[0]) return null;
      const result = response.results[0];
      return {
        id: result.place_id,
        providerId: result.place_id,
        label: result.formatted_address,
        coordinates,
      };
    },
    resetSession() {
      token = null;
      predictions.clear();
    },
  };
}
