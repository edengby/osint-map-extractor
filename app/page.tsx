'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';

type PlaceRow = {
  name: string;
  formatted_address: string;
  place_id: string;
  location: { lat: number | null; lng: number | null };
  rating: number | null;
  user_ratings_total: number | null;
  types: string[];
  business_status: string | null;
};

const DEFAULT_CENTER = { lat: 31.771959, lng: 35.217018 }; // Jerusalem-ish

export default function Page() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined;
  const defaultLang = (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE as string) || 'he';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: ['places'],
    language: defaultLang,
  });

  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState(defaultLang);
  const [rows, setRows] = useState<PlaceRow[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<PlaceRow | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);

  function onMapLoad(map: google.maps.Map) {
    mapRef.current = map;
  }

  function getBounds() {
    const map = mapRef.current;
    if (!map) return null;
    const b = map.getBounds();
    if (!b) return null;
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    return {
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    };
  }

  async function search(firstPage = true) {
    if (!apiKey) {
      setError('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local');
      return;
    }
    const bounds = getBounds();
    if (!bounds) {
      setError('Pan/zoom the map so bounds exist, then search.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/places', window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('north', String(bounds.north));
      url.searchParams.set('south', String(bounds.south));
      url.searchParams.set('east', String(bounds.east));
      url.searchParams.set('west', String(bounds.west));
      url.searchParams.set('language', language);
      if (!firstPage && nextPageToken) url.searchParams.set('pageToken', nextPageToken);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setNextPageToken(data.next_page_token || null);
      setRows((prev) => (firstPage ? data.results : [...prev, ...data.results]));

      if (firstPage) {
        setTimeout(() => {
          const map = mapRef.current;
          if (!map) return;
          fitToMarkers(map, data.results);
        }, 0);
      }
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function exportCsvVisible() {
    const map = mapRef.current;
    if (!map) return;
    const data = filterByBounds(rows, map);
    const csv = buildCsv(data);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); // BOM for Hebrew/Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `places_in_view_${new Date().toISOString().slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
      <main className="mx-auto max-w-7xl p-6">
        <h1 className="text-2xl font-semibold">Map → CSV (visible area only)</h1>
        <p className="text-sm text-slate-600 mt-1">
          Type a phrase, we search <strong>inside the current map view</strong>, then export exactly what you see.
        </p>

        <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Controls + Results */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <label className="block text-xs font-medium text-slate-600">Search phrase</label>
              <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. מסעדות, חנות, מרפאה…"
              />

              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600">Output language</label>
                <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="he, en, ar, ..."
                    title="Controls localization of returned text when available. It does not translate your query."
                />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                    className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => search(true)}
                    disabled={loading || !query.trim()}
                    title="Search inside the current map view"
                >
                  {loading ? 'Searching…' : 'Search in view'}
                </button>
                <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => search(false)}
                    disabled={loading || !nextPageToken}
                    title="Load more results (same view)"
                >
                  Load more
                </button>
              </div>

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Results in view ({rows.length})</h2>
                <button
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={exportCsvVisible}
                    disabled={!rows.length || !mapRef.current}
                >
                  Export CSV (in view)
                </button>
              </div>

              <div className="mt-3 max-h-[380px] overflow-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2">Rating</th>
                  </tr>
                  </thead>
                  <tbody>
                  {rows.map((r) => (
                      <tr
                          key={r.place_id}
                          className="odd:bg-white even:bg-slate-50 cursor-pointer"
                          onClick={() => setActive(r)}
                      >
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-slate-600">{r.formatted_address}</td>
                        <td className="px-3 py-2">{r.rating ?? '—'}</td>
                      </tr>
                  ))}
                  {!rows.length && (
                      <tr>
                        <td className="px-3 py-4 text-slate-500" colSpan={3}>
                          No results yet — try a local-language term (e.g. “hospital”, “مستشفى”).
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 shadow-sm">
            {!isLoaded && <div className="h-[520px] grid place-items-center text-slate-500">Loading map…</div>}
            {loadError && <div className="h-[520px] grid place-items-center text-red-600">Error loading map</div>}
            {isLoaded && (
                <GoogleMap
                    onLoad={onMapLoad}
                    mapContainerStyle={{ width: '100%', height: '520px', borderRadius: '1rem' }}
                    center={DEFAULT_CENTER}
                    zoom={12}
                    options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
                >
                  {rows.map((r) =>
                      r.location.lat != null && r.location.lng != null ? (
                          <Marker
                              key={r.place_id}
                              position={{ lat: r.location.lat, lng: r.location.lng }}
                              onClick={() => setActive(r)}
                              title={r.name}
                          />
                      ) : null
                  )}

                  {active && active.location.lat != null && active.location.lng != null && (
                      <InfoWindow
                          position={{ lat: active.location.lat, lng: active.location.lng }}
                          onCloseClick={() => setActive(null)}
                      >
                        <div className="text-sm">
                          <div className="font-semibold">{active.name}</div>
                          <div className="text-slate-600">{active.formatted_address}</div>
                          <div className="mt-1 text-slate-600">
                            ⭐ {active.rating ?? '—'} ({active.user_ratings_total ?? 0})
                          </div>
                          <div className="mt-1 text-xs text-slate-500 break-all">{active.place_id}</div>
                        </div>
                      </InfoWindow>
                  )}
                </GoogleMap>
            )}
          </div>
        </section>
      </main>
  );
}

function fitToMarkers(map: google.maps.Map, rows: PlaceRow[]) {
  const bounds = new google.maps.LatLngBounds();
  let count = 0;
  for (const r of rows) {
    if (r.location.lat != null && r.location.lng != null) {
      bounds.extend(new google.maps.LatLng(r.location.lat, r.location.lng));
      count++;
    }
  }
  if (count > 0) map.fitBounds(bounds, 48);
}

function filterByBounds(rows: PlaceRow[], map: google.maps.Map): PlaceRow[] {
  const b = map.getBounds();
  if (!b) return rows;
  return rows.filter((r) => {
    if (r.location.lat == null || r.location.lng == null) return false;
    return b.contains(new google.maps.LatLng(r.location.lat, r.location.lng));
  });
}

function buildCsv(rows: PlaceRow[]): string {
  const esc = (v: any) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  };
  const header = [
    'name',
    'address',
    'lat',
    'lng',
    'place_id',
    'rating',
    'user_ratings_total',
    'types',
    'business_status',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
        [
          esc(r.name),
          esc(r.formatted_address),
          esc(r.location.lat ?? ''),
          esc(r.location.lng ?? ''),
          esc(r.place_id),
          esc(r.rating ?? ''),
          esc(r.user_ratings_total ?? ''),
          esc(r.types?.join('|') ?? ''),
          esc(r.business_status ?? ''),
        ].join(',')
    );
  }
  return lines.join('\n');
}
