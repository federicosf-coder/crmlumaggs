import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Crosshair, MapPin } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Coordenadas de la dirección registrada del pedido, si existen. */
  initialLat: number | null;
  initialLng: number | null;
  /** Texto de la dirección registrada (sólo para mostrar). */
  addressLabel?: string | null;
  busy?: boolean;
  /** Confirmación. Devuelve las coordenadas finales (pin arrastrado o ubicación actual). */
  onConfirm: (coords: { lat: number; lng: number } | null) => Promise<void> | void;
}

/**
 * Dialog de confirmación de entrega con pin arrastrable.
 * Se muestra antes de marcar el pedido como entregado para que el chofer
 * ajuste la ubicación real (drag) o use su ubicación actual.
 */
export function DeliveryConfirmDialog({
  open, onOpenChange, initialLat, initialLng, addressLabel, busy, onConfirm,
}: Props) {
  const { ready, error } = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [locating, setLocating] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setLat(initialLat);
    setLng(initialLng);
  }, [open, initialLat, initialLng]);

  // Init map after dialog opens
  useEffect(() => {
    if (!open || !ready || !containerRef.current) return;
    const g = (window as any).google;
    const fallback = { lat: 25.6866, lng: -100.3161 };
    const start = lat != null && lng != null ? { lat, lng } : fallback;
    if (!mapRef.current) {
      mapRef.current = new g.maps.Map(containerRef.current, {
        center: start,
        zoom: lat != null && lng != null ? 17 : 7,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      markerRef.current = new g.maps.Marker({
        position: start,
        map: mapRef.current,
        draggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const p = markerRef.current.getPosition();
        setLat(p.lat());
        setLng(p.lng());
      });
      mapRef.current.addListener("click", (e: any) => {
        if (!e?.latLng) return;
        markerRef.current.setPosition(e.latLng);
        setLat(e.latLng.lat());
        setLng(e.latLng.lng());
      });
    } else {
      // Already created — just recenter
      mapRef.current.setCenter(start);
      mapRef.current.setZoom(lat != null && lng != null ? 17 : 7);
      markerRef.current.setPosition(start);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);

  // Keep marker in sync if lat/lng change externally
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (lat == null || lng == null) return;
    const p = { lat, lng };
    markerRef.current.setPosition(p);
    mapRef.current.panTo(p);
  }, [lat, lng]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu dispositivo no soporta geolocalización");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
        toast.success("Ubicación capturada");
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED
          ? "Permiso de ubicación denegado"
          : "No se pudo obtener tu ubicación");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleConfirm = async () => {
    const coords = lat != null && lng != null ? { lat, lng } : null;
    await onConfirm(coords);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Confirmar ubicación de entrega
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-3 space-y-2">
          {addressLabel && (
            <p className="text-xs text-muted-foreground">
              Dirección registrada: <span className="font-medium text-foreground">{addressLabel}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Arrastra el pin a la ubicación exacta donde se realizó la entrega o usa tu ubicación actual.
          </p>
        </div>

        <div className="px-6 pb-3 flex-1 min-h-[340px]">
          {error ? (
            <div className="h-[340px] flex items-center justify-center text-destructive text-sm border rounded-md">
              Error cargando Google Maps: {error}
            </div>
          ) : (
            <div className="relative h-[340px] border rounded-md overflow-hidden">
              <div ref={containerRef} className="absolute inset-0" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando mapa…
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            {lat != null && lng != null
              ? <>📍 {lat.toFixed(6)}, {lng.toFixed(6)}</>
              : <>Sin coordenadas seleccionadas</>}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useCurrentLocation}
            disabled={locating || !ready}
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Crosshair className="h-3.5 w-3.5 mr-1.5" />}
            Usar mi ubicación actual
          </Button>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={busy || (lat == null || lng == null)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Confirmar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}