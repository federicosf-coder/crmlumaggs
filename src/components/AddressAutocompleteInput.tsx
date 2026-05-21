import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Crosshair, Info } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { toast } from "sonner";

export interface AddressValue {
  direccion_completa: string;
  latitud: number | null;
  longitud: number | null;
  ciudad: string | null;
  estado: string | null;
  pais: string | null;
  codigo_postal: string | null;
  codigo_google: string | null;
}

interface Props {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  label?: string;
  required?: boolean;
  showCoords?: boolean;
  showLocateButton?: boolean;
  placeholder?: string;
}

const empty: AddressValue = {
  direccion_completa: "",
  latitud: null,
  longitud: null,
  ciudad: null,
  estado: null,
  pais: null,
  codigo_postal: null,
  codigo_google: null,
};

function extractComponents(place: any): Partial<AddressValue> {
  const get = (type: string) =>
    place.address_components?.find((c: any) => c.types.includes(type))?.long_name || null;
  return {
    ciudad: get("locality") || get("sublocality") || get("administrative_area_level_2"),
    estado: get("administrative_area_level_1"),
    pais: get("country"),
    codigo_postal: get("postal_code"),
  };
}

export function AddressAutocompleteInput({
  value,
  onChange,
  label = "Dirección",
  required = false,
  showCoords = true,
  showLocateButton = true,
  placeholder = "Buscar dirección...",
}: Props) {
  const { ready, error } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const acRef = useRef<any>(null);
  const [latStr, setLatStr] = useState(value.latitud != null ? String(value.latitud) : "");
  const [lngStr, setLngStr] = useState(value.longitud != null ? String(value.longitud) : "");
  const [reverseLoading, setReverseLoading] = useState(false);
  const [autoGeocodedInfo, setAutoGeocodedInfo] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const didAutoForwardRef = useRef(false);

  // Keep local lat/lng strings in sync if value changes externally
  useEffect(() => {
    setLatStr(value.latitud != null ? String(value.latitud) : "");
    setLngStr(value.longitud != null ? String(value.longitud) : "");
  }, [value.latitud, value.longitud]);

  // Wire up Places Autocomplete
  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;
    try {
      if (!window.google?.maps?.places?.Autocomplete) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ["formatted_address", "geometry", "address_components", "place_id"],
        types: ["geocode"],
        componentRestrictions: { country: "mx" },
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const comp = extractComponents(place);
        onChange({
          ...value,
          ...comp,
          direccion_completa: place.formatted_address || inputRef.current?.value || "",
          latitud: lat,
          longitud: lng,
          codigo_google: place.place_id || null,
        });
      });
      acRef.current = ac;
    } catch (err) {
      console.warn("[AddressAutocompleteInput] No se pudo inicializar Autocomplete:", err);
    }
    return () => {
      if (acRef.current) {
        try { window.google?.maps?.event?.clearInstanceListeners(acRef.current); } catch { /* noop */ }
        acRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Forward-geocode existing address when lat/lng are missing (EDIT mode fallback)
  useEffect(() => {
    if (!ready) return;
    if (didAutoForwardRef.current) return;
    if (value.latitud != null && value.longitud != null) return;
    if (!value.direccion_completa || value.direccion_completa.trim().length < 5) return;
    didAutoForwardRef.current = true;
    (async () => {
      try {
        if ((window as any).google?.maps?.importLibrary) {
          await (window as any).google.maps.importLibrary("geocoding");
        }
        const geocoder = new window.google.maps.Geocoder();
        const res: any = await geocoder.geocode({ address: value.direccion_completa, region: "mx" });
        const place = res?.results?.[0];
        if (!place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const comp = extractComponents(place);
        onChange({
          ...value,
          ...comp,
          latitud: lat,
          longitud: lng,
          codigo_google: place.place_id || value.codigo_google,
        });
        setAutoGeocodedInfo(true);
      } catch (e) {
        console.warn("[AddressAutocompleteInput] auto-geocode falló:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value.direccion_completa, value.latitud, value.longitud]);

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!ready) return;
    setReverseLoading(true);
    try {
      if ((window as any).google?.maps?.importLibrary) {
        await (window as any).google.maps.importLibrary("geocoding");
      }
      const geocoder = new window.google.maps.Geocoder();
      const res: any = await geocoder.geocode({ location: { lat, lng } });
      const place = res?.results?.[0];
      if (!place) {
        toast.error("No se encontró dirección para esas coordenadas");
        return;
      }
      const comp = extractComponents(place);
      onChange({
        ...value,
        ...comp,
        direccion_completa: place.formatted_address || value.direccion_completa,
        latitud: lat,
        longitud: lng,
        codigo_google: place.place_id || value.codigo_google,
      });
    } catch (e: any) {
      toast.error(e?.message || "Error en reverse geocoding");
    } finally {
      setReverseLoading(false);
    }
  };

  const scheduleReverseFromInputs = (latRaw: string, lngRaw: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const lat = parseFloat(latRaw);
      const lng = parseFloat(lngRaw);
      if (isNaN(lat) || isNaN(lng)) return;
      if (lat === value.latitud && lng === value.longitud) return;
      reverseGeocode(lat, lng);
    }, 800);
  };

  useEffect(() => () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    const ok = window.confirm(
      "Se actualizará la dirección con base en la ubicación actual de este dispositivo. ¿Deseas continuar?"
    );
    if (!ok) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => reverseGeocode(pos.coords.latitude, pos.coords.longitude),
      (err) => toast.error(err.message || "No se pudo obtener tu ubicación"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {label} {required && "*"}
          {!ready && !error && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </Label>
        <Input
          ref={inputRef}
          value={value.direccion_completa}
          onChange={(e) => onChange({ ...value, direccion_completa: e.target.value })}
          placeholder={ready ? placeholder : error ? "Modo manual (Maps no disponible)" : "Cargando Google Maps..."}
          autoComplete="off"
        />
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      {showCoords && (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Latitud</Label>
            <Input
              type="number"
              step="any"
              value={latStr}
              onChange={(e) => { setLatStr(e.target.value); scheduleReverseFromInputs(e.target.value, lngStr); }}
              placeholder="25.6866"
            />
          </div>
          <div>
            <Label className="text-xs">Longitud</Label>
            <Input
              type="number"
              step="any"
              value={lngStr}
              onChange={(e) => { setLngStr(e.target.value); scheduleReverseFromInputs(latStr, e.target.value); }}
              placeholder="-100.3161"
            />
          </div>
          {showLocateButton && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={useCurrentLocation}
              disabled={!ready || reverseLoading}
              title="Usar ubicación actual"
            >
              {reverseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}

      {autoGeocodedInfo && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" /> Coordenadas obtenidas automáticamente desde la dirección guardada
        </p>
      )}

      {(value.ciudad || value.estado || value.codigo_postal || value.pais) && (
        <p className="text-xs text-muted-foreground">
          {[value.ciudad, value.estado, value.codigo_postal, value.pais].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

export const emptyAddress = empty;
