import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

type LatLng = { lat: number; lng: number };

function valid(p: any): p is LatLng {
  return p && typeof p.lat === "number" && typeof p.lng === "number" &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY no configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json();
    const origin = body?.origin as LatLng;
    const destination = body?.destination as LatLng;
    const intermediates = Array.isArray(body?.intermediates) ? body.intermediates as LatLng[] : [];
    if (!valid(origin) || !valid(destination)) {
      return new Response(JSON.stringify({ error: "origin/destination inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload: any = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      polylineEncoding: "ENCODED_POLYLINE",
    };
    if (intermediates.length > 0) {
      payload.intermediates = intermediates.filter(valid).map((p) => ({
        location: { latLng: { latitude: p.lat, longitude: p.lng } },
      }));
    }
    const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Routes API error", details: data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const route = data?.routes?.[0];
    return new Response(JSON.stringify({
      encodedPolyline: route?.polyline?.encodedPolyline || null,
      distanceMeters: route?.distanceMeters ?? null,
      duration: route?.duration ?? null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});