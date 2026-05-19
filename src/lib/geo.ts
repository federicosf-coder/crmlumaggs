/**
 * Geographic helpers for delivery route distance / time tracking.
 * Pure functions — no external API calls.
 */

/** Default average speed (km/h) used to estimate driving time from km. */
export const ROUTE_AVG_SPEED_KMH = 40;

/**
 * Great-circle distance in kilometers between two coordinates.
 * Returns 0 if any input is missing/invalid.
 */
export function haversineKm(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined,
): number {
  if (
    lat1 == null || lng1 == null || lat2 == null || lng2 == null ||
    Number.isNaN(Number(lat1)) || Number.isNaN(Number(lng1)) ||
    Number.isNaN(Number(lat2)) || Number.isNaN(Number(lng2))
  ) return 0;
  const R = 6371; // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Convert km to estimated minutes using ROUTE_AVG_SPEED_KMH. */
export function minutesFromKm(km: number | null | undefined, speedKmh = ROUTE_AVG_SPEED_KMH): number {
  if (!km || km <= 0) return 0;
  return Math.round((km / speedKmh) * 60);
}

/** Format minutes as h:mm (e.g. 95 → "1:35"). */
export function formatHm(totalMinutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(totalMinutes || 0)));
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}