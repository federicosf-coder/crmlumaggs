import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    google?: any;
    __gmapsLoading?: Promise<void>;
  }
}

let cachedKey: string | null = null;

async function fetchKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const { data, error } = await supabase.functions.invoke("get-google-maps-key");
  if (error || !data?.apiKey) {
    throw new Error(error?.message || "No se pudo obtener la API key de Google Maps");
  }
  cachedKey = data.apiKey as string;
  return cachedKey;
}

function loadScript(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;

  window.__gmapsLoading = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Error cargando Google Maps")));
      return;
    }
    const s = document.createElement("script");
    s.id = "google-maps-script";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Error cargando Google Maps"));
    document.head.appendChild(s);
  });

  return window.__gmapsLoading;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState(!!window.google?.maps?.places);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    (async () => {
      try {
        const key = await fetchKey();
        await loadScript(key);
        if (!cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error cargando Google Maps");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return { ready, error };
}
