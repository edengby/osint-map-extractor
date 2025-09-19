// lib/geo.ts
export type Bounds = { north: number; south: number; east: number; west: number };

/**
 * Split bounds into a grid of rectangles whose width/height are ~cellMeters.
 * Returns an array of {north,south,east,west} cells.
 */
export function boundsToCells(b: Bounds, cellMeters = 1500): Bounds[] {
    // Clamp/normalize
    const north = Math.max(b.north, b.south);
    const south = Math.min(b.north, b.south);
    const east = Math.max(b.east, b.west);
    const west = Math.min(b.east, b.west);

    const midLat = (north + south) / 2;
    const degPerMeterLat = 1 / 111_000; // ~111km per deg latitude
    const degPerMeterLng = 1 / (111_320 * Math.cos(toRad(midLat)) || 1e-6); // avoid div by zero near poles

    const stepLatDeg = cellMeters * degPerMeterLat;
    const stepLngDeg = cellMeters * degPerMeterLng;

    const cells: Bounds[] = [];
    for (let lat = south; lat < north; lat += stepLatDeg) {
        const latTop = Math.min(lat + stepLatDeg, north);
        for (let lng = west; lng < east; lng += stepLngDeg) {
            const lngRight = Math.min(lng + stepLngDeg, east);
            cells.push({
                south: lat,
                north: latTop,
                west: lng,
                east: lngRight,
            });
        }
    }
    return cells;
}

function toRad(deg: number) {
    return (deg * Math.PI) / 180;
}
