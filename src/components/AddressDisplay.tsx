import { MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** Show the address text. Default true. Set false in tight cells where only icon is wanted. */
  showText?: boolean;
  /** Show a small embedded map below the address. Default false. */
  showMap?: boolean;
  /** Map height in px. Default 160. */
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

function buildStaticMapSrc(address?: string | null, lat?: number | null, lng?: number | null, width = 600, height = 300) {
  // OpenStreetMap static image (no API key, no iframe blocking).
  if (lat != null && lng != null) {
    const latN = Number(lat);
    const lngN = Number(lng);
    const delta = 0.01;
    const bbox = `${lngN - delta},${latN - delta},${lngN + delta},${latN + delta}`;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${latN},${lngN}&zoom=15&size=${width}x${height}&markers=${latN},${lngN},red-pushpin&bbox=${bbox}`;
  }
  return null;
}

export function AddressDisplay({
  address,
  lat,
  lng,
  showText = true,
  showMap = false,
  mapHeight = 160,
  truncate = false,
  className,
  iconOnly = false,
}: Props) {
  const url = buildMapsUrl(address, lat, lng);
  const mapImg = showMap ? buildStaticMapSrc(address, lat, lng) : null;
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
      {embed && (
        <iframe
          src={embed}
          title="Mapa"
          className="w-full rounded-md border"
          style={{ height: mapHeight }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}
