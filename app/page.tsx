'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import GuideModal from '@/components/GuideModal'; // keep if you added the Arabic popup; remove if not using

type PlaceRow = {
  name: string;
  formatted_address: string;
  place_id: string;
  location: { lat: number | null; lng: number | null };
  rating: number | null;
  user_ratings_total: number | null;
  types: string[];
  business_status: string | null;
  website: string | null;
  phone: string | null;
  googleMapsUri: string | null;
};

const DEFAULT_CENTER = { lat: 31.771959, lng: 35.217018 };

// NEW: cap the on-screen preview, but NOT the CSV export
const PREVIEW_LIMIT = 100 as const;

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
  const [autoExporting, setAutoExporting] = useState(false);
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

  // Small helper to fetch one page with current state
  async function fetchPage(opts: {
    bounds: { north: number; south: number; east: number; west: number };
    pageToken?: string | null;
    signal?: AbortSignal;
  }) {
    const { bounds, pageToken, signal } = opts;
    const url = new URL('/api/places', window.location.origin);
    url.searchParams.set('q', query);
    url.searchParams.set('north', String(bounds.north));
    url.searchParams.set('south', String(bounds.south));
    url.searchParams.set('east', String(bounds.east));
    url.searchParams.set('west', String(bounds.west));
    url.searchParams.set('language', language);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { results: PlaceRow[]; next_page_token?: string };
  }

  // UPDATED: Search will auto-paginate until we either hit PREVIEW_LIMIT or run out of pages
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
    if (!query.trim()) {
      setError('Type a search phrase first.');
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const seen = new Set<string>(firstPage ? [] : rows.map(r => r.place_id));
      const collected: PlaceRow[] = firstPage ? [] : [...rows];
      let token: string | null = firstPage ? null : nextPageToken;

      // Always fetch at least one page
      do {
        const data = await fetchPage({ bounds, pageToken: token, signal });

        // Deduplicate into preview list
        for (const r of data.results || []) {
          if (!seen.has(r.place_id) && collected.length < PREVIEW_LIMIT) {
            seen.add(r.place_id);
            collected.push(r);
          }
        }

        // Save token for potential next iteration
        token = data.next_page_token || null;

        // If we still have a token and haven't filled preview yet, wait ~2s (per Google guidance)
        if (token && collected.length < PREVIEW_LIMIT) {
          // 2s is typical; <1s is often too soon
          await sleep(2000);
        } else {
          break;
        }
      } while (true);

      setRows(collected);
      setNextPageToken(token || null);

      // Fit to preview markers when starting a new search
      if (firstPage) {
        setTimeout(() => {
          const map = mapRef.current;
          if (!map) return;
          fitToMarkers(map, collected);
        }, 0);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  // CSV export for ALL pages in current view (no limit)
  async function exportAllPagesCsv() {
    if (!apiKey) {
      setError('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local');
      return;
    }
    const bounds = getBounds();
    if (!bounds) {
      setError('Pan/zoom the map so bounds exist, then try again.');
      return;
    }
    if (!query.trim()) {
      setError('Type a search phrase first.');
      return;
    }

    setAutoExporting(true);
    setError(null);

    try {
      const collected: PlaceRow[] = [];
      const seen = new Set<string>();
      let token: string | null = null;

      while (true) {
        const data = await fetchPage({ bounds, pageToken: token });

        for (const r of data.results || []) {
          if (!seen.has(r.place_id)) {
            seen.add(r.place_id);
            collected.push(r);
          }
        }

        token = data.next_page_token || null;
        if (!token) break;

        // Give time for next_page_token to become valid
        await sleep(2000);
      }

      const csv = buildCsv(collected);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `places_in_view_all_${new Date().toISOString().slice(0, 19)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Export failed');
    } finally {
      setAutoExporting(false);
    }
  }

  // (kept) Export only what’s currently visible on the map (within preview cap)
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
          Search in the current map view and export exactly what you see.
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
                  placeholder="e.g. مطعم، مستشفى، مخبز…"
              />

              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600">Output language</label>
                <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="ar, he, en, ..."
                    title="Controls localization of returned text when available. It does not translate your query."
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                    className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    onClick={() => search(true)}
                    disabled={loading || !query.trim() || autoExporting}
                    title="Search inside the current map view"
                >
                  {loading ? 'Searching…' : 'Search in view'}
                </button>

                {/* Load more respects the 100 preview cap */}
                <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => search(false)}
                    disabled={loading || !nextPageToken || autoExporting || rows.length >= PREVIEW_LIMIT}
                    title="Load more results (same view, up to 100 on screen)"
                >
                  Load more
                </button>
              </div>

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  Results in view ({rows.length}{rows.length >= PREVIEW_LIMIT ? ` / ${PREVIEW_LIMIT}` : ''})
                </h2>
                <div className="flex items-center gap-2">
                  {/* Export all pages in view */}
                  <button
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                      onClick={exportAllPagesCsv}
                      disabled={!query.trim() || !mapRef.current || autoExporting}
                      title="Fetch every page for this view and download a single CSV"
                  >
                    {autoExporting ? 'Exporting…' : 'Export CSV all results'}
                  </button>

                  {/* (Optional) quick export only current preview */}
                  {/*<button*/}
                  {/*    className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"*/}
                  {/*    onClick={exportCsvVisible}*/}
                  {/*    disabled={!rows.length || autoExporting}*/}
                  {/*    title="Export only the items currently loaded (up to 100)"*/}
                  {/*>*/}
                  {/*  Export CSV (preview)*/}
                  {/*</button>*/}
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
                          No results yet — try a local-language term (e.g. “مستشفى”).
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>

              {rows.length >= PREVIEW_LIMIT && (
                  <p className="mt-2 text-xs text-slate-500">
                    Showing the first {PREVIEW_LIMIT} items for performance. Use “Export CSV all results” for the full list.
                  </p>
              )}
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
                          {active.website && (
                              <div className="mt-1">
                                <a
                                    href={active.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 underline break-all"
                                >
                                  Website
                                </a>
                              </div>
                          )}
                          {active.phone && (
                              <div className="mt-1">
                                <a href={`tel:${active.phone}`} className="text-blue-600 underline">
                                  {active.phone}
                                </a>
                              </div>
                          )}
                        </div>
                      </InfoWindow>
                  )}
                </GoogleMap>
            )}
          </div>
        </section>

        {/* If you didn't include the Arabic guide, remove this line */}
        <GuideModal />
      </main>
  );
}

function dedupeByPlaceId(list: PlaceRow[]): PlaceRow[] {
  const seen = new Set<string>();
  const out: PlaceRow[] = [];
  for (const r of list) {
    if (seen.has(r.place_id)) continue;
    seen.add(r.place_id);
    out.push(r);
  }
  return out;
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
    'website',
    'phone',
    'google_maps_url',
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
          esc((r.types || []).join('|')),
          esc(r.business_status ?? ''),
          esc(r.website ?? ''),
          esc(r.phone ?? ''),
          esc(r.googleMapsUri ?? ''),
        ].join(',')
    );
  }
  return lines.join('\n');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
