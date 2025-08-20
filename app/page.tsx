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
  icon: string | null;
};

const DEFAULT_CENTER = { lat: 31.771959, lng: 35.217018 }; // Jerusalem-ish

export default function Page() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined;
  const defaultLang = (process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE as string) || 'he';
  const defaultRegion = (process.env.NEXT_PUBLIC_DEFAULT_REGION as string) || 'IL';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: ['places'],
    language: defaultLang,
    region: defaultRegion,
  });

  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState(defaultLang);
  const [region, setRegion] = useState(defaultRegion);

  const [rows, setRows] = useState<PlaceRow[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const [active, setActive] = useState<PlaceRow | null>(null);

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    if (rows.length) fitToMarkers(map, rows);
  };

  useEffect(() => {
    if (isLoaded && mapRef.current && rows.length) fitToMarkers(mapRef.current, rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, rows.length]);

  async function search(firstPage = true) {
    if (!apiKey) {
      setError('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/places', window.location.origin);
      if (firstPage) {
        url.searchParams.set('query', query);
      } else if (nextPageToken) {
        url.searchParams.set('pagetoken', nextPageToken);
      }
      url.searchParams.set('language', language);
      url.searchParams.set('region', region);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setNextPageToken(data.next_page_token || null);
      setRows((prev) => (firstPage ? data.results : [...prev, ...data.results]));

      // Fit map after state updates
      setTimeout(() => {
        if (mapRef.current) {
          const merged = firstPage ? data.results : [...rows, ...data.results];
          fitToMarkers(mapRef.current!, merged);
        }
      }, 0);
    } catch (e: any) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function exportCsv(onlyInView: boolean) {
    const data = onlyInView && mapRef.current ? filterByBounds(rows, mapRef.current) : rows;
    const csv = buildCsv(data);
    // Add UTF-8 BOM to help Excel/Hebrew users
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `places_${new Date().toISOString().slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
      <main className="mx-auto max-w-7xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Map → CSV</h1>
        <p className="text-sm text-slate-500 mt-1">
          Free-text search (Google Places), plot on the map, export current results or only what’s in view.
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
                  placeholder="e.g. מסעדות כשרות בתל אביב"
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Language</label>
                  <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="he, en, ar, ..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Region</label>
                  <input
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="IL, US, ..."
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                    className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => search(true)}
                    disabled={loading || !query.trim()}
                >
                  {loading ? 'Searching…' : 'Search'}
                </button>
                <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => search(false)}
                    disabled={loading || !nextPageToken}
                    title="Load more results (if available)"
                >
                  Load more
                </button>
              </div>

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Results ({rows.length})</h2>
                <div className="flex gap-2">
                  <button
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => exportCsv(false)}
                      disabled={!rows.length}
                  >
                    Export CSV (list)
                  </button>
                  <button
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => exportCsv(true)}
                      disabled={!rows.length || !mapRef.current}
                      title="Export only places currently within the map bounds"
                  >
                    Export CSV (in view)
                  </button>
                </div>
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
                          No results yet — try a search.
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
                    zoom={10}
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

        <footer className="mt-8 text-xs text-slate-500">
          <p>
            In Google Cloud, enable <strong>Maps JavaScript API</strong> and <strong>Places API</strong>.
          </p>
        </footer>
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
