import { useEffect, useMemo, useRef, useState } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, CalendarIcon, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type Entrega = {
  id: string;
  documento_id: string;
  ruta_id: string | null;
  fecha_entrega: string;
  orden_ruta?: number | null;
  documentos: any;
};

type Ruta = {
  id: string;
  vehiculo_id: string;
  plaza_id: string;
  fecha_entrega: string;
  plazas?: { nombre: string };
};

type Vehiculo = {
  id: string;
  nombre: string;
  icon: "pickup" | "truck";
  color: string;
  placas?: string | null;
};

type Plaza = { id: string; nombre: string };
type Repartidor = { id: string; nombre: string };
type RutaRepartidor = { ruta_id: string; repartidor_id: string };

interface DeliveryMapViewProps {
  entregas: Entrega[];
  rutas: Ruta[];
  vehiculos: Vehiculo[];
  plazas: Plaza[];
  selectedPlaza: string;
  repartidores?: Repartidor[];
  rutaRepartidores?: RutaRepartidor[];
}

// Paleta de colores distintivos por ruta
const ROUTE_COLORS = [
  "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#eab308", "#0ea5e9", "#22c55e",
];
function colorForRoute(rutaId: string | null | undefined, index: number) {
  if (!rutaId) return "#64748b";
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

function buildPinSvgWithNumber(color: string, icon: "pickup" | "truck", num: number | null) {
  const truckPath = `M3 7h11v8H3z M14 10h4l3 3v2h-7z M6 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M17 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z`;
  const pickupPath = `M3 9h8v6H3z M11 11h4l4 2v2h-8z M6 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M16 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z`;
  const path = icon === "pickup" ? pickupPath : truckPath;
  const badge = num != null
    ? `<g transform="translate(20, 56)">
         <rect x="-12" y="-9" width="24" height="18" rx="9" fill="#ffffff" stroke="${color}" stroke-width="2"/>
         <text x="0" y="4" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="700" fill="${color}">${num}</text>
       </g>`
    : "";
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="70" viewBox="0 0 44 70">
  <g transform="translate(2,0)">
    <path d="M20 0 C9 0 0 9 0 20 C0 32 20 50 20 50 C20 50 40 32 40 20 C40 9 31 0 20 0 Z"
      fill="${color}" stroke="#ffffff" stroke-width="2"/>
    <g transform="translate(8, 8)" fill="#ffffff" stroke="#ffffff" stroke-width="0.5">
      <path d="${path}" />
    </g>
  </g>
  ${badge}
</svg>`;
}

type DatePreset = "all" | "today" | "yesterday" | "7d" | "month" | "custom";

export function DeliveryMapView({
  entregas, rutas, vehiculos, plazas, selectedPlaza,
  repartidores = [], rutaRepartidores = [],
}: DeliveryMapViewProps) {
  const { ready, error } = useGoogleMaps();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  // ── Filtros ────────────────────────────────────────────────
  const [rutaFilter, setRutaFilter] = useState<string>("all");
  const [repartidorFilter, setRepartidorFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const dateRange = useMemo<{ from: Date; to: Date } | null>(() => {
    const now = new Date();
    switch (datePreset) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "yesterday": {
        const y = subDays(now, 1);
        return { from: startOfDay(y), to: endOfDay(y) };
      }
      case "7d":
        return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
      case "month":
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case "custom":
        if (customFrom && customTo) return { from: startOfDay(customFrom), to: endOfDay(customTo) };
        if (customFrom) return { from: startOfDay(customFrom), to: endOfDay(customFrom) };
        return null;
      default:
        return null;
    }
  }, [datePreset, customFrom, customTo]);

  // Rutas asociadas al repartidor seleccionado
  const rutasDeRepartidor = useMemo(() => {
    if (repartidorFilter === "all") return null;
    const set = new Set(
      rutaRepartidores.filter(rr => rr.repartidor_id === repartidorFilter).map(rr => rr.ruta_id)
    );
    return set;
  }, [repartidorFilter, rutaRepartidores]);

  // Filter entregas by plaza + ruta + repartidor + fecha
  const visibleEntregas = useMemo(() => {
    return entregas.filter((e) => {
      const ruta = rutas.find((r) => r.id === e.ruta_id);
      if (!ruta) return false;
      if (selectedPlaza !== "all" && ruta.plaza_id !== selectedPlaza) return false;
      if (rutaFilter !== "all" && ruta.id !== rutaFilter) return false;
      if (rutasDeRepartidor && !rutasDeRepartidor.has(ruta.id)) return false;
      if (dateRange && e.fecha_entrega) {
        try {
          const d = parseISO(e.fecha_entrega + "T12:00:00");
          if (!isWithinInterval(d, { start: dateRange.from, end: dateRange.to })) return false;
        } catch { /* ignore */ }
      }
      const lat = e.documentos?.direccion_envio_lat;
      const lng = e.documentos?.direccion_envio_lng;
      return typeof lat === "number" && typeof lng === "number";
    });
  }, [entregas, rutas, selectedPlaza, rutaFilter, rutasDeRepartidor, dateRange]);

  // Rutas disponibles para el selector (limitadas por plaza y repartidor)
  const rutasDisponibles = useMemo(() => {
    return rutas.filter((r) => {
      if (selectedPlaza !== "all" && r.plaza_id !== selectedPlaza) return false;
      if (rutasDeRepartidor && !rutasDeRepartidor.has(r.id)) return false;
      return true;
    });
  }, [rutas, selectedPlaza, rutasDeRepartidor]);

  const activeFilterCount =
    (rutaFilter !== "all" ? 1 : 0) +
    (repartidorFilter !== "all" ? 1 : 0) +
    (datePreset !== "all" ? 1 : 0);

  const clearFilters = () => {
    setRutaFilter("all");
    setRepartidorFilter("all");
    setDatePreset("all");
    setCustomFrom(undefined);
    setCustomTo(undefined);
  };

  // Init map
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const google = (window as any).google;
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat: 25.6866, lng: -100.3161 }, // Monterrey default
      zoom: 7,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    infoRef.current = new google.maps.InfoWindow();
  }, [ready]);

  // Render markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    let cancelled = false;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (visibleEntregas.length === 0) return () => { cancelled = true; };

    const bounds = new google.maps.LatLngBounds();

    // Asignar color por ruta visible (estable según orden de aparición)
    const visibleRutaIds: string[] = [];
    visibleEntregas.forEach((e) => {
      if (e.ruta_id && !visibleRutaIds.includes(e.ruta_id)) visibleRutaIds.push(e.ruta_id);
    });
    const colorByRuta: Record<string, string> = {};
    visibleRutaIds.forEach((rid, i) => { colorByRuta[rid] = colorForRoute(rid, i); });

    visibleEntregas.forEach((e) => {
      const ruta = rutas.find((r) => r.id === e.ruta_id);
      const vehiculo = ruta ? vehiculos.find((v) => v.id === ruta.vehiculo_id) : null;
      const color = e.ruta_id ? colorByRuta[e.ruta_id] : (vehiculo?.color || "#3b82f6");
      const icon = (vehiculo?.icon || "truck") as "pickup" | "truck";

      const lat = Number(e.documentos.direccion_envio_lat);
      const lng = Number(e.documentos.direccion_envio_lng);
      const position = { lat, lng };
      bounds.extend(position);

      const num = e.orden_ruta != null ? Number(e.orden_ruta) + 1 : null;
      const svg = buildPinSvgWithNumber(color, icon, num);
      const marker = new google.maps.Marker({
        position,
        map: mapRef.current,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(44, 70),
          anchor: new google.maps.Point(22, 50),
        },
        title: `${num != null ? `#${num} · ` : ""}${e.documentos?.companies?.name || "Entrega"}`,
      });

      marker.addListener("click", () => {
        const doc = e.documentos;
        const plaza = plazas.find((p) => p.id === ruta?.plaza_id);
        const fecha = e.fecha_entrega
          ? format(new Date(e.fecha_entrega + "T12:00:00"), "EEEE dd MMM yyyy", { locale: es })
          : "Sin fecha";
        const html = `
          <div style="min-width:240px;font-family:inherit;color:#111;">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px;">
              ${escapeHtml(doc?.companies?.name || "Sin cliente")}
            </div>
            <div style="font-size:12px;color:#555;margin-bottom:6px;">
              ${escapeHtml(doc?.direccion_envio || "")}
            </div>
            <div style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:#333;">
              <div>📍 <strong>Plaza:</strong> ${escapeHtml(plaza?.nombre || "—")}</div>
              <div>🚚 <strong>Vehículo:</strong> ${escapeHtml(vehiculo?.nombre || "—")}${vehiculo?.placas ? " (" + escapeHtml(vehiculo.placas) + ")" : ""}</div>
              <div>📅 <strong>Entrega:</strong> ${escapeHtml(fecha)}</div>
              ${doc?.numero_pedido ? `<div>📦 <strong>Pedido:</strong> ${escapeHtml(doc.numero_pedido)}</div>` : ""}
              ${doc?.total != null ? `<div>💰 <strong>Total:</strong> $${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>` : ""}
            </div>
            <div style="margin-top:8px;display:flex;gap:6px;">
              <button id="btn-open-${e.documento_id}" style="flex:1;padding:6px 10px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
                Abrir entrega
              </button>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener" style="padding:6px 10px;background:#e5e7eb;color:#111;border-radius:6px;text-decoration:none;font-size:12px;">
                Ruta
              </a>
            </div>
          </div>
        `;
        infoRef.current.setContent(html);
        infoRef.current.open(mapRef.current, marker);

        // Wire up the open button after the InfoWindow finishes rendering
        google.maps.event.addListenerOnce(infoRef.current, "domready", () => {
          const btn = document.getElementById(`btn-open-${e.documento_id}`);
          if (btn) {
            btn.onclick = () => window.open(`/delivery/entrega/${e.documento_id}`, "_blank");
          }
        });
      });

      markersRef.current.push(marker);
    });

    // Dibujar líneas por ruta siguiendo Google Directions
    (async () => {
      const grouped: Record<string, Entrega[]> = {};
      visibleEntregas.forEach((e) => {
        if (!e.ruta_id) return;
        (grouped[e.ruta_id] ||= []).push(e);
      });

      for (const rid of Object.keys(grouped)) {
        if (cancelled) return;
        const items = grouped[rid].slice().sort(
          (a, b) => (a.orden_ruta ?? 0) - (b.orden_ruta ?? 0),
        );
        if (items.length < 2) continue;
        const pts = items.map((e) => ({
          lat: Number(e.documentos.direccion_envio_lat),
          lng: Number(e.documentos.direccion_envio_lng),
        }));
        const color = colorByRuta[rid];

        let path: any[] | null = null;
        try {
          const { data, error: fnErr } = await supabase.functions.invoke(
            "compute-driving-route",
            { body: {
                origin: pts[0],
                destination: pts[pts.length - 1],
                intermediates: pts.slice(1, -1),
              } },
          );
          if (cancelled) return;
          if (!fnErr && data?.encodedPolyline && google.maps.geometry?.encoding) {
            path = google.maps.geometry.encoding.decodePath(data.encodedPolyline);
          }
        } catch { /* fallback */ }

        // Fallback: línea recta entre puntos
        if (!path || path.length === 0) {
          path = pts;
        }

        if (cancelled) return;
        const poly = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: mapRef.current,
          zIndex: 1,
        });
        polylinesRef.current.push(poly);
      }
    })();

    if (visibleEntregas.length === 1) {
      mapRef.current.setCenter(bounds.getCenter());
      mapRef.current.setZoom(14);
    } else {
      mapRef.current.fitBounds(bounds, 80);
    }
    return () => { cancelled = true; };
  }, [ready, visibleEntregas, rutas, vehiculos, plazas, navigate]);

  // Group counts per plaza for legend
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    visibleEntregas.forEach((e) => {
      const ruta = rutas.find((r) => r.id === e.ruta_id);
      const pid = ruta?.plaza_id || "sin";
      out[pid] = (out[pid] || 0) + 1;
    });
    return out;
  }, [visibleEntregas, rutas]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-6 text-sm">
        Error cargando Google Maps: {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-sm text-muted-foreground">
          Cargando mapa...
        </div>
      )}

      {/* Legend overlay */}
      {ready && visibleEntregas.length > 0 && (
        <Card className="absolute top-3 left-3 p-3 max-w-[260px] shadow-lg bg-background/95 backdrop-blur">
          <p className="text-xs font-semibold mb-2 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Entregas por plaza
          </p>
          <div className="space-y-1">
            {Object.entries(counts).map(([pid, count]) => {
              const plaza = plazas.find((p) => p.id === pid);
              return (
                <div key={pid} className="flex items-center justify-between text-xs">
                  <span>{plaza?.nombre || "Sin plaza"}</span>
                  <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filtros overlay */}
      {ready && (
        <Card className={cn(
          "absolute top-3 right-3 shadow-lg bg-background/95 backdrop-blur transition-all",
          filtersOpen ? "p-3 w-[280px] space-y-2" : "p-1.5 w-auto"
        )}>
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => setFiltersOpen(v => !v)}
              className="text-xs font-semibold flex items-center gap-1 hover:text-primary transition-colors px-1"
              title={filtersOpen ? "Colapsar filtros" : "Expandir filtros"}
            >
              <Filter className="h-3.5 w-3.5" />
              {filtersOpen && <span>Filtros</span>}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{activeFilterCount}</Badge>
              )}
              {filtersOpen
                ? <ChevronUp className="h-3.5 w-3.5 ml-0.5 opacity-60" />
                : <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-60" />}
            </button>
            {filtersOpen && activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpiar
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="space-y-2 pt-1">
              {/* Ruta */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-light">Ruta</label>
                <Select value={rutaFilter} onValueChange={setRutaFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las rutas</SelectItem>
                    {rutasDisponibles.map((r) => {
                      const veh = vehiculos.find((v) => v.id === r.vehiculo_id);
                      const plaza = plazas.find((p) => p.id === r.plaza_id);
                      const fechaTxt = r.fecha_entrega
                        ? format(new Date(r.fecha_entrega + "T12:00:00"), "dd MMM", { locale: es })
                        : "";
                      const label = `${plaza?.nombre || "—"} · ${veh?.nombre || "—"}${fechaTxt ? " · " + fechaTxt : ""}`;
                      return <SelectItem key={r.id} value={r.id}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Repartidor */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-light">Repartidor</label>
                <Select value={repartidorFilter} onValueChange={setRepartidorFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los repartidores</SelectItem>
                    {repartidores.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-light">Fecha</label>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    ["all", "Todas"],
                    ["today", "Hoy"],
                    ["yesterday", "Ayer"],
                    ["7d", "7 días"],
                    ["month", "Mes"],
                    ["custom", "Rango"],
                  ] as [DatePreset, string][]).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={datePreset === key ? "default" : "outline"}
                      className="h-7 text-[10px] px-1"
                      onClick={() => setDatePreset(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {datePreset === "custom" && (
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-7 text-[10px] justify-start", !customFrom && "text-muted-foreground")}>
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {customFrom ? format(customFrom, "dd MMM", { locale: es }) : "Desde"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("h-7 text-[10px] justify-start", !customTo && "text-muted-foreground")}>
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {customTo ? format(customTo, "dd MMM", { locale: es }) : "Hasta"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                {dateRange && datePreset !== "all" && (
                  <p className="text-[10px] text-muted-foreground font-light">
                    {format(dateRange.from, "dd MMM yyyy", { locale: es })} – {format(dateRange.to, "dd MMM yyyy", { locale: es })}
                  </p>
                )}
              </div>

              <div className="pt-1 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Mostrando</span>
                <Badge variant="secondary" className="text-[10px]">{visibleEntregas.length}</Badge>
              </div>
            </div>
          )}
        </Card>
      )}

      {ready && visibleEntregas.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none">
          <Truck className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No hay entregas con ubicación para mostrar</p>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
