"use client";

import React from "react";
import { Check, Crosshair, LoaderCircle, Minus, Search, Trash2, X, Plus } from "lucide-react";
import { Button } from "../components/Button";
import { NLoadingState } from "../components/feedback/NLoadingState";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import { IconButton } from "../components/ui/icon-button";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";
import { isCompleteCoordinatePair, locationCoordinates, moveCoordinates, normalizeLocationValue } from "./contracts";
import { useNLocationProvider } from "./provider";
import type { NLocationCandidate, NLocationDialogProps, NLocationLabels, NLocationMapControls } from "./types";
import { useLocationDraft } from "./useLocationDraft";

const SEARCH_DELAY_MS = 350;

function geolocationMessage(error: GeolocationPositionError, labels: NLocationLabels) {
  if (error.code === error.PERMISSION_DENIED) return labels.geolocationDenied;
  if (error.code === error.TIMEOUT) return labels.geolocationTimeout;
  return labels.geolocationUnavailable;
}

export function NLocationDialog({ open, value, onOpenChange, onConfirm, labels: labelOverrides, classNames }: NLocationDialogProps) {
  const provider = useNLocationProvider();
  const labels = React.useMemo(() => ({ ...provider.labels, ...labelOverrides }), [labelOverrides, provider.labels]);
  const { draft, setDraft, discard } = useLocationDraft(value, open);
  const [announcement, setAnnouncement] = React.useState("");
  const [providerLoading, setProviderLoading] = React.useState(false);
  const [providerError, setProviderError] = React.useState<string | null>(null);
  const [providerAttempt, setProviderAttempt] = React.useState(0);
  const [mapControls, setMapControls] = React.useState<NLocationMapControls | null>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<readonly NLocationCandidate[]>([]);
  const [searchPerformed, setSearchPerformed] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState(false);
  const [reverseLoading, setReverseLoading] = React.useState(false);
  const searchAbort = React.useRef<AbortController | null>(null);
  const reverseAbort = React.useRef<AbortController | null>(null);
  const reverseRequest = React.useRef(0);
  const geoRequest = React.useRef(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const mapInstructionRef = React.useRef<HTMLDivElement>(null);
  const coordinates = locationCoordinates(draft);
  const coordinatesRef = React.useRef(coordinates);
  coordinatesRef.current = coordinates;
  const AdapterMap = provider.adapter?.Map;

  React.useEffect(() => {
    if (!open) {
      searchAbort.current?.abort();
      reverseAbort.current?.abort();
      reverseRequest.current += 1;
      provider.geocoder?.resetSession?.();
      geoRequest.current += 1;
      setProviderLoading(false);
      setSearchLoading(false);
      setReverseLoading(false);
      return;
    }
    setAnnouncement("");
    setProviderError(null);
    setResults([]);
    setQuery("");
    setSearchError(false);
    setSearchPerformed(false);
    setSearchLoading(false);
    setReverseLoading(false);
  }, [open, provider.geocoder]);

  const close = React.useCallback(() => {
    discard();
    onOpenChange(false);
  }, [discard, onOpenChange]);

  const updateCoordinates = React.useCallback((next: { latitude: number; longitude: number }) => {
    setDraft((current) => ({ ...current, ...next }));
    setAnnouncement(labels.selectedAnnouncement);

    if (!provider.geocoder?.reverse) return;
    reverseAbort.current?.abort();
    const controller = new AbortController();
    const request = ++reverseRequest.current;
    reverseAbort.current = controller;
    setReverseLoading(true);
    void provider.geocoder.reverse(next, controller.signal).then((candidate) => {
      if (controller.signal.aborted || request !== reverseRequest.current || !candidate?.label) return;
      setDraft((current) => ({ ...current, address: candidate.label }));
      setAnnouncement(labels.addressUpdatedAnnouncement);
    }).catch(() => {
      // Coordinates remain usable when optional reverse geocoding is unavailable.
    }).finally(() => {
      if (request === reverseRequest.current) setReverseLoading(false);
    });
  }, [labels.addressUpdatedAnnouncement, labels.selectedAnnouncement, provider.geocoder, setDraft]);

  const performSearch = React.useCallback(async (rawQuery: string) => {
    const nextQuery = rawQuery.trim();
    if (!provider.geocoder || nextQuery.length < 2) {
      setResults([]);
      return;
    }
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearchLoading(true);
    setSearchError(false);
    setSearchPerformed(false);
    try {
      const found = await provider.geocoder.search(nextQuery, {
        signal: controller.signal,
        center: coordinatesRef.current ?? provider.defaultCenter,
        language: document.documentElement.lang || undefined,
      });
      if (controller.signal.aborted) return;
      setResults(found);
      setSearchPerformed(true);
      setAnnouncement(labels.resultsAnnouncement(found.length));
    } catch {
      if (controller.signal.aborted) return;
      setResults([]);
      setSearchError(true);
      setSearchPerformed(true);
      setAnnouncement(labels.searchError);
    } finally {
      if (!controller.signal.aborted) setSearchLoading(false);
    }
  }, [labels, provider.defaultCenter, provider.geocoder]);

  React.useEffect(() => {
    if (!open || provider.searchMode !== "autocomplete" || !provider.geocoder || query.trim().length < 2) return;
    const timeout = setTimeout(() => void performSearch(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [open, performSearch, provider.geocoder, provider.searchMode, query]);

  const selectCandidate = async (candidate: NLocationCandidate) => {
    if (!provider.geocoder) return;
    reverseAbort.current?.abort();
    reverseRequest.current += 1;
    setReverseLoading(false);
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearchLoading(true);
    try {
      const resolved = candidate.coordinates
        ? candidate
        : provider.geocoder.resolve
          ? await provider.geocoder.resolve(candidate, controller.signal)
          : candidate;
      if (controller.signal.aborted || !resolved.coordinates) return;
      setDraft((current) => ({
        ...current,
        address: resolved.label || current.address,
        latitude: resolved.coordinates!.latitude,
        longitude: resolved.coordinates!.longitude,
      }));
      mapControls?.recenter(resolved.coordinates);
      setQuery("");
      setResults([]);
      setSearchPerformed(false);
      setAnnouncement(labels.selectedAnnouncement);
    } catch {
      if (!controller.signal.aborted) setSearchError(true);
    } finally {
      if (!controller.signal.aborted) setSearchLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setAnnouncement(labels.geolocationUnsupported);
      return;
    }
    const request = ++geoRequest.current;
    setProviderLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== geoRequest.current || !open) return;
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        updateCoordinates(next);
        mapControls?.recenter(next);
        setProviderLoading(false);
      },
      (error) => {
        if (request !== geoRequest.current || !open) return;
        setProviderLoading(false);
        setAnnouncement(geolocationMessage(error, labels));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const handleMapKeyDown = (event: React.KeyboardEvent) => {
    if (!coordinates || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.001 : 0.0001;
    const latitudeDelta = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
    const longitudeDelta = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    updateCoordinates(moveCoordinates(coordinates, latitudeDelta, longitudeDelta));
  };

  const clearPin = () => {
    reverseAbort.current?.abort();
    reverseRequest.current += 1;
    setReverseLoading(false);
    setDraft((current) => ({ ...current, latitude: null, longitude: null }));
    setAnnouncement(labels.clearedAnnouncement);
  };

  const confirm = () => {
    const normalized = normalizeLocationValue(draft);
    if ((draft.latitude !== null || draft.longitude !== null) && !isCompleteCoordinatePair(draft)) return;
    onConfirm(normalized);
    onOpenChange(false);
  };

  const pending = providerLoading || searchLoading || reverseLoading;
  const invalidPair = (draft.latitude !== null || draft.longitude !== null) && !isCompleteCoordinatePair(draft);

  return (
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : close()}>
      <DialogContent
        padding="none"
        hideClose
        overlayClassName="!z-[10010]"
        style={{ zIndex: 10020 }}
        className={cn(
          "nlocation-dialog !flex flex-col gap-0 inset-0 top-0 left-0 h-dvh max-h-dvh max-w-none translate-x-0 translate-y-0 rounded-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(46rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
          classNames?.dialog,
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          queueMicrotask(() => (provider.geocoder ? searchInputRef.current : mapInstructionRef.current)?.focus());
        }}
      >
        <DialogHeader className="shrink-0 flex-row items-start justify-between gap-4 border-b border-border px-4 py-4 text-start sm:px-6">
          <div className="min-w-0 space-y-1">
            <DialogTitle>{labels.dialogTitle}</DialogTitle>
            <DialogDescription>{labels.dialogDescription}</DialogDescription>
          </div>
          <DialogClose asChild>
            <IconButton aria-label={labels.close} variant="ghost" onClick={discard}><X /></IconButton>
          </DialogClose>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6">
          {provider.geocoder && (
            <form className={cn("relative shrink-0", classNames?.search)} onSubmit={(event) => { event.preventDefault(); void performSearch(query); }}>
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => {
                  searchAbort.current?.abort();
                  searchAbort.current = null;
                  setSearchLoading(false);
                  setQuery(event.target.value);
                  setResults([]);
                  setSearchError(false);
                  setSearchPerformed(false);
                }}
                placeholder={labels.searchPlaceholder}
                className="pe-24"
                autoComplete="off"
              />
              <Button type="submit" size="sm" variant="ghost" className="absolute end-1 top-1 h-7" disabled={searchLoading || query.trim().length < 2} leftIcon={Search}>
                {searchLoading ? labels.searching : labels.search}
              </Button>
              {(results.length > 0 || searchError || searchPerformed) && (
                <div className="absolute inset-x-0 top-full z-[60] mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
                  {searchError ? <p className="p-3 text-sm text-destructive">{labels.searchError}</p> : results.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">{labels.searchEmpty}</p>
                  ) : (
                    <div role="listbox" aria-label={labels.searchPlaceholder} className="max-h-52 overflow-y-auto p-1">
                      {results.map((candidate) => (
                        <button key={candidate.id} type="button" role="option" aria-selected="false" className="flex w-full flex-col rounded-sm px-3 py-2 text-start text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => void selectCandidate(candidate)}>
                          <span className="font-medium">{candidate.label}</span>
                          {candidate.description && <span className="text-xs text-muted-foreground">{candidate.description}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          )}

          <div
            ref={mapInstructionRef}
            tabIndex={0}
            role="application"
            aria-label={labels.mapInstructions}
            onKeyDown={handleMapKeyDown}
            className={cn("relative min-h-72 flex-1 overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", classNames?.map)}
          >
            {AdapterMap ? (
              <React.Suspense fallback={<NLoadingState surface="panel" label={labels.loading} className="h-full min-h-72" />}>
                <AdapterMap
                  key={providerAttempt}
                  value={coordinates}
                  initialCenter={provider.defaultCenter}
                  initialZoom={provider.defaultZoom}
                  onChange={updateCoordinates}
                  onReady={() => { setProviderLoading(false); setProviderError(null); setAnnouncement(labels.readyAnnouncement); }}
                  onLoadingChange={setProviderLoading}
                  onError={() => { setProviderLoading(false); setProviderError(labels.providerError); setAnnouncement(labels.providerError); }}
                  onControlsReady={setMapControls}
                  reducedMotion={typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches}
                  className="h-full min-h-72 w-full"
                />
              </React.Suspense>
            ) : (
              <div className="flex h-full min-h-72 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {provider.unavailableReason || labels.unavailable}
              </div>
            )}

            {providerError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/90 p-6 text-center">
                <p role="alert" className="text-sm text-destructive">{providerError}</p>
                <Button type="button" variant="outline" onClick={() => { setProviderError(null); setProviderAttempt((n) => n + 1); }}>{labels.retry}</Button>
              </div>
            )}

            <div className="absolute bottom-3 end-3 z-10 flex flex-col gap-1 rounded-md border border-border bg-card/95 p-1 shadow-sm">
              <IconButton aria-label={labels.zoomIn} onClick={() => mapControls?.zoomIn()} disabled={!mapControls}><Plus /></IconButton>
              <IconButton aria-label={labels.zoomOut} onClick={() => mapControls?.zoomOut()} disabled={!mapControls}><Minus /></IconButton>
              <IconButton aria-label={labels.currentLocation} onClick={useCurrentLocation} disabled={!AdapterMap || pending}><Crosshair /></IconButton>
            </div>

          </div>

          <label className="grid shrink-0 gap-1 text-sm font-medium">
            {labels.dialogTitle}
            <div className="relative">
              <Input
                value={draft.address}
                aria-busy={reverseLoading}
                className={reverseLoading ? "pe-10" : undefined}
                onChange={(event) => {
                  reverseAbort.current?.abort();
                  reverseRequest.current += 1;
                  setReverseLoading(false);
                  setDraft((current) => ({ ...current, address: event.target.value }));
                }}
              />
              {reverseLoading && (
                <span role="status" aria-label={labels.findingAddress} className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted-foreground">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                </span>
              )}
            </div>
          </label>
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>

        <DialogFooter className={cn("shrink-0 border-t border-border bg-card px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-6", classNames?.footer)}>
          <Button type="button" variant="ghost" className="sm:me-auto" onClick={clearPin} disabled={!coordinates || pending} leftIcon={Trash2}>{labels.clearPin}</Button>
          <Button type="button" variant="outline" onClick={close}>{labels.cancel}</Button>
          <Button type="button" onClick={confirm} disabled={pending || invalidPair} leftIcon={Check}>{labels.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
