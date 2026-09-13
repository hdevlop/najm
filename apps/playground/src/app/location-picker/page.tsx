'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { NButton, NForm } from 'najm-kit';
import {
  FormLocationInput,
  getNajmLocationLabels,
  type NCoordinates,
  type NLocationCandidate,
  type NLocationGeocoderAdapter,
  type NLocationProviderSelectionMeta,
  type NLocationValue,
} from 'najm-kit/location';
import {
  NLocationRuntimeProvider,
  type NLocationRuntimeConfig,
} from 'najm-kit/location/runtime';

type GeocoderCandidate = { id: string; label: string; coordinates: { latitude: number; longitude: number }; description?: string };

const reverseCache = new Map<string, GeocoderCandidate>();
const searchCache = new Map<string, readonly GeocoderCandidate[]>();
let nextGeocoderRequestAt = 0;
const googleMapsBrowserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() ?? '';
let loadedGoogleGeocoder: NLocationGeocoderAdapter | null = null;
let googleGeocoderPromise: Promise<NLocationGeocoderAdapter> | null = null;

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
};

function conciseAddress(address: NominatimAddress | undefined, fallback: string) {
  if (!address) return fallback.split(',').slice(0, 4).join(',').trim();
  const road = address.road || address.pedestrian;
  const street = [address.house_number, road].filter(Boolean).join(' ');
  const area = address.neighbourhood || address.suburb || address.quarter;
  const locality = address.city || address.town || address.village || address.municipality;
  const parts = [street, area, locality, address.postcode].filter((part): part is string => Boolean(part?.trim()));
  const uniqueParts = parts.filter((part, index) => (
    parts.findIndex((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index
  ));
  return uniqueParts.join(', ') || fallback.split(',').slice(0, 4).join(',').trim();
}

function waitForGeocoderSlot(signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const scheduledFor = Math.max(Date.now(), nextGeocoderRequestAt);
  nextGeocoderRequestAt = scheduledFor + 1_000;
  const delay = scheduledFor - Date.now();
  if (delay === 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

const demoGeocoder: NLocationGeocoderAdapter = {
  id: 'playground-manual-osm',
  async search(query, context) {
    if (context.signal.aborted) return [];
    const normalized = query.trim().toLocaleLowerCase();
    const cacheKey = `${context.language || 'en'}:${normalized}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    await waitForGeocoderSlot(context.signal);
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', query.trim());
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', context.language || navigator.language || 'en');
    const response = await fetch(url, {
      signal: context.signal,
      headers: { Accept: 'application/json' },
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    if (!response.ok) throw new Error(`Location search returned ${response.status}`);
    const results = await response.json() as Array<{
      place_id?: number | string;
      display_name?: string;
      lat?: string;
      lon?: string;
      address?: NominatimAddress;
    }>;
    if (context.signal.aborted) return [];
    const candidates = results.flatMap((result): GeocoderCandidate[] => {
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);
      if (!result.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [{
        id: String(result.place_id ?? `${latitude},${longitude}`),
        label: conciseAddress(result.address, result.display_name),
        description: 'OpenStreetMap',
        coordinates: { latitude, longitude },
      }];
    });
    searchCache.set(cacheKey, candidates);
    return candidates;
  },
  async reverse(coordinates, signal) {
    if (signal.aborted) return null;
    const cacheKey = `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;
    const cached = reverseCache.get(cacheKey);
    if (cached) return cached;

    // Playground-only manual lookup. It is deliberately not exported by
    // najm-kit and must not be used with personal or confidential addresses.
    await waitForGeocoderSlot(signal);
    if (signal.aborted) return null;

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(coordinates.latitude));
    url.searchParams.set('lon', String(coordinates.longitude));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', document.documentElement.lang || navigator.language || 'en');
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    if (!response.ok) throw new Error(`Reverse geocoder returned ${response.status}`);
    const result = await response.json() as { place_id?: number | string; display_name?: string; address?: NominatimAddress };
    if (signal.aborted || !result.display_name) return null;
    const candidate = {
      id: String(result.place_id ?? cacheKey),
      label: conciseAddress(result.address, result.display_name),
      coordinates,
    };
    reverseCache.set(cacheKey, candidate);
    return candidate;
  },
};

function loadGoogleGeocoder() {
  if (!googleMapsBrowserKey) return Promise.reject(new Error('Google Maps is not configured'));
  googleGeocoderPromise ??= import('najm-kit/location/google').then(({ createGooglePlacesGeocoder }) => {
    loadedGoogleGeocoder = createGooglePlacesGeocoder({ apiKey: googleMapsBrowserKey });
    return loadedGoogleGeocoder;
  });
  return googleGeocoderPromise;
}

const googleGeocoder: NLocationGeocoderAdapter = {
  id: 'playground-google-places',
  async search(query, context) {
    return (await loadGoogleGeocoder()).search(query, context);
  },
  async resolve(candidate: NLocationCandidate, signal: AbortSignal) {
    const geocoder = await loadGoogleGeocoder();
    return geocoder.resolve ? geocoder.resolve(candidate, signal) : candidate;
  },
  async reverse(coordinates: NCoordinates, signal: AbortSignal) {
    const geocoder = await loadGoogleGeocoder();
    return geocoder.reverse ? geocoder.reverse(coordinates, signal) : null;
  },
  resetSession() {
    loadedGoogleGeocoder?.resetSession?.();
  },
};

type MapProvider = 'leaflet' | 'google' | 'disabled';

const locationSchema = z.object({
  deliveryLocation: z.object({
    address: z.string().trim().min(5, 'Enter at least 5 characters.').max(1000),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  }).refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: 'Select both coordinates or clear the pin.',
  }),
});

const DEFAULT_VALUE: NLocationValue = {
  address: '10 Test Street, Tangier',
  latitude: null,
  longitude: null,
};

export default function LocationPickerPage() {
  const [mapProvider, setMapProvider] = useState<MapProvider>('leaflet');
  const [rtl, setRtl] = useState(false);
  const [result, setResult] = useState<'idle' | 'address' | 'pinned'>('idle');
  const [providerMeta, setProviderMeta] = useState<NLocationProviderSelectionMeta | null>(null);
  const locationConfig = useMemo<NLocationRuntimeConfig>(() => {
    const shared = {
      defaultCenter: { latitude: 35.7595, longitude: -5.8340 },
      defaultZoom: 13,
    };
    if (mapProvider === 'leaflet') {
      return {
        ...shared,
        provider: 'leaflet',
        leaflet: {
          tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      };
    }
    if (mapProvider === 'google') {
      return { ...shared, provider: 'google', google: { apiKey: googleMapsBrowserKey } };
    }
    return { ...shared, provider: 'disabled' };
  }, [mapProvider]);
  const geocoder = mapProvider === 'leaflet' ? demoGeocoder : mapProvider === 'google' ? googleGeocoder : null;

  useEffect(() => {
    const previousDirection = document.documentElement.dir;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    return () => { document.documentElement.dir = previousDirection; };
  }, [rtl]);

  return (
    <NLocationRuntimeProvider
      config={locationConfig}
      geocoder={geocoder}
      labels={getNajmLocationLabels(rtl ? 'ar' : 'en')}
      unavailableReason={mapProvider === 'disabled' ? 'Map disabled for fallback testing' : undefined}
    >
      <main className="min-h-screen bg-background px-4 py-8 text-foreground">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Najm Kit · manual acceptance</p>
            <h1 className="text-2xl font-semibold">Location picker</h1>
            <p className="text-sm text-muted-foreground">Test address editing, transactional Cancel/Confirm, marker dragging, explicit place search, live reverse-address updates, keyboard movement, current location, responsive containment, RTL, and the disabled-map fallback.</p>
          </header>

          <div className="flex flex-wrap gap-2">
            <NButton type="button" variant={mapProvider === 'disabled' ? 'default' : 'outline'} onClick={() => setMapProvider('disabled')}>Minimal (no map)</NButton>
            <NButton type="button" variant={mapProvider === 'leaflet' ? 'default' : 'outline'} onClick={() => setMapProvider('leaflet')}>Kafil style (Leaflet)</NButton>
            <NButton type="button" variant={mapProvider === 'google' ? 'default' : 'outline'} onClick={() => setMapProvider('google')} disabled={!googleMapsBrowserKey}>School style (Google)</NButton>
            <NButton type="button" variant={rtl ? 'default' : 'outline'} onClick={() => setRtl((value) => !value)}>{rtl ? 'RTL' : 'LTR'}</NButton>
          </div>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <NForm
              schema={locationSchema}
              defaultValues={{ deliveryLocation: DEFAULT_VALUE }}
              onSubmit={(values) => setResult(values.deliveryLocation.latitude === null ? 'address' : 'pinned')}
            >
              <FormLocationInput
                name="deliveryLocation"
                formLabel="Household exact address"
                formDescription="The written address is required. Selecting a map pin is optional."
                placeholder="Street, city, or delivery directions"
                providerMeta={providerMeta}
                onProviderMetaChange={setProviderMeta}
                required
              />
              <div className="flex justify-end">
                <NButton type="submit">Validate form value</NButton>
              </div>
              {result !== 'idle' && <p role="status" className="text-sm text-success">Valid {result === 'pinned' ? 'address and pin' : 'address-only'} value.</p>}
              <p className="text-xs text-muted-foreground">
                Provider metadata: {providerMeta?.placeId
                  ? <code className="rounded bg-muted px-1 py-0.5">google:{providerMeta.placeId}</code>
                  : 'none'}
              </p>
            </NForm>
          </section>

          <aside className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Choose Leaflet or Google, open the map, select a point, and wait for its address to resolve. Provider requests receive the synthetic search terms and coordinates you enter. The Leaflet demo uses public OpenStreetMap services and limits requests to one per second. Cancel and reopen to prove the draft was discarded, or Confirm to commit it. Focus the map and use Arrow or Shift+Arrow keys. Narrow the browser to a phone width to test the full-screen dialog.
          </aside>
        </div>
      </main>
    </NLocationRuntimeProvider>
  );
}
