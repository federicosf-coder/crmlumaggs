import { supabase } from "@/integrations/supabase/client";

export type ResolvedLocation = {
  lat: number;
  lng: number;
  formattedAddress?: string | null;
  placeId?: string | null;
};

type GeocodeResult = {
  formatted_address?: string;
  place_id?: string;
  geometry?: {
    location?: { lat?: number | (() => number); lng?: number | (() => number) };
  };
};

type GeocoderStatus = string;
type Geocoder = {
  geocode: (
    request: { address?: string; region?: string; location?: { lat: number; lng: number } },
    callback: (results: GeocodeResult[] | null, status: GeocoderStatus) => void,
  ) => void;
};

export function isGoogleMapsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl" || (host.includes("google.") && url.pathname.startsWith("/maps"));
  } catch {
    return false;
  }
}

export function extractCoordsFromText(value: string | null | undefined): { lat: number; lng: number } | null {
  if (!value) return null;
  const decoded = decodeURIComponent(String(value));
  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center|destination)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /(?:^|\s)(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:\s|$)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

async function resolveGoogleMapsLink(url: string): Promise<string> {
  if (!isGoogleMapsUrl(url)) return url;
  const { data, error } = await supabase.functions.invoke("resolve-google-maps-link", {
    body: { url },
  });
  if (error) throw new Error(error.message || "No se pudo resolver el enlace de Google Maps");
  return data?.finalUrl || url;
}

async function getGeocoder(): Promise<Geocoder> {
  const g = window.google;
  if (!g?.maps) throw new Error("Google Maps no está listo");
  if (g.maps.importLibrary) {
    try { await g.maps.importLibrary("geocoding"); } catch { /* fallback legacy */ }
  }
  if (!g.maps.Geocoder) throw new Error("Google Maps no cargó el geocodificador");
  return new g.maps.Geocoder() as Geocoder;
}

export async function reverseGeocodeCoords(lat: number, lng: number): Promise<ResolvedLocation> {
  const geocoder = await getGeocoder();
  const result = await new Promise<GeocodeResult>((resolve, reject) => {
    geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results, status) => {
      if (status === "OK" && results?.[0]) resolve(results[0]);
      else reject(new Error(`Geocoder: ${status}`));
    });
  });
  return { lat: Number(lat), lng: Number(lng), formattedAddress: result.formatted_address || null, placeId: result.place_id || null };
}

export async function geocodeAddressInput(input: string): Promise<ResolvedLocation> {
  const original = input.trim();
  if (!original) throw new Error("Dirección vacía");

  const initialCoords = extractCoordsFromText(original);
  if (initialCoords) return reverseGeocodeCoords(initialCoords.lat, initialCoords.lng);

  let address = original;
  if (isGoogleMapsUrl(original)) {
    address = await resolveGoogleMapsLink(original);
    const resolvedCoords = extractCoordsFromText(address);
    if (resolvedCoords) return reverseGeocodeCoords(resolvedCoords.lat, resolvedCoords.lng);
    const place = address.match(/\/maps\/place\/([^/@?]+)/)?.[1];
    if (place) address = decodeURIComponent(place.replace(/\+/g, " "));
  }

  const geocoder = await getGeocoder();
  const result = await new Promise<GeocodeResult>((resolve, reject) => {
    geocoder.geocode({ address, region: "mx" }, (results, status) => {
      if (status === "OK" && results?.[0]) resolve(results[0]);
      else reject(new Error(`Geocoder: ${status}`));
    });
  });
  const loc = result.geometry?.location;
  const lat = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
  const lng = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;
  if (lat == null || lng == null) throw new Error("Sin coordenadas en el resultado");
  return { lat: Number(lat), lng: Number(lng), formattedAddress: result.formatted_address || null, placeId: result.place_id || null };
}