import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BASE = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

/**
 * Proxy to Google Places Text Search so your server key stays private.
 * Supports pagination via next_page_token (requires ~2s delay).
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const pagetoken = searchParams.get('pagetoken');
    const language = searchParams.get('language') || 'he';
    const region = searchParams.get('region') || 'IL';

    const KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!KEY) {
        return NextResponse.json({ error: 'Missing GOOGLE_MAPS_API_KEY' }, { status: 500 });
    }

    if (pagetoken) {
        // Google asks to wait briefly until the token becomes valid
        await new Promise((r) => setTimeout(r, 2100));
    }

    const url = new URL(BASE);
    if (pagetoken) {
        url.searchParams.set('pagetoken', pagetoken);
    } else {
        url.searchParams.set('query', query);
    }
    url.searchParams.set('language', language);
    url.searchParams.set('region', region);
    url.searchParams.set('key', KEY);

    const res = await fetch(url.toString());
    const data = await res.json();

    const results = (data.results || []).map((r: any) => ({
        name: r.name,
        formatted_address: r.formatted_address,
        place_id: r.place_id,
        location: {
            lat: r.geometry?.location?.lat ?? null,
            lng: r.geometry?.location?.lng ?? null,
        },
        rating: r.rating ?? null,
        user_ratings_total: r.user_ratings_total ?? null,
        types: r.types ?? [],
        business_status: r.business_status ?? null,
        icon: r.icon ?? null,
    }));

    return NextResponse.json({
        status: data.status,
        next_page_token: data.next_page_token || null,
        results,
    });
}
