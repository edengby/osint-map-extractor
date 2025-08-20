import { NextRequest, NextResponse } from 'next/server';

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
    };
}

function sanitizeLanguage(lang: string | null | undefined) {
    const s = (lang || '').trim();
    return /^[a-z]{2}(-[A-Z]{2})?$/.test(s) ? s : 'he';
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
    if (!KEY) return NextResponse.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 500 });

    if (![north, south, east, west].every(Number.isFinite)) {
        return NextResponse.json({ error: 'Missing or invalid bounds' }, { status: 400 });
    }
    if (!textQuery && !pageToken) {
        return NextResponse.json({ results: [], next_page_token: null, status: 'ZERO_RESULTS' });
    }

    // Hard geographic filter: rectangle = visible map bounds
    const body: any = {
        textQuery,
        languageCode,
        locationRestriction: {
            rectangle: {
                low:  { latitude: south, longitude: west },
                high: { latitude: north, longitude: east },
            },
        },
        // Optional: you can set rankPreference: 'RELEVANCE' | 'DISTANCE'
        // rankPreference: 'RELEVANCE',
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(V1_SEARCH_TEXT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': KEY,
            // Field mask required by Places v1:
            'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.businessStatus,nextPageToken',
        },
        body: JSON.stringify(body),
    });

    const raw = await res.text();
    if (!res.ok) {
        return NextResponse.json(
            { error: `Google error ${res.status}`, detail: safeJson(raw) },
            { status: 500 }
        );
    }

    const data = safeJson(raw);
    const results = (data.places || []).map(normalizePlace);

    return NextResponse.json({
        status: 'OK',
        next_page_token: data.nextPageToken || null,
        results,
    });
}

function safeJson(s: string) {
    try { return JSON.parse(s); } catch { return { raw: s }; }
}
