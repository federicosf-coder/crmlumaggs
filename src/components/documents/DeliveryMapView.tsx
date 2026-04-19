import { useEffect, useMemo, useRef, useState } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, ExternalLink, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";

type Entrega = {
  id: string;
  documento_id: string;
  ruta_id: string | null;
  fecha_entrega: string;
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

interface DeliveryMapViewProps {
  entregas: Entrega[];
  rutas: Ruta[];
  vehiculos: Vehiculo[];
  plazas: Plaza[];
  selectedPlaza: string;
}

// Returns SVG markup for a colored pin with a vehicle silhouette
function buildPinSvg(color: string, icon: "pickup" | "truck") {
  // Truck silhouette (Lucide-like, simplified)
  const truckPath = `M3 7h11v8H3z M14 10h4l3 3v2h-7z M6 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M17 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z`;
  // Pickup silhouette (simpler box + bed)
  const pickupPath = `M3 9h8v6H3z M11 11h4l4 2v2h-8z M6 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M16 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z`;
  const path = icon === "pickup" ? pickupPath : truckPath;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
  <path d="M20 0 C9 0 0 9 0 20 C0 32 20 50 20 50 C20 50 40 32 40 20 C40 9 31 0 20 0 Z"
    fill="${color}" stroke="#ffffff" stroke-width="2"/>
  <g transform="translate(8, 8) scale(1)" fill="#ffffff" stroke="#ffffff" stroke-width="0.5">
    <path d="${path}" />
  </g>
</svg>`;
}

export function DeliveryMapView({ entregas, rutas, vehiculos, plazas, selectedPlaza }: DeliveryMapViewProps) {
  const { ready, error } = useGoogleMaps();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);

  // Filter entregas by plaza
  const visibleEntregas = useMemo(() => {
    return entregas.filter((e) => {
      const ruta = rutas.find((r) => r.id === e.ruta_id);
      if (!ruta) return false;
      if (selectedPlaza !== "all" && ruta.plaza_id !== selectedPlaza) return false;
      const lat = e.documentos?.direccion_envio_lat;
      const lng = e.documentos?.direccion_envio_lng;
      return typeof lat === "number" && typeof lng === "number";
    });
  }, [entregas, rutas, selectedPlaza]);

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

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (visibleEntregas.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    visibleEntregas.forEach((e) => {
      const ruta = rutas.find((r) => r.id === e.ruta_id);
      const vehiculo = ruta ? vehiculos.find((v) => v.id === ruta.vehiculo_id) : null;
      const color = vehiculo?.color || "#3b82f6";
      const icon = (vehiculo?.icon || "truck") as "pickup" | "truck";

      const lat = Number(e.documentos.direccion_envio_lat);
      const lng = Number(e.documentos.direccion_envio_lng);
      const position = { lat, lng };
      bounds.extend(position);

      const svg = buildPinSvg(color, icon);
      const marker = new google.maps.Marker({
        position,
        map: mapRef.current,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(40, 50),
          anchor: new google.maps.Point(20, 50),
        },
        title: e.documentos?.companies?.name || "Entrega",
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
            btn.onclick = () => navigate(`/delivery/entrega/${e.documento_id}`);
          }
        });
      });

      markersRef.current.push(marker);
    });

    if (visibleEntregas.length === 1) {
      mapRef.current.setCenter(bounds.getCenter());
      mapRef.current.setZoom(14);
    } else {
      mapRef.current.fitBounds(bounds, 80);
    }
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
