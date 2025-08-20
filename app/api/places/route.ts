import { NextRequest, NextResponse } from 'next/server';
import { sendQueryEmail } from '@/lib/mailer';

export const runtime = 'nodejs';

const V1_SEARCH_TEXT = 'https://places.googleapis.com/v1/places:searchText';

function normalizePlace(p: any) {
    return {
        name: p?.displayName?.text ?? '',
        formatted_address: p?.formattedAddress ?? '',
        place_id: p?.id ?? '',
        location: {
            lat: p?.location?.latitude ?? null,
            lng: p?.location?.longitude ?? null,
        },
        rating: p?.rating ?? null,
        user_ratings_total: p?.userRatingCount ?? null,
        types: p?.types ?? [],
        business_status: p?.businessStatus ?? null,
        website: p?.websiteUri ?? null,
        phone: p?.internationalPhoneNumber ?? p?.nationalPhoneNumber ?? null,
        googleMapsUri: p?.googleMapsUri ?? null,
    };
}

function sanitizeLanguage(lang: string | null | undefined) {
    const s = (lang || '').trim();
    return /^[a-z]{2}(-[A-Z]{2})?$/.test(s) ? s : 'he';
}

function safeJson(s: string) {
    try { return JSON.parse(s); } catch { return { raw: s }; }
}

// Build CSV for the current page (same columns as the client export, plus website/phone/maps URL)
function buildCsv(rows: any[]): string {
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
                esc(r.location?.lat ?? ''),
                esc(r.location?.lng ?? ''),
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

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    const textQuery = (searchParams.get('q') || '').trim();
    const north = Number(searchParams.get('north'));
    const south = Number(searchParams.get('south'));
    const east  = Number(searchParams.get('east'));
    const west  = Number(searchParams.get('west'));
    const languageCode = sanitizeLanguage(searchParams.get('language')) || 'he';
    const pageToken    = searchParams.get('pageToken') || undefined;

    const KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!KEY) {
        return NextResponse.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 500 });
    }

    if (![north, south, east, west].every(Number.isFinite)) {
        return NextResponse.json({ error: 'Missing or invalid bounds' }, { status: 400 });
    }
    if (!textQuery && !pageToken) {
        return NextResponse.json({ results: [], next_page_token: null, status: 'ZERO_RESULTS' });
    }

    const body: any = {
        textQuery,
        languageCode,
        locationRestriction: {
            rectangle: {
                low:  { latitude: south, longitude: west },
                high: { latitude: north, longitude: east },
            },
        },
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(V1_SEARCH_TEXT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': KEY,
            // Include website & phone so we can email/CSV them
            'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.businessStatus,places.websiteUri,places.internationalPhoneNumber,places.nationalPhoneNumber,places.googleMapsUri,nextPageToken',
        },
        body: JSON.stringify(body),
    });

    const raw = await res.text();
    if (!res.ok) {
        // Also notify on errors (optional)
        await maybeNotify({
            textQuery, languageCode, bounds: { north, south, east, west },
            ok: false, errorStatus: res.status, errorBody: raw,
            results: [],
        });
        return NextResponse.json(
            { error: `Google error ${res.status}`, detail: safeJson(raw) },
            { status: 500 }
        );
    }

    const data = safeJson(raw);
    const results = (data.places || []).map(normalizePlace);
    const next_page_token = data.nextPageToken || null;

    // Send email for this query/page
    await maybeNotify({
        textQuery,
        languageCode,
        bounds: { north, south, east, west },
        ok: true,
        results,
        next_page_token,
    });

    return NextResponse.json({
        status: 'OK',
        next_page_token,
        results,
    });
}

async function maybeNotify(args: {
    textQuery: string;
    languageCode: string;
    bounds: { north: number; south: number; east: number; west: number };
    ok: boolean;
    results: any[];
    next_page_token?: string | null;
    errorStatus?: number;
    errorBody?: string;
}) {
    const to = process.env.NOTIFY_EMAIL_TO;
    if (!to) return; // email notifications disabled

    const from = process.env.NOTIFY_EMAIL_FROM || process.env.GMAIL_USER!;
    const subject = args.ok
        ? `[Map-to-CSV] Query "${args.textQuery}" – ${args.results.length} results${args.next_page_token ? ' (has more)' : ''}`
        : `[Map-to-CSV] Query FAILED "${args.textQuery}" – Google ${args.errorStatus}`;

    const boundsStr = `N:${args.bounds.north.toFixed(6)} S:${args.bounds.south.toFixed(6)} E:${args.bounds.east.toFixed(6)} W:${args.bounds.west.toFixed(6)}`;

    const htmlOk = `
    <p><strong>Query:</strong> ${escapeHtml(args.textQuery)}</p>
    <p><strong>Language:</strong> ${escapeHtml(args.languageCode)}</p>
    <p><strong>Bounds:</strong> ${boundsStr}</p>
    <p><strong>Results on this page:</strong> ${args.results.length}${args.next_page_token ? ' (more pages available)' : ''}</p>
  `.trim();

    const textOk =
        `Query: ${args.textQuery}
Language: ${args.languageCode}
Bounds: ${boundsStr}
Results on this page: ${args.results.length}${args.next_page_token ? ' (more pages available)' : ''}`;

    const htmlErr = `
    <p><strong>Query:</strong> ${escapeHtml(args.textQuery)}</p>
    <p><strong>Language:</strong> ${escapeHtml(args.languageCode)}</p>
    <p><strong>Bounds:</strong> ${boundsStr}</p>
    <p><strong>FAILED:</strong> Google ${args.errorStatus}</p>
    <pre style="white-space:pre-wrap">${escapeHtml(String(args.errorBody || ''))}</pre>
  `.trim();

    const textErr =
        `Query: ${args.textQuery}
Language: ${args.languageCode}
Bounds: ${boundsStr}
FAILED: Google ${args.errorStatus}
${String(args.errorBody || '')}`;

    try {
        await sendQueryEmail({
            to,
            from,
            subject,
            text: args.ok ? textOk : textErr,
            html: args.ok ? htmlOk : htmlErr,
            csvFilename: 'results_page.csv',
            csvContent: args.ok ? buildCsv(args.results) : undefined,
        });
    } catch (e) {
        // Don’t crash the API if mail fails; just log it.
        console.error('Email send failed:', e);
    }
}

function escapeHtml(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
