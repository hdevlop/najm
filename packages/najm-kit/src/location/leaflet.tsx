"use client";

import React from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "../lib/cn";
import { locationMarkerUrl } from "./locationMarker";
import type { LeafletLocationAdapterOptions, NLocationMapAdapter, NLocationMapProps } from "./types";

let leafletPromise: Promise<typeof import("leaflet")> | null = null;

function loadLeaflet() {
  leafletPromise ??= import("leaflet");
  return leafletPromise;
}

function createMapComponent(options: LeafletLocationAdapterOptions) {
  return function LeafletLocationMap({ value, initialCenter, initialZoom, onChange, onReady, onLoadingChange, onError, onControlsReady, reducedMotion, className }: NLocationMapProps) {
    const elementRef = React.useRef<HTMLDivElement>(null);
    const mapRef = React.useRef<Leaflet.Map | null>(null);
    const markerRef = React.useRef<Leaflet.Marker | null>(null);
    const setMarkerRef = React.useRef<((latitude: number, longitude: number) => void) | null>(null);
    const onChangeRef = React.useRef(onChange);
    const valueRef = React.useRef(value);
    onChangeRef.current = onChange;
    valueRef.current = value;

    React.useEffect(() => {
      const element = elementRef.current;
      if (!element || mapRef.current) return;

      let active = true;
      let map: Leaflet.Map | null = null;
      let resizeFrame: number | null = null;
      let resizeObserver: ResizeObserver | null = null;
      const settleTimers: number[] = [];

      const scheduleResize = () => {
        if (!active || !map) return;
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          if (!active || !map || mapRef.current !== map || !element.isConnected) return;
          map.invalidateSize({ animate: false, pan: false });
        });
      };

      onLoadingChange?.(true);
      void (async () => {
        try {
          const L = await loadLeaflet();
          if (!active || !element.isConnected) return;
          const currentValue = valueRef.current;
          const center = currentValue ?? initialCenter;
          const markerIcon = L.icon({
            iconUrl: locationMarkerUrl,
            iconSize: [40, 50],
            iconAnchor: [20, 46],
          });
          map = L.map(element, {
            center: [center.latitude, center.longitude],
            zoom: initialZoom,
            zoomControl: false,
            attributionControl: true,
            keyboard: false,
            fadeAnimation: !reducedMotion,
            zoomAnimation: !reducedMotion,
            markerZoomAnimation: !reducedMotion,
          });
          mapRef.current = map;
          map.attributionControl.setPrefix(false);
          map.attributionControl.setPosition("topright");
          L.tileLayer(options.tileUrl, {
            attribution: options.attribution,
            maxZoom: options.tileOptions?.maxZoom ?? 19,
            minZoom: options.tileOptions?.minZoom ?? 1,
          }).addTo(map);
          const setMarker = (latitude: number, longitude: number) => {
            if (!map) return;
            if (!markerRef.current) {
              const marker = L.marker([latitude, longitude], { draggable: true, icon: markerIcon }).addTo(map);
              marker.on("dragend", () => {
                const point = marker.getLatLng();
                onChangeRef.current({ latitude: point.lat, longitude: point.lng });
              });
              markerRef.current = marker;
            } else {
              markerRef.current.setLatLng([latitude, longitude]);
            }
          };
          setMarkerRef.current = setMarker;
          if (currentValue) setMarker(currentValue.latitude, currentValue.longitude);
          map.on("click", (event: Leaflet.LeafletMouseEvent) => {
            setMarker(event.latlng.lat, event.latlng.lng);
            onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
          });
          onControlsReady?.({
            zoomIn: () => active && mapRef.current === map && map?.zoomIn(),
            zoomOut: () => active && mapRef.current === map && map?.zoomOut(),
            recenter: (point) => {
              if (active && mapRef.current === map) {
                map?.setView([point.latitude, point.longitude], map.getZoom(), { animate: !reducedMotion });
              }
            },
          });

          if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(scheduleResize);
            resizeObserver.observe(element);
          }
          window.addEventListener("resize", scheduleResize);
          scheduleResize();
          for (const delay of [80, 200, 400]) {
            settleTimers.push(window.setTimeout(scheduleResize, delay));
          }

          onLoadingChange?.(false);
          onReady?.();
        } catch {
          if (!active) return;
          active = false;
          if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
          settleTimers.forEach((timer) => window.clearTimeout(timer));
          resizeObserver?.disconnect();
          window.removeEventListener("resize", scheduleResize);
          map?.off();
          map?.remove();
          map = null;
          mapRef.current = null;
          setMarkerRef.current = null;
          onLoadingChange?.(false);
          onError?.(new Error("Leaflet map unavailable"));
        }
      })();
      return () => {
        active = false;
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        settleTimers.forEach((timer) => window.clearTimeout(timer));
        resizeObserver?.disconnect();
        window.removeEventListener("resize", scheduleResize);
        onControlsReady?.(null);
        markerRef.current?.off();
        markerRef.current = null;
        setMarkerRef.current = null;
        map?.off();
        map?.remove();
        mapRef.current = null;
      };
    // The adapter owns one map instance for its mounted lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      if (!value) {
        if (markerRef.current) {
          markerRef.current.off();
          markerRef.current.removeFrom(map);
          markerRef.current = null;
        }
        return;
      }
      setMarkerRef.current?.(value.latitude, value.longitude);
      map.setView([value.latitude, value.longitude], map.getZoom(), { animate: !reducedMotion });
    }, [reducedMotion, value]);

    return (
      <div
        ref={elementRef}
        data-location-map="leaflet"
        className={cn("nlocation-leaflet absolute inset-0 z-0 h-full w-full", className)}
      />
    );
  };
}

export function createLeafletLocationAdapter(options: LeafletLocationAdapterOptions): NLocationMapAdapter {
  return { id: "leaflet", Map: createMapComponent(options) };
}
