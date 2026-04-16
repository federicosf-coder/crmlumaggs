import { useEffect, useRef } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

interface Props {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Show the address text. Default true. */
  showText?: boolean;
  /** Show an embedded interactive map below the address. Default false. */
  showMap?: boolean;
  /** Map height in px. Default 200. */
  mapHeight?: number;
  /** Truncate the address text. Default false. */
  truncate?: boolean;
  className?: string;
  /** Icon-only inline variant for tables/lists. */
  iconOnly?: boolean;
}

function buildMapsUrl(address?: string | null, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps?q=${encodeURIComponent(address)}`;
  }
  return null;
}

function MiniMap({ lat, lng, address, height }: { lat?: number | null; lng?: number | null; address?: string | null; height: number }) {
  const { ready } = useGoogleMaps();
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const g = (window as any).google;
    if (!g?.maps) return;

    const place = (latNum: number, lngNum: number) => {
      const center = { lat: latNum, lng: lngNum };
      if (!mapRef.current) {
        mapRef.current = new g.maps.Map(ref.current!, {
          center,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });
      } else {
        mapRef.current.setCenter(center);
      }
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new g.maps.Marker({ position: center, map: mapRef.current });
    };

    if (lat != null && lng != null) {
      place(Number(lat), Number(lng));
    } else if (address) {
      const geocoder = new g.maps.Geocoder();
      geocoder.geocode({ address }, (results: any, status: string) => {
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          place(loc.lat(), loc.lng());
        }
      });
    }
  }, [ready, lat, lng, address]);

  return <div ref={ref} className="w-full rounded-md border bg-muted" style={{ height }} />;
}

export function AddressDisplay({
  address,
  lat,
  lng,
  showText = true,
  showMap = false,
  mapHeight = 200,
  truncate = false,
  className,
  iconOnly = false,
}: Props) {
  const url = buildMapsUrl(address, lat, lng);
  const hasData = !!url;

  if (!hasData) {
    return showText ? <span className="text-muted-foreground">—</span> : null;
  }

  if (iconOnly) {
    return (
      <a
        href={url!}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir en Google Maps"
        className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <MapPin className="h-4 w-4" />
      </a>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-1.5 min-w-0">
        {showText && (
          <span className={cn("text-sm", truncate && "truncate")}>{address || `${lat}, ${lng}`}</span>
        )}
        <a
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir en Google Maps"
          className="inline-flex items-center shrink-0 text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {showMap && (
        <a
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block"
          title="Abrir en Google Maps"
        >
          <MiniMap lat={lat} lng={lng} address={address} height={mapHeight} />
        </a>
      )}
    </div>
  );
}
