import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  CalendarIcon, ArrowLeft, GripVertical, Truck, Plus, Check, Image as ImageIcon,
  Pencil, Trash2, Package, ListChecks, Search, PanelLeftClose, PanelLeftOpen,
  ClipboardCheck, MapPin, Lock, Unlock, Map as MapIcon, List as ListIcon, FileText, Play, Flag, Eye,
  Route as RouteIcon, Clock, Timer, AlertTriangle, Save, ArrowDownUp,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/supabasePagination";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragOverlay, useDroppable, type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AddressDisplay } from "@/components/AddressDisplay";
import { DeliveryMapView } from "@/components/documents/DeliveryMapView";
import { haversineKm, minutesFromKm, formatHm, ROUTE_AVG_SPEED_KMH } from "@/lib/geo";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { geocodeAddressInput, reverseGeocodeCoords } from "@/lib/googleMapsGeocoding";

// ─── Status config ───────────────────────────────────────────
const POOL_STATUSES = ["confirmado_cliente", "espera_autorizacion_precio", "precio_autorizado", "validado_contabilidad"] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmado_cliente: { label: "Confirmado Cliente", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700" },
  espera_autorizacion_precio: { label: "Espera Autorización", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" },
  precio_autorizado: { label: "Precio Autorizado", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700" },
  validado_contabilidad: { label: "Validado Contabilidad", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" },
  programado_entrega: { label: "Programado Entrega", color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700" },
  entregado: { label: "Entregado", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700" },
  cancelado: { label: "Cancelado", color: "text-gray-700 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700" },
  entrega_corporativa: { label: "Entrega Corporativa", color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700" },
};

// ─── Types ────────────────────────────────────────────────────
type PoolItem = {
  id: string;
  type: "pedido" | "tarea";
  title: string;
  subtitle: string;
  address?: string;
  total?: number;
  unidades?: number;
  estatus: string;
  plaza_id?: string;
  fecha_documento?: string;
  raw: any;
};

// ─── Draggable Card ──────────────────────────────────────────
function DraggablePoolCard({ item, footerActions, onView }: { item: PoolItem; footerActions?: React.ReactNode; onView?: (item: PoolItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const cfg = STATUS_CONFIG[item.estatus] || STATUS_CONFIG.confirmado_cliente;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={cn("border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-colors w-full max-w-full overflow-hidden", cfg.bg)}>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            {item.type === "tarea" ? <ListChecks className="h-3.5 w-3.5 shrink-0" /> : <Package className="h-3.5 w-3.5 shrink-0" />}
            <span className="font-medium text-sm truncate">{item.title}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
          {item.fecha_documento && (
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">📅 {format(new Date(item.fecha_documento + "T12:00:00"), "dd MMM yyyy", { locale: es })}</p>
          )}
          {item.address && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 min-w-0">
              <span className="truncate">📍 {item.address}</span>
              <AddressDisplay address={item.address} iconOnly />
            </p>
          )}
        </div>
        <div className="text-right shrink-0 max-w-[110px]">
          {item.unidades != null && item.unidades > 0 && (
            <span className="text-sm font-semibold">
              {new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(item.unidades)} u
            </span>
          )}
          <Badge variant="outline" className={cn("text-[10px] mt-1 inline-block whitespace-normal leading-tight", cfg.color)}>{cfg.label}</Badge>
        </div>
      </div>
      {onView && item.type === "pedido" && (
        <div className="mt-2 pt-2 border-t border-border/50" onPointerDown={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 px-3"
            onClick={(e) => { e.stopPropagation(); onView(item); }}
          >
            <FileText className="h-3.5 w-3.5" />
            Ir al Pedido
          </Button>
        </div>
      )}
      {footerActions && (
        <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2" onPointerDown={(e) => e.stopPropagation()}>
          {footerActions}
        </div>
      )}
    </div>
  );
}

// ─── Overlay Card (while dragging) ───────────────────────────
function OverlayCard({ item }: { item: PoolItem }) {
  const cfg = STATUS_CONFIG[item.estatus] || STATUS_CONFIG.confirmado_cliente;
  return (
    <div className={cn("border rounded-lg p-4 shadow-xl", cfg.bg)} style={{ width: 320 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            {item.type === "tarea" ? <ListChecks className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
            <span className="font-medium text-sm truncate">{item.title}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
          {item.fecha_documento && (
            <p className="text-xs text-muted-foreground mt-0.5">📅 {format(new Date(item.fecha_documento + "T12:00:00"), "dd MMM yyyy", { locale: es })}</p>
          )}
        </div>
        {item.unidades != null && item.unidades > 0 && (
          <span className="text-sm font-semibold">
            {new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(item.unidades)} u
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Route Drop Column ───────────────────────────────────────
// Pequeña fila bajo cada entrega con km / tiempo estimado / tiempo real y
// captura manual de coordenadas cuando el documento no las tiene.
function DeliveryTrackingRow({ item, onSaveTiempoReal, onSaveKmManual, onSaveDocCoords }: {
  item: any;
  onSaveTiempoReal?: (docId: string, minutes: number | null) => void;
  onSaveKmManual?: (docId: string, km: number | null) => void;
  onSaveDocCoords?: (docId: string, lat: number, lng: number, address?: string | null) => void | Promise<void>;
}) {
  const entrega = item?.entrega || {};
  const hasCoords = item?.lat != null && item?.lng != null;
  const km = entrega.km_desde_anterior != null ? Number(entrega.km_desde_anterior) : null;
  const estMin = entrega.tiempo_estimado_min != null ? Number(entrega.tiempo_estimado_min) : null;
  const [real, setReal] = useState<string>(entrega.tiempo_real_min != null ? String(entrega.tiempo_real_min) : "");
  const [kmManual, setKmManual] = useState<string>(km != null ? String(km) : "");
  const [showCoords, setShowCoords] = useState(false);
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [geocoding, setGeocoding] = useState(false);
  const { ready: gmapsReady } = useGoogleMaps();

  useEffect(() => {
    setReal(entrega.tiempo_real_min != null ? String(entrega.tiempo_real_min) : "");
    setKmManual(km != null ? String(km) : "");
  }, [entrega.tiempo_real_min, km]);

  const geocodeFromAddress = async () => {
    const addr = item?.address || item?.raw?.direccion_envio;
    if (!addr) { toast.error("El pedido no tiene dirección de envío"); return; }
    if (!gmapsReady || !(window as any).google?.maps) { toast.error("Google Maps aún no está listo"); return; }
    try {
      setGeocoding(true);
      const result = await geocodeAddressInput(addr);
      await onSaveDocCoords?.(item.id, result.lat, result.lng, result.formattedAddress);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo calcular la ubicación");
    } finally {
      setGeocoding(false);
    }
  };

  // Auto-geocode: recalcula automáticamente las coordenadas cuando la dirección
  // se crea, edita o modifica (una vez por combinación documento + dirección),
  // incluso si ya existían coordenadas previas.
  const autoGeocodedRef = useRef<string | null>(null);
  useEffect(() => {
    const addr = item?.address || item?.raw?.direccion_envio;
    if (!addr || hasCoords || !gmapsReady || geocoding) return;
    const key = `${item?.id}::${addr}`;
    if (autoGeocodedRef.current === key) return;
    autoGeocodedRef.current = key;
    geocodeFromAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmapsReady, hasCoords, item?.id, item?.address, item?.raw?.direccion_envio]);

  return (
    <div className="mt-1 ml-0 rounded-md border bg-muted/30 px-2 py-1.5 text-[11px] space-y-1" onPointerDown={(e) => e.stopPropagation()}>
      {entrega.fecha_entrega_real && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span>✅ Entregada:</span>
          <span className="font-medium text-foreground">
            {format(new Date(entrega.fecha_entrega_real), "dd MMM yyyy · HH:mm", { locale: es })}
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 items-end">
        <div>
          <Label className="text-[10px] text-muted-foreground">Km recorridos</Label>
          {hasCoords ? (
            <div className="font-semibold">{km != null ? `${km.toFixed(2)} km` : "—"}</div>
          ) : (
            <Input
              type="number" step="any"
              className="h-7 text-xs"
              value={kmManual}
              onChange={(e) => setKmManual(e.target.value)}
              onBlur={() => onSaveKmManual?.(item.id, kmManual === "" ? null : Number(kmManual))}
              placeholder="Manual"
            />
          )}
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">T. estimado</Label>
          <div className="font-semibold">{estMin != null ? `${estMin} min` : "—"}</div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">T. real (min)</Label>
          <Input
            type="number" min="0"
            className="h-7 text-xs"
            value={real}
            onChange={(e) => setReal(e.target.value)}
            onBlur={() => onSaveTiempoReal?.(item.id, real === "" ? null : Number(real))}
          />
        </div>
      </div>
      {!hasCoords && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {(() => {
              const hasAddr = !!(item?.address || item?.raw?.direccion_envio);
              if (geocoding) {
                return (
                  <Badge variant="outline" className="text-[10px] gap-1 border-blue-300 text-blue-700 bg-blue-50">
                    <MapPin className="h-3 w-3 animate-pulse" /> Calculando ubicación…
                  </Badge>
                );
              }
              if (hasAddr) {
                return (
                  <Badge variant="outline" className="text-[10px] gap-1 border-blue-300 text-blue-700 bg-blue-50">
                    <MapPin className="h-3 w-3" /> Ubicación pendiente de calcular
                  </Badge>
                );
              }
              return (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-400 text-amber-700 bg-amber-50">
                  <AlertTriangle className="h-3 w-3" /> Sin dirección de envío
                </Badge>
              );
            })()}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                disabled={geocoding || !gmapsReady || !(item?.address || item?.raw?.direccion_envio)}
                onClick={geocodeFromAddress}
                title="Calcular ubicación desde la dirección del pedido"
              >
                <MapPin className="h-3 w-3 mr-1" />
                {geocoding ? "Calculando..." : "Calcular desde dirección"}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowCoords(v => !v)}>
                {showCoords ? "Cerrar" : "Manual"}
              </Button>
            </div>
          </div>
          {showCoords && (
            <div className="grid grid-cols-[1fr_1fr_auto] gap-1 items-end">
              <Input type="number" step="any" placeholder="Lat" className="h-7 text-xs" value={lat} onChange={(e) => setLat(e.target.value)} />
              <Input type="number" step="any" placeholder="Lng" className="h-7 text-xs" value={lng} onChange={(e) => setLng(e.target.value)} />
              <Button
                size="sm" className="h-7 text-[10px] px-2"
                disabled={!lat || !lng}
                onClick={async () => {
                  const la = Number(lat);
                  const ln = Number(lng);
                  if (!Number.isFinite(la) || !Number.isFinite(ln)) { toast.error("Coordenadas inválidas"); return; }
                  setGeocoding(true);
                  try {
                    const result = gmapsReady ? await reverseGeocodeCoords(la, ln) : { lat: la, lng: ln, formattedAddress: null };
                    await onSaveDocCoords?.(item.id, result.lat, result.lng, result.formattedAddress);
                    setShowCoords(false);
                  } catch (e: any) {
                    toast.error(e?.message || "No se pudo calcular la dirección");
                  } finally {
                    setGeocoding(false);
                  }
                }}
              >
                <Save className="h-3 w-3 mr-1" />Guardar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RouteDropColumn({ ruta, items, vehiculos, repartidoresAll, repartidoresRuta, onEditRoute, onDeleteRoute, onDeliver, onReorder, onToggleCerrada, onStartRoute, onFinishRoute, onSortByRealTime, onSaveTiempoReal, onSaveKmManual, onSaveDocCoords, onAdjustRouteTime, onResetRouteTime, isAdmin }: {
  ruta: any;
  items: PoolItem[];
  vehiculos: any[];
  repartidoresAll: any[];
  repartidoresRuta: any[];
  onEditRoute: (ruta: any) => void;
  onDeleteRoute: (rutaId: string) => void;
  onDeliver: (item: PoolItem) => void;
  onReorder: (rutaId: string, items: PoolItem[]) => void;
  onToggleCerrada: (ruta: any) => void;
  onStartRoute: (ruta: any) => void;
  onFinishRoute: (ruta: any) => void;
  onSortByRealTime?: (ruta: any) => void;
  onSaveTiempoReal?: (docId: string, minutes: number | null) => void;
  onSaveKmManual?: (docId: string, km: number | null) => void;
  onSaveDocCoords?: (docId: string, lat: number, lng: number, address?: string | null) => void | Promise<void>;
  onAdjustRouteTime?: (ruta: any, mode: "start" | "finish") => void;
  onResetRouteTime?: (ruta: any, mode: "start" | "finish") => void;
  isAdmin?: boolean;
}) {
  const navigate = useNavigate();
  const cerrada = !!ruta.cerrada;
  const { setNodeRef, isOver } = useDroppable({ id: `ruta-${ruta.id}`, disabled: cerrada });
  const vehiculo = vehiculos.find((v: any) => v.id === ruta.vehiculo_id);
  const repartidorNames = repartidoresRuta.map(rr => {
    const rep = repartidoresAll.find((r: any) => r.id === rr.repartidor_id);
    return rep?.nombre || "?";
  });

  // Resumen de ruta a partir de los entregas attached
  const totalKm = items.reduce((s, it: any) => s + (Number(it.entrega?.km_desde_anterior) || 0), 0);
  const totalEstMin = items.reduce((s, it: any) => s + (Number(it.entrega?.tiempo_estimado_min) || 0), 0);
  const totalRealMin = items.reduce((s, it: any) => s + (Number(it.entrega?.tiempo_real_min) || 0), 0);

  return (
    <div ref={setNodeRef}
      className={cn("border rounded-xl p-3 min-w-[320px] w-[340px] shrink-0 flex flex-col transition-colors",
        isOver ? "bg-accent/50 border-primary" : "bg-card",
        cerrada && "opacity-75 border-dashed")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Truck className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{vehiculo?.nombre || "Sin vehículo"}</span>
            {vehiculo?.placas && <span className="text-xs text-muted-foreground">({vehiculo.placas})</span>}
            {cerrada && <Badge variant="secondary" className="text-[10px] gap-1"><Lock className="h-3 w-3" />Cerrada</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            👤 {repartidorNames.length > 0 ? repartidorNames.join(", ") : "Sin repartidor"}
          </p>
          <p className="text-xs text-muted-foreground">
            📅 {ruta.fecha_entrega ? format(new Date(ruta.fecha_entrega + "T12:00:00"), "dd MMM yyyy", { locale: es }) : "Sin fecha"}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Ordenar paradas por hora real de entrega (ascendente)"
            onClick={() => onSortByRealTime?.(ruta)}
            disabled={cerrada}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title={cerrada ? "Reabrir ruta" : "Cerrar ruta"} onClick={() => onToggleCerrada(ruta)}>
            {cerrada ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditRoute(ruta)} disabled={cerrada}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("¿Eliminar esta ruta y devolver pedidos al pool?")) onDeleteRoute(ruta.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <Separator className="mb-2" />

      {/* Iniciar / Finalizar ruta */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="flex items-stretch gap-1">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5 px-2 bg-green-800 hover:bg-green-900 text-white disabled:opacity-60"
            disabled={!!ruta.ruta_started_at || cerrada}
            onClick={() => onStartRoute(ruta)}
            title={ruta.ruta_started_at ? `Iniciada ${format(new Date(ruta.ruta_started_at), "dd MMM HH:mm", { locale: es })}` : "Marcar inicio de ruta al salir de planta"}
          >
            <Play className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {ruta.ruta_started_at
                ? `Iniciada ${format(new Date(ruta.ruta_started_at), "HH:mm", { locale: es })}`
                : "Iniciar ruta"}
            </span>
          </Button>
          {isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-7 shrink-0" title="Ajustar / Reiniciar inicio">
                  <Pencil className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="end">
                <button
                  type="button"
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent"
                  onClick={() => onAdjustRouteTime?.(ruta, "start")}
                >
                  Ajustar manualmente
                </button>
                <button
                  type="button"
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent text-destructive disabled:opacity-50"
                  disabled={!ruta.ruta_started_at}
                  onClick={() => onResetRouteTime?.(ruta, "start")}
                >
                  Reiniciar
                </button>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="flex items-stretch gap-1">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5 px-2 bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
            disabled={!ruta.ruta_started_at || !!ruta.ruta_finished_at || cerrada}
            onClick={() => onFinishRoute(ruta)}
            title={ruta.ruta_finished_at ? `Finalizada ${format(new Date(ruta.ruta_finished_at), "dd MMM HH:mm", { locale: es })}` : "Marcar fin de ruta"}
          >
            <Flag className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {ruta.ruta_finished_at
                ? `Finalizada ${format(new Date(ruta.ruta_finished_at), "HH:mm", { locale: es })}`
                : "Ruta Finalizada"}
            </span>
          </Button>
          {isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-7 shrink-0" title="Ajustar / Reiniciar fin">
                  <Pencil className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="end">
                <button
                  type="button"
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent"
                  onClick={() => onAdjustRouteTime?.(ruta, "finish")}
                >
                  Ajustar manualmente
                </button>
                <button
                  type="button"
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent text-destructive disabled:opacity-50"
                  disabled={!ruta.ruta_finished_at}
                  onClick={() => onResetRouteTime?.(ruta, "finish")}
                >
                  Reiniciar
                </button>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      {(ruta.ruta_started_at_editada_por || ruta.ruta_finished_at_editada_por) && (
        <p className="text-[10px] text-muted-foreground mb-2 -mt-1">
          ✎ Hora ajustada manualmente
        </p>
      )}

      {/* Resumen de ruta: km y tiempos */}
      <div className="rounded-md border bg-muted/40 px-2 py-1.5 mb-2 space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground"><RouteIcon className="h-3 w-3" />Total km estimados</span>
          <span className="font-semibold">{totalKm.toFixed(1)} km</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />Tiempo estimado</span>
          <span className="font-semibold">{formatHm(totalEstMin)} h</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-muted-foreground"><Timer className="h-3 w-3" />Tiempo real acumulado</span>
          <span className="font-semibold">{formatHm(totalRealMin)} h</span>
        </div>
        {ruta?.plazas && (ruta.plazas.lat == null || ruta.plazas.lng == null) && (
          <p className="text-[10px] text-amber-700 flex items-center gap-1 pt-0.5"><AlertTriangle className="h-3 w-3" />Plaza sin coordenadas: la primera entrega no calcula km automáticos.</p>
        )}
      </div>

      {/* Items */}
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 flex-1 min-h-[80px]">
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Package className="h-6 w-6 mb-1 opacity-40" />
              <p className="text-xs">Arrastra pedidos aquí</p>
            </div>
          )}
          {items.map((item, idx) => (
            <div key={item.id} className="relative group">
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-10">
                <Badge variant="outline" className="text-[10px] px-1.5 font-mono bg-background">{idx + 1}</Badge>
              </div>
              <div className="pl-5">
                <DraggablePoolCard
                  item={item}
                  footerActions={
                    item.type === "pedido" ? (
                      <PedidoFooterActions item={item} />
                    ) : undefined
                  }
                />
                <DeliveryTrackingRow
                  item={item as any}
                  onSaveTiempoReal={onSaveTiempoReal}
                  onSaveKmManual={onSaveKmManual}
                  onSaveDocCoords={onSaveDocCoords}
                />
              </div>
            </div>
          ))}

        </div>
      </SortableContext>

      <Separator className="mt-2 mb-1" />
      {(() => {
        const presSummary: Record<string, number> = {};
        items.forEach(item => {
          if (item.type === "pedido" && item.raw?.documento_productos) {
            (item.raw.documento_productos as any[]).forEach((dp: any) => {
              const presName = dp.productos?.presentaciones?.nombre || "Sin presentación";
              presSummary[presName] = (presSummary[presName] || 0) + Number(dp.cantidad);
            });
          }
        });
        const summaryText = Object.entries(presSummary).map(([name, qty]) => `${qty} ${name}`).join(", ");
        return summaryText ? (
          <p className="text-[11px] text-muted-foreground truncate mb-0.5">📦 {summaryText}</p>
        ) : null;
      })()}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{items.length} items</span>
        <span>{new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(items.reduce((s, i) => s + (i.unidades || 0), 0))} u</span>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
function PedidoFooterActions({ item }: { item: any }) {
  const [open, setOpen] = useState<null | "mapa" | "editar" | "entrega">(null);
  const title = open === "mapa" ? "Mapa" : open === "editar" ? "Editar pedido" : "Entrega";
  const src =
    open === "mapa"
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address || "")}`
      : open === "editar"
      ? `/documents/${item.id}/edit?embed=1`
      : open === "entrega"
      ? `/delivery/entrega/${item.id}?embed=1`
      : "";
  return (
    <>
      {item.address && (
        <Button
          size="sm"
          variant="secondary"
          className="h-11 sm:h-8 px-3 gap-1.5 shadow"
          title="Abrir mapa"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen("mapa"); }}
        >
          <MapPin className="h-4 w-4" />
          <span className="text-xs">Mapa</span>
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="h-11 sm:h-8 px-3 gap-1.5 shadow"
        title="Ver / editar pedido"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen("editar"); }}
      >
        <FileText className="h-4 w-4" />
        <span className="text-xs">Editar</span>
      </Button>
      <Button
        size="sm"
        variant="default"
        className="h-11 sm:h-8 px-3 gap-1.5 shadow"
        title="Abrir entrega"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen("entrega"); }}
      >
        <ClipboardCheck className="h-4 w-4" />
        <span className="text-xs">Entrega</span>
      </Button>
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-4 py-3 pr-12 border-b shrink-0">
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="truncate">{title}</span>
              {src && (
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
                >
                  Abrir en pestaña
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {src && (
            <iframe src={src} title={title} className="flex-1 w-full border-0" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DeliverySchedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [showPool, setShowPool] = useState(true);
  const [searchPool, setSearchPool] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeItem, setActiveItem] = useState<PoolItem | null>(null);
  const [selectedPlaza, setSelectedPlaza] = useState<string>("all");
  const [routeViewMode, setRouteViewMode] = useState<"list" | "calendar">("list");
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);
  const [mainView, setMainView] = useState<"kanban" | "map">("kanban");

  // Route items keyed by ruta id
  const [routeItems, setRouteItems] = useState<Record<string, PoolItem[]>>({});

  // Dialogs
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  const [newPlaza, setNewPlaza] = useState("");
  const [newFecha, setNewFecha] = useState<Date | undefined>(undefined);
  const [newVehiculo, setNewVehiculo] = useState("");
  const [newRepartidores, setNewRepartidores] = useState<string[]>([]);

  const [editRouteData, setEditRouteData] = useState<any>(null);
  const [editVehiculo, setEditVehiculo] = useState("");
  const [editRepartidores, setEditRepartidores] = useState<string[]>([]);
  const [editFecha, setEditFecha] = useState<Date | undefined>(undefined);

  const [deliverDialog, setDeliverDialog] = useState(false);
  const [deliverItem, setDeliverItem] = useState<PoolItem | null>(null);
  const [deliverNotes, setDeliverNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Ajuste manual de hora de inicio/fin de ruta
  const [adjustRoute, setAdjustRoute] = useState<{ ruta: any; mode: "start" | "finish" } | null>(null);
  const [adjustDate, setAdjustDate] = useState<Date | undefined>(undefined);
  const [adjustTime, setAdjustTime] = useState<string>("");
  const [adjustPickerOpen, setAdjustPickerOpen] = useState(false);
  const [savingAdjust, setSavingAdjust] = useState(false);

  // ─── Data queries ─────────────────────────────────────────
  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-active"],
    queryFn: async () => {
      const { data } = await supabase.from("plazas").select("*").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  const { data: vehiculos = [] } = useQuery({
    queryKey: ["vehiculos"],
    queryFn: async () => {
      const { data } = await supabase.from("vehiculos").select("*").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  const { data: repartidoresAll = [] } = useQuery({
    queryKey: ["repartidores"],
    queryFn: async () => {
      const { data } = await supabase.from("repartidores").select("*").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  // Pool: all pedidos with pool statuses, not yet programmed
  const { data: poolPedidos = [], refetch: refetchPool } = useQuery({
    queryKey: ["pool-pedidos"],
    queryFn: async () => {
      const q = supabase
        .from("documentos")
        .select("*, companies(name), documento_productos(cantidad, producto_id, productos(presentacion_id, presentaciones(nombre)))")
        .eq("tipo_documento", "pedido")
        .eq("is_active", true)
        .in("estatus_pedido", [...POOL_STATUSES])
        .order("created_at", { ascending: false });
      return await fetchAllRows<any>((from, to) => q.range(from, to));
    },
  });

  // Pool: entregas corporativas no entregadas
  const { data: poolCorporativas = [], refetch: refetchCorporativas } = useQuery({
    queryKey: ["pool-corporativas"],
    queryFn: async () => {
      const q = supabase
        .from("documentos")
        .select("*, companies(name), documento_productos(cantidad, producto_id, productos(presentacion_id, presentaciones(nombre)))")
        .eq("tipo_documento", "entrega_corporativa")
        .eq("is_active", true)
        .is("fecha_entrega_real", null)
        .order("created_at", { ascending: false });
      return await fetchAllRows<any>((from, to) => q.range(from, to));
    },
  });

  // All routes (no filter by date/plaza - show all active)
  const { data: allRutas = [], refetch: refetchRutas } = useQuery({
    queryKey: ["all-rutas-entrega"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rutas_entrega")
        .select("*, plazas(nombre, lat, lng)")
        .order("fecha_entrega", { ascending: true });
      return data || [];
    },
  });

  // All ruta_repartidores
  const { data: allRutaRepartidores = [], refetch: refetchRutaRepartidores } = useQuery({
    queryKey: ["all-ruta-repartidores"],
    queryFn: async () => {
      const { data } = await supabase.from("ruta_repartidores").select("*");
      return data || [];
    },
  });

  // All entregas_programadas
  const { data: allEntregas = [], refetch: refetchEntregas } = useQuery({
    queryKey: ["all-entregas-programadas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas_programadas")
        .select("*, documentos(*, companies(name), documento_productos(cantidad, producto_id, productos(presentacion_id, presentaciones(nombre))))")
        .order("orden_ruta");
      return data || [];
    },
  });

  // Build pool items
  const poolItems = useMemo<PoolItem[]>(() => {
    const scheduledDocIds = new Set(allEntregas.map((e: any) => e.documento_id));
    // TODO: also track scheduled tasks if we add task scheduling

    const pedidoItems: PoolItem[] = poolPedidos
      .filter((p: any) =>
        p.tipo_documento === "pedido" &&
        p.is_active === true &&
        (POOL_STATUSES as readonly string[]).includes(p.estatus_pedido) &&
        !scheduledDocIds.has(p.id) &&
        // Sólo aparecen pedidos con dirección de envío asignada (FK a direcciones_empresa
        // o, por compatibilidad, dirección con coordenadas heredadas).
        (p.direccion_envio_id ||
          (p.direccion_envio && p.direccion_envio_lat != null && p.direccion_envio_lng != null))
      )
      .map((p: any) => {
        // Group quantities by presentacion
        const presByName: Record<string, number> = {};
        (p.documento_productos || []).forEach((dp: any) => {
          const presName = dp.productos?.presentaciones?.nombre || "Sin presentación";
          presByName[presName] = (presByName[presName] || 0) + Number(dp.cantidad);
        });
        const productSummary = Object.entries(presByName)
          .map(([name, qty]) => `${qty} ${name}`)
          .join(", ") || "Sin productos";

        return {
          id: p.id,
          type: "pedido" as const,
          title: p.companies?.name || "Sin cliente",
          subtitle: productSummary,
          address: p.direccion_envio || undefined,
          total: Number(p.total) || 0,
          unidades: Number(p.unidades_equivalentes_total) || 0,
          estatus: p.estatus_pedido || "confirmado_cliente",
          plaza_id: p.plaza_id || undefined,
          fecha_documento: p.fecha_documento || undefined,
          raw: p,
        };
      });

    const corporativaItems: PoolItem[] = (poolCorporativas || [])
      .filter((p: any) => !scheduledDocIds.has(p.id))
      .map((p: any) => {
        const presByName: Record<string, number> = {};
        (p.documento_productos || []).forEach((dp: any) => {
          const presName = dp.productos?.presentaciones?.nombre || "Sin presentación";
          presByName[presName] = (presByName[presName] || 0) + Number(dp.cantidad);
        });
        const productSummary = Object.entries(presByName)
          .map(([name, qty]) => `${qty} ${name}`)
          .join(", ") || "Entrega corporativa";
        return {
          id: p.id,
          type: "pedido" as const,
          title: p.companies?.name || "Sin cliente",
          subtitle: productSummary,
          address: p.direccion_envio || undefined,
          total: Number(p.total) || 0,
          unidades: Number(p.unidades_equivalentes_total) || 0,
          estatus: "entrega_corporativa",
          plaza_id: p.plaza_id || undefined,
          fecha_documento: p.fecha_documento || undefined,
          raw: p,
        };
      });

    return [...pedidoItems, ...corporativaItems];
  }, [poolPedidos, poolCorporativas, allEntregas]);

  // Pedidos en estatus de pool que NO tienen dirección de envío asignada.
  // Se excluyen del pool principal y se muestran como advertencia.
  const pedidosSinDireccion = useMemo(() => {
    const scheduledDocIds = new Set(allEntregas.map((e: any) => e.documento_id));
    return (poolPedidos as any[]).filter(
      (p) =>
        p.is_active === true &&
        (POOL_STATUSES as readonly string[]).includes(p.estatus_pedido) &&
        !scheduledDocIds.has(p.id) &&
        !p.direccion_envio_id &&
        !(p.direccion_envio && p.direccion_envio_lat != null && p.direccion_envio_lng != null),
    );
  }, [poolPedidos, allEntregas]);

  // Build route items from entregas
  useEffect(() => {
    const map: Record<string, PoolItem[]> = {};
    for (const ruta of allRutas) {
      const entregas = allEntregas.filter((e: any) => e.ruta_id === ruta.id);
      map[ruta.id] = entregas.map((e: any) => {
        const doc = e.documentos;
        // Group quantities by presentacion (same logic as pool)
        const presByName: Record<string, number> = {};
        (doc?.documento_productos || []).forEach((dp: any) => {
          const presName = dp.productos?.presentaciones?.nombre || "Sin presentación";
          presByName[presName] = (presByName[presName] || 0) + Number(dp.cantidad);
        });
        const productSummary = Object.entries(presByName)
          .map(([name, qty]) => `${qty} ${name}`)
          .join(", ") || "Sin productos";

        return {
          id: e.documento_id,
          type: "pedido" as const,
          title: doc?.companies?.name || "Sin cliente",
          subtitle: productSummary,
          address: doc?.direccion_envio || undefined,
          total: Number(doc?.total) || 0,
          unidades: Number(doc?.unidades_equivalentes_total) || 0,
          estatus: doc?.estatus_pedido || "programado_entrega",
          plaza_id: doc?.plaza_id || undefined,
          fecha_documento: doc?.fecha_documento || undefined,
          raw: doc,
          // Tracking de distancia / tiempo (consumido por RouteDropColumn)
          entrega: e,
          lat: doc?.direccion_envio_lat ?? null,
          lng: doc?.direccion_envio_lng ?? null,
        };
      });
    }
    setRouteItems(map);
  }, [allRutas, allEntregas]);

  // Filter rutas by selected plaza
  const filteredRutas = useMemo(() => {
    let rutas = allRutas;
    if (selectedPlaza !== "all") rutas = rutas.filter((r: any) => r.plaza_id === selectedPlaza);
    if (routeViewMode === "calendar" && calendarDate) {
      const dateStr = format(calendarDate, "yyyy-MM-dd");
      rutas = rutas.filter((r: any) => r.fecha_entrega === dateStr);
    }
    return rutas;
  }, [allRutas, selectedPlaza, routeViewMode, calendarDate]);

  // Group rutas by plaza, then by day
  const rutasByPlazaDay = useMemo(() => {
    const groups: Record<string, { plaza: any; days: Record<string, any[]> }> = {};
    for (const ruta of filteredRutas) {
      const pid = ruta.plaza_id;
      if (!groups[pid]) {
        groups[pid] = { plaza: ruta.plazas || { nombre: "Sin plaza" }, days: {} };
      }
      const day = ruta.fecha_entrega || "sin-fecha";
      if (!groups[pid].days[day]) groups[pid].days[day] = [];
      groups[pid].days[day].push(ruta);
    }
    return groups;
  }, [filteredRutas]);

  // Dates that have rutas (for calendar highlighting)
  const rutaDates = useMemo(() => {
    let rutas = allRutas;
    if (selectedPlaza !== "all") rutas = rutas.filter((r: any) => r.plaza_id === selectedPlaza);
    return new Set(rutas.map((r: any) => r.fecha_entrega).filter(Boolean));
  }, [allRutas, selectedPlaza]);

  // Filter pool
  const filteredPool = useMemo(() => {
    let items = poolItems;
    if (filterStatus !== "all") items = items.filter(i => i.estatus === filterStatus);
    if (searchPool.trim()) {
      const q = searchPool.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q));
    }
    return items;
  }, [poolItems, filterStatus, searchPool]);

  // ─── DnD handlers ────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = (id: string): string | null => {
    if (poolItems.some(i => i.id === id)) return "pool";
    for (const [rutaId, items] of Object.entries(routeItems)) {
      if (items.some(i => i.id === id)) return rutaId;
    }
    return null;
  };

  // Recalcula km_desde_anterior y tiempo_estimado_min para todas las entregas de una ruta,
  // usando coordenadas del documento y la plaza de origen. Solo sobrescribe cuando hay coords;
  // si faltan, conserva los valores manuales existentes.
  const recalcRouteDistances = async (rutaId: string) => {
    const ruta = allRutas.find((r: any) => r.id === rutaId);
    const { data: entregas } = await supabase
      .from("entregas_programadas")
      .select("id, documento_id, orden_ruta, km_desde_anterior, tiempo_estimado_min, tiempo_real_min, fecha_entrega_real, documentos(direccion_envio_lat, direccion_envio_lng)")
      .eq("ruta_id", rutaId)
      .order("orden_ruta");
    if (!entregas) return;
    let prevLat: number | null = ruta?.plazas?.lat != null ? Number(ruta.plazas.lat) : null;
    let prevLng: number | null = ruta?.plazas?.lng != null ? Number(ruta.plazas.lng) : null;
    // Ancla temporal para tiempo_real_min: inicia en la salida de plaza (ruta_started_at).
    // Si no se ha iniciado la ruta, no se puede calcular el tiempo real automáticamente.
    let prevTs: number | null = ruta?.ruta_started_at ? new Date(ruta.ruta_started_at).getTime() : null;
    for (const e of entregas as any[]) {
      const doc = (e as any).documentos;
      const cLat = doc?.direccion_envio_lat != null ? Number(doc.direccion_envio_lat) : null;
      const cLng = doc?.direccion_envio_lng != null ? Number(doc.direccion_envio_lng) : null;
      const updates: any = {};
      if (prevLat != null && prevLng != null && cLat != null && cLng != null) {
        const km = Number(haversineKm(prevLat, prevLng, cLat, cLng).toFixed(2));
        const min = minutesFromKm(km);
        if (e.km_desde_anterior !== km) updates.km_desde_anterior = km;
        if (e.tiempo_estimado_min !== min) updates.tiempo_estimado_min = min;
      }
      // Tiempo real automático = (hora de entrega real de esta parada) - (hora de la parada anterior, o salida de plaza)
      if (e.fecha_entrega_real && prevTs != null) {
        const curTs = new Date(e.fecha_entrega_real).getTime();
        const realMin = Math.max(0, Math.round((curTs - prevTs) / 60000));
        if (e.tiempo_real_min !== realMin) updates.tiempo_real_min = realMin;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("entregas_programadas").update(updates).eq("id", e.id);
      }
      // Avanzar el ancla solo cuando hay coords del punto actual
      if (cLat != null && cLng != null) { prevLat = cLat; prevLng = cLng; }
      // Avanzar el ancla de tiempo solo cuando esta parada ya tiene hora real de entrega
      if (e.fecha_entrega_real) {
        prevTs = new Date(e.fecha_entrega_real).getTime();
      }
    }
    refetchEntregas();
  };

  // Guarda tiempo real (minutos) de una entrega
  const saveTiempoReal = async (rutaId: string, docId: string, minutes: number | null) => {
    const { error } = await supabase.from("entregas_programadas")
      .update({ tiempo_real_min: minutes })
      .eq("ruta_id", rutaId).eq("documento_id", docId);
    if (error) { toast.error(error.message); return; }
    refetchEntregas();
  };

  // Reordena las entregas de una ruta de forma ascendente por fecha_entrega_real.
  // Las paradas sin hora real se colocan al final, preservando su orden actual relativo.
  // Devuelve true si reordenó (o no había nada que cambiar) y false si hubo error.
  const sortRouteByRealTime = async (rutaId: string, opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    const { data: entregas, error } = await supabase
      .from("entregas_programadas")
      .select("id, orden_ruta, fecha_entrega_real")
      .eq("ruta_id", rutaId)
      .order("orden_ruta");
    if (error) { if (!silent) toast.error(error.message); return false; }
    if (!entregas || entregas.length === 0) return true;
    const conHora = (entregas as any[])
      .filter((e) => e.fecha_entrega_real)
      .sort((a, b) => new Date(a.fecha_entrega_real).getTime() - new Date(b.fecha_entrega_real).getTime());
    const sinHora = (entregas as any[]).filter((e) => !e.fecha_entrega_real);
    const ordenado = [...conHora, ...sinHora];
    let changes = 0;
    // Asignación en dos pasadas para evitar choques con el índice único (ruta_id, orden_ruta).
    // Paso 1: mover a un offset grande negativo temporal.
    for (let i = 0; i < ordenado.length; i++) {
      const e = ordenado[i] as any;
      const nuevo = i + 1;
      if (e.orden_ruta !== nuevo) {
        await supabase.from("entregas_programadas")
          .update({ orden_ruta: -(i + 1) - 1000 })
          .eq("id", e.id);
        changes++;
      }
    }
    // Paso 2: asignar el orden definitivo.
    if (changes > 0) {
      for (let i = 0; i < ordenado.length; i++) {
        const e = ordenado[i] as any;
        const nuevo = i + 1;
        if (e.orden_ruta !== nuevo) {
          await supabase.from("entregas_programadas")
            .update({ orden_ruta: nuevo })
            .eq("id", e.id);
        }
      }
      await refetchEntregas();
      // Recalcular km/tiempo estimado/real con el nuevo orden.
      await recalcRouteDistances(rutaId);
      if (!silent) toast.success("Paradas reordenadas por hora real de entrega");
    } else if (!silent) {
      toast.info("Las paradas ya estaban ordenadas por hora real");
    }
    return true;
  };

  // Guarda km capturados manualmente (cuando faltan coordenadas)
  const saveKmManual = async (rutaId: string, docId: string, km: number | null) => {
    const tiempoEstimado = km != null && km > 0 ? minutesFromKm(km) : null;
    const { error } = await supabase.from("entregas_programadas")
      .update({ km_desde_anterior: km, tiempo_estimado_min: tiempoEstimado })
      .eq("ruta_id", rutaId).eq("documento_id", docId);
    if (error) { toast.error(error.message); return; }
    refetchEntregas();
  };

  // Guarda coordenadas del documento de envío y, si viene de coordenadas/Google Maps,
  // también normaliza la dirección para que futuros cálculos no dependan del link corto.
  const saveDocCoords = async (rutaId: string, docId: string, lat: number, lng: number, address?: string | null) => {
    const updates: any = { direccion_envio_lat: lat, direccion_envio_lng: lng };
    if (address?.trim()) updates.direccion_envio = address.trim();
    const { error } = await supabase.from("documentos")
      .update(updates)
      .eq("id", docId);
    if (error) { toast.error(error.message); return; }
    toast.success("Coordenadas guardadas");
    await refetchEntregas();
    await recalcRouteDistances(rutaId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = poolItems.find(i => i.id === active.id) ||
      Object.values(routeItems).flat().find(i => i.id === active.id);
    setActiveItem(item || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const activeContainer = findContainer(active.id as string);
    let overContainer = findContainer(over.id as string);

    // Dropped on a ruta droppable zone
    if (String(over.id).startsWith("ruta-")) {
      overContainer = String(over.id).replace("ruta-", "");
    }

    if (!activeContainer || !overContainer) return;

    // Block any move involving a closed route (source or destination)
    const sourceRuta = activeContainer !== "pool" ? allRutas.find((r: any) => r.id === activeContainer) : null;
    const destRuta = overContainer !== "pool" ? allRutas.find((r: any) => r.id === overContainer) : null;
    if (sourceRuta?.cerrada || destRuta?.cerrada) {
      toast.error("La ruta está cerrada");
      return;
    }

    // Same container reorder
    if (activeContainer === overContainer && activeContainer !== "pool") {
      const items = routeItems[activeContainer] || [];
      const oldIdx = items.findIndex(i => i.id === active.id);
      const newIdx = items.findIndex(i => i.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const reordered = arrayMove(items, oldIdx, newIdx);
        setRouteItems(prev => ({ ...prev, [activeContainer]: reordered }));
        // Persist order
        for (let i = 0; i < reordered.length; i++) {
          await supabase.from("entregas_programadas")
            .update({ orden_ruta: i })
            .eq("documento_id", reordered[i].id)
            .eq("ruta_id", activeContainer);
        }
        await recalcRouteDistances(activeContainer);
      }
      return;
    }

    // Pool → Route
    if (activeContainer === "pool" && overContainer !== "pool") {
      const item = poolItems.find(i => i.id === active.id);
      if (!item) return;
      const ruta = allRutas.find((r: any) => r.id === overContainer);
      if (!ruta) return;

      if (item.type === "pedido") {
        // Doble verificación: si ya está programado en cualquier ruta, no duplicar
        const { data: existing } = await supabase
          .from("entregas_programadas")
          .select("id")
          .eq("documento_id", item.id)
          .maybeSingle();
        if (existing) {
          toast.warning("Este pedido ya está programado");
          refetchPool();
          refetchEntregas();
          return;
        }
        const { error } = await supabase.from("entregas_programadas").insert({
          documento_id: item.id,
          ruta_id: ruta.id,
          vehiculo_id: ruta.vehiculo_id,
          repartidor_id: ruta.repartidor_id,
          fecha_entrega: ruta.fecha_entrega,
          orden_ruta: (routeItems[ruta.id]?.length || 0),
        });
        if (error) {
          if ((error as any).code === "23505") {
            toast.warning("Este pedido ya está programado");
          } else {
            toast.error(error.message);
          }
          refetchPool();
          refetchEntregas();
          return;
        }
        const isCorp = item.raw?.tipo_documento === "entrega_corporativa";
        await supabase.from("documentos").update({
          ...(isCorp ? {} : { estatus_pedido: "programado_entrega" }),
          plaza_id: ruta.plaza_id,
          fecha_entrega_programada: ruta.fecha_entrega,
        }).eq("id", item.id);
        toast.success("Pedido programado en ruta");
      }

      refetchPool();
      refetchCorporativas();
      refetchEntregas();
      await recalcRouteDistances(ruta.id);
      return;
    }

    // Route → Pool (return to pool)
    if (activeContainer !== "pool" && overContainer === "pool") {
      const item = (routeItems[activeContainer] || []).find(i => i.id === active.id);
      if (!item || item.type !== "pedido") return;

      await supabase.from("entregas_programadas").delete()
        .eq("documento_id", item.id).eq("ruta_id", activeContainer);
      const isCorp = item.raw?.tipo_documento === "entrega_corporativa";
      await supabase.from("documentos").update({
        ...(isCorp ? {} : { estatus_pedido: "validado_contabilidad" }),
        fecha_entrega_programada: null,
      }).eq("id", item.id);
      toast.success("Pedido devuelto al pool");
      refetchPool();
      refetchCorporativas();
      refetchEntregas();
      await recalcRouteDistances(activeContainer);
      return;
    }

    // Route → different Route
    if (activeContainer !== "pool" && overContainer !== "pool" && activeContainer !== overContainer) {
      const item = (routeItems[activeContainer] || []).find(i => i.id === active.id);
      if (!item || item.type !== "pedido") return;
      const newRuta = allRutas.find((r: any) => r.id === overContainer);
      if (!newRuta) return;

      await supabase.from("entregas_programadas").update({
        ruta_id: newRuta.id,
        vehiculo_id: newRuta.vehiculo_id,
        repartidor_id: newRuta.repartidor_id,
        fecha_entrega: newRuta.fecha_entrega,
        orden_ruta: (routeItems[newRuta.id]?.length || 0),
      }).eq("documento_id", item.id).eq("ruta_id", activeContainer);

      await supabase.from("documentos").update({
        plaza_id: newRuta.plaza_id,
        fecha_entrega_programada: newRuta.fecha_entrega,
      }).eq("id", item.id);

      toast.success("Pedido movido a otra ruta");
      refetchEntregas();
      await recalcRouteDistances(activeContainer);
      await recalcRouteDistances(newRuta.id);
      return;
    }
  };

  // ─── Mutations ────────────────────────────────────────────
  const createRoute = useMutation({
    mutationFn: async () => {
      if (!newPlaza || !newVehiculo || !newFecha || newRepartidores.length === 0) throw new Error("Completa todos los campos");
      const dateStr = format(newFecha, "yyyy-MM-dd");
      const { data: ruta, error } = await supabase.from("rutas_entrega").insert({
        plaza_id: newPlaza,
        vehiculo_id: newVehiculo,
        repartidor_id: newRepartidores[0], // Legacy field - use first
        fecha_entrega: dateStr,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      // Insert all repartidores
      for (const repId of newRepartidores) {
        await supabase.from("ruta_repartidores").insert({ ruta_id: ruta.id, repartidor_id: repId });
      }
    },
    onSuccess: () => {
      toast.success("Ruta creada");
      setNewRouteOpen(false);
      setNewPlaza("");
      setNewVehiculo("");
      setNewFecha(undefined);
      setNewRepartidores([]);
      refetchRutas();
      refetchRutaRepartidores();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRoute = async (rutaId: string) => {
    const items = routeItems[rutaId] || [];
    for (const item of items) {
      if (item.type === "pedido") {
        const isCorp = item.raw?.tipo_documento === "entrega_corporativa";
        await supabase.from("documentos").update({
          ...(isCorp ? {} : { estatus_pedido: "validado_contabilidad" }),
          fecha_entrega_programada: null,
        }).eq("id", item.id);
      }
    }
    await supabase.from("entregas_programadas").delete().eq("ruta_id", rutaId);
    await supabase.from("ruta_repartidores").delete().eq("ruta_id", rutaId);
    await supabase.from("rutas_entrega").delete().eq("id", rutaId);
    toast.success("Ruta eliminada");
    refetchRutas();
    refetchEntregas();
    refetchPool();
    refetchCorporativas();
    refetchRutaRepartidores();
  };

  const removeItemFromRoute = async (itemId: string) => {
    const container = findContainer(itemId);
    if (!container || container === "pool") return;
    const item = (routeItems[container] || []).find(i => i.id === itemId);
    const isCorp = item?.raw?.tipo_documento === "entrega_corporativa";
    await supabase.from("entregas_programadas").delete()
      .eq("documento_id", itemId).eq("ruta_id", container);
    await supabase.from("documentos").update({
      ...(isCorp ? {} : { estatus_pedido: "validado_contabilidad" }),
      fecha_entrega_programada: null,
    }).eq("id", itemId);
    toast.success("Pedido devuelto al pool");
    refetchPool();
    refetchCorporativas();
    refetchEntregas();
  };

  const handleOpenEditRoute = (ruta: any) => {
    setEditRouteData(ruta);
    setEditVehiculo(ruta.vehiculo_id);
    setEditFecha(ruta.fecha_entrega ? new Date(ruta.fecha_entrega + "T12:00:00") : undefined);
    const reps = allRutaRepartidores.filter((rr: any) => rr.ruta_id === ruta.id).map((rr: any) => rr.repartidor_id);
    setEditRepartidores(reps.length > 0 ? reps : [ruta.repartidor_id]);
  };

  const saveEditRoute = async () => {
    if (!editRouteData) return;
    const dateStr = editFecha ? format(editFecha, "yyyy-MM-dd") : editRouteData.fecha_entrega;
    await supabase.from("rutas_entrega").update({
      vehiculo_id: editVehiculo,
      repartidor_id: editRepartidores[0] || editRouteData.repartidor_id,
      fecha_entrega: dateStr,
    }).eq("id", editRouteData.id);
    // Sync repartidores
    await supabase.from("ruta_repartidores").delete().eq("ruta_id", editRouteData.id);
    for (const repId of editRepartidores) {
      await supabase.from("ruta_repartidores").insert({ ruta_id: editRouteData.id, repartidor_id: repId });
    }
    toast.success("Ruta actualizada");
    setEditRouteData(null);
    refetchRutas();
    refetchRutaRepartidores();
  };

  const toggleRutaCerrada = async (ruta: any) => {
    const nuevoEstado = !ruta.cerrada;
    const { error } = await supabase.from("rutas_entrega").update({ cerrada: nuevoEstado }).eq("id", ruta.id);
    if (error) { toast.error(error.message); return; }
    toast.success(nuevoEstado ? "Ruta cerrada" : "Ruta reabierta");
    refetchRutas();
  };

  const handleStartRoute = async (ruta: any) => {
    if (ruta.ruta_started_at) return;
    if (!confirm("¿Confirmas el inicio de esta ruta? Se registrará la hora de salida de planta.")) return;
    const { error } = await supabase
      .from("rutas_entrega")
      .update({
        ruta_started_at: new Date().toISOString(),
        ruta_started_by: user?.id ?? null,
        estatus: "en_ruta",
      })
      .eq("id", ruta.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ruta iniciada");
    refetchRutas();
  };

  const handleFinishRoute = async (ruta: any) => {
    if (!ruta.ruta_started_at) { toast.error("Primero inicia la ruta"); return; }
    if (ruta.ruta_finished_at) return;
    // Antes de validar, reordena automáticamente las paradas por hora real de entrega
    // ascendente (las que no tengan hora real quedan al final preservando su orden actual).
    await sortRouteByRealTime(ruta.id, { silent: true });
    // Validar que el orden de las paradas sea consistente con las horas reales de entrega.
    // Si una parada con orden posterior tiene fecha_entrega_real anterior a la de una parada
    // con orden previo, se debe corregir el orden antes de cerrar la ruta.
    const { data: entregasOrd, error: errEntregas } = await supabase
      .from("entregas_programadas")
      .select("orden_ruta, fecha_entrega_real, documentos(folio_consecutivo, companies(nombre))")
      .eq("ruta_id", ruta.id)
      .order("orden_ruta");
    if (errEntregas) { toast.error(errEntregas.message); return; }
    const conHora = (entregasOrd || []).filter((e: any) => e.fecha_entrega_real);
    for (let i = 1; i < conHora.length; i++) {
      const prev = conHora[i - 1] as any;
      const cur = conHora[i] as any;
      if (new Date(cur.fecha_entrega_real).getTime() < new Date(prev.fecha_entrega_real).getTime()) {
        const nombrePrev = prev.documentos?.companies?.nombre || `parada ${prev.orden_ruta}`;
        const nombreCur = cur.documentos?.companies?.nombre || `parada ${cur.orden_ruta}`;
        toast.error(
          `No se puede cerrar la ruta: el orden de las paradas no coincide con las horas reales de entrega. ` +
          `La parada #${cur.orden_ruta} (${nombreCur}) fue entregada antes que la parada #${prev.orden_ruta} (${nombrePrev}). ` +
          `Reordena las paradas para que sigan el orden cronológico real de entrega y vuelve a intentarlo.`,
          { duration: 9000 },
        );
        return;
      }
    }
    if (!confirm("¿Confirmas la finalización de esta ruta? Se registrará la hora de cierre.")) return;
    const { error } = await (supabase.from("rutas_entrega") as any)
      .update({
        ruta_finished_at: new Date().toISOString(),
        ruta_finished_by: user?.id ?? null,
        estatus: "finalizada",
      })
      .eq("id", ruta.id);
    if (error) { toast.error(error.message); return; }
    // Al cerrar la ruta, recalcular tiempos reales (y km/tiempo estimado) tomando como
    // referencia la entrega previa o, para la primera parada, la hora de salida de planta.
    await recalcRouteDistances(ruta.id);
    toast.success("Ruta finalizada");
    refetchRutas();
  };

  const openAdjustRouteTime = (ruta: any, mode: "start" | "finish") => {
    const current = mode === "start" ? ruta.ruta_started_at : ruta.ruta_finished_at;
    const base = current ? new Date(current) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setAdjustDate(base);
    setAdjustTime(`${pad(base.getHours())}:${pad(base.getMinutes())}`);
    setAdjustRoute({ ruta, mode });
  };

  const saveAdjustedRouteTime = async () => {
    if (!adjustRoute || !adjustDate) return;
    setSavingAdjust(true);
    const [hh, mm] = (adjustTime || "00:00").split(":").map((n) => Number(n) || 0);
    const dt = new Date(adjustDate);
    dt.setHours(hh, mm, 0, 0);
    const iso = dt.toISOString();
    const nowIso = new Date().toISOString();
    const payload: any = adjustRoute.mode === "start"
      ? {
          ruta_started_at: iso,
          ruta_started_by: adjustRoute.ruta.ruta_started_by ?? user?.id ?? null,
          ruta_started_at_editada_por: user?.id ?? null,
          ruta_started_at_editada_at: nowIso,
          estatus: adjustRoute.ruta.estatus || "en_ruta",
        }
      : {
          ruta_finished_at: iso,
          ruta_finished_by: adjustRoute.ruta.ruta_finished_by ?? user?.id ?? null,
          ruta_finished_at_editada_por: user?.id ?? null,
          ruta_finished_at_editada_at: nowIso,
          estatus: "finalizada",
        };
    const { error } = await (supabase.from("rutas_entrega") as any)
      .update(payload)
      .eq("id", adjustRoute.ruta.id);
    setSavingAdjust(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Hora actualizada");
    setAdjustRoute(null);
    refetchRutas();
  };

  const resetRouteTime = async (ruta: any, mode: "start" | "finish") => {
    if (!confirm(`¿Reiniciar la hora de ${mode === "start" ? "inicio" : "fin"} de la ruta?`)) return;
    const nowIso = new Date().toISOString();
    const payload: any = mode === "start"
      ? {
          ruta_started_at: null,
          ruta_started_by: null,
          ruta_finished_at: null,
          ruta_finished_by: null,
          ruta_started_at_editada_por: user?.id ?? null,
          ruta_started_at_editada_at: nowIso,
          ruta_finished_at_editada_por: null,
          ruta_finished_at_editada_at: null,
          estatus: null,
        }
      : {
          ruta_finished_at: null,
          ruta_finished_by: null,
          ruta_finished_at_editada_por: user?.id ?? null,
          ruta_finished_at_editada_at: nowIso,
          estatus: "en_ruta",
        };
    const { error } = await (supabase.from("rutas_entrega") as any)
      .update(payload)
      .eq("id", ruta.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Hora reiniciada");
    refetchRutas();
  };

  const handleDeliver = (item: PoolItem) => {
    setDeliverItem(item);
    setDeliverNotes("");
    setEvidenceFile(null);
    setDeliverDialog(true);
  };

  const confirmDelivery = async () => {
    if (!deliverItem) return;
    setUploading(true);
    try {
      let evidenciaUrl: string | null = null;
      if (evidenceFile) {
        const ext = evidenceFile.name.split(".").pop();
        const path = `entregas/${deliverItem.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("document-files").upload(path, evidenceFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("document-files").getPublicUrl(path);
        evidenciaUrl = urlData.publicUrl;
      }
      const container = findContainer(deliverItem.id);
      if (container && container !== "pool") {
        await supabase.from("entregas_programadas").update({
          fecha_entrega_real: new Date().toISOString(),
          notas: deliverNotes || null,
          evidencia_url: evidenciaUrl,
        }).eq("documento_id", deliverItem.id).eq("ruta_id", container);
      }
      const isCorp = deliverItem.raw?.tipo_documento === "entrega_corporativa";
      await supabase.from("documentos").update(
        isCorp
          ? { fecha_entrega_real: new Date().toISOString().slice(0, 10) }
          : { estatus_pedido: "entregado" }
      ).eq("id", deliverItem.id);
      toast.success("Entrega registrada");
      setDeliverDialog(false);
      refetchEntregas();
      refetchPool();
      refetchCorporativas();
      // Recalcular km y tiempos de la ruta con la información real tras marcar entregado
      if (container && container !== "pool") {
        await recalcRouteDistances(container);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Toggle repartidor in multi-select
  const toggleRepartidor = (repId: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(repId) ? list.filter(r => r !== repId) : [...list, repId]);
  };

  // Pool droppable
  const { setNodeRef: setPoolRef, isOver: isPoolOver } = useDroppable({ id: "pool" });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button onClick={() => setNewRouteOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva Ruta
            </Button>
            <Button variant="outline" onClick={() => navigate("/documents")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Documentos
            </Button>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold text-foreground">Planeación de Entregas</h1>
            <p className="text-muted-foreground text-xs">Arrastra pedidos del pool a las rutas para programarlos</p>
          </div>
        </div>
        {/* Plaza filter chips + pool toggle + view toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={showPool ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setShowPool(!showPool)}
          >
            {showPool ? <PanelLeftClose className="h-3.5 w-3.5 mr-1" /> : <PanelLeftOpen className="h-3.5 w-3.5 mr-1" />}
            Pool de Pedidos
          </Button>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Button
            size="sm"
            variant={selectedPlaza === "all" ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setSelectedPlaza("all")}
          >
            Todas las plazas
          </Button>
          {plazas.map((p: any) => (
            <Button
              key={p.id}
              size="sm"
              variant={selectedPlaza === p.id ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSelectedPlaza(p.id)}
            >
              {p.nombre}
            </Button>
          ))}
          <Separator orientation="vertical" className="h-5 mx-1 hidden sm:block" />
          <div className="flex gap-1 border rounded-md p-0.5">
            <Button
              size="sm"
              variant={mainView === "kanban" ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setMainView("kanban")}
              title="Vista de lista (Kanban)"
            >
              <ListIcon className="h-3.5 w-3.5 mr-1" /> Lista
            </Button>
            <Button
              size="sm"
              variant={mainView === "map" ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setMainView("map")}
              title="Vista de mapa"
            >
              <MapIcon className="h-3.5 w-3.5 mr-1" /> Mapa
            </Button>
          </div>
          {mainView === "kanban" && (
            <div className="flex gap-1 border rounded-md p-0.5">
              <Button
                size="sm"
                variant={routeViewMode === "list" ? "default" : "ghost"}
                className="h-7 text-xs px-3"
                onClick={() => { setRouteViewMode("list"); setCalendarDate(undefined); }}
              >
                <Truck className="h-3.5 w-3.5 mr-1" /> Rutas
              </Button>
              <Button
                size="sm"
                variant={routeViewMode === "calendar" ? "default" : "ghost"}
                className="h-7 text-xs px-3"
                onClick={() => setRouteViewMode("calendar")}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Calendario
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => navigate("/reports/daily-delivery")}
            title="Reporte Diario de Entregas"
          >
            <FileText className="h-3.5 w-3.5 mr-1" /> Reportes
          </Button>
        </div>
      </div>

      {/* Main DnD area */}
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Pool */}
          {showPool && (
          <div ref={setPoolRef}
            className={cn("w-[360px] shrink-0 border-r flex flex-col bg-muted/30",
              isPoolOver && "bg-accent/30")}>
            <div className="p-3 border-b space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Pool de Pedidos
                  <Badge variant="secondary" className="ml-1">{filteredPool.length}</Badge>
                </h2>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-8 h-8 text-sm"
                  value={searchPool} onChange={e => setSearchPool(e.target.value)} />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estatus</SelectItem>
                  <SelectItem value="confirmado_cliente">🔴 Confirmado</SelectItem>
                  <SelectItem value="espera_autorizacion_precio">🟡 Espera Autorización</SelectItem>
                  <SelectItem value="precio_autorizado">🟢 Precio Autorizado</SelectItem>
                  <SelectItem value="validado_contabilidad">🔵 Validado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="flex-1">
              <SortableContext items={filteredPool.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="p-2 space-y-2">
                  {pedidosSinDireccion.length > 0 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-2 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Requieren dirección de envío
                        <Badge variant="secondary" className="ml-auto text-[10px]">{pedidosSinDireccion.length}</Badge>
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
                        Este pedido no puede programarse sin una dirección de envío asignada.
                      </p>
                      <div className="space-y-1">
                        {pedidosSinDireccion.slice(0, 5).map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => window.open(`/documents/${p.id}/edit`, "_blank")}
                            className="w-full text-left text-[11px] px-2 py-1 rounded bg-white dark:bg-background hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 truncate"
                            title={`${p.companies?.name || "Sin cliente"} — ${p.numero_pedido || ""}`}
                          >
                            <span className="font-medium">{p.companies?.name || "Sin cliente"}</span>
                            {p.numero_pedido && <span className="text-muted-foreground"> · #{p.numero_pedido}</span>}
                          </button>
                        ))}
                        {pedidosSinDireccion.length > 5 && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 text-center">
                            +{pedidosSinDireccion.length - 5} más…
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {filteredPool.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">Sin pedidos disponibles</p>
                    </div>
                  ) : (
                    filteredPool.map(item => (
                      <DraggablePoolCard
                        key={item.id}
                        item={item}
                        onView={(it) => window.open(`/documents/${it.id}/edit`, "_blank")}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </ScrollArea>
          </div>
          )}

          {/* RIGHT: Routes kanban / Calendar / Map */}
          {mainView === "map" ? (
            <div className="flex-1 relative">
              <DeliveryMapView
                entregas={allEntregas as any}
                rutas={allRutas as any}
                vehiculos={vehiculos as any}
                plazas={plazas as any}
                selectedPlaza={selectedPlaza}
                repartidores={repartidoresAll as any}
                rutaRepartidores={allRutaRepartidores as any}
              />
            </div>
          ) : (
          <ScrollArea className="flex-1">
            <div className="p-4 min-w-max">
              {/* Calendar selector */}
              {routeViewMode === "calendar" && (
                <div className="mb-4 flex gap-4 items-start">
                  <Card className="shrink-0">
                    <CardContent className="p-2">
                      <Calendar
                        mode="single"
                        selected={calendarDate}
                        onSelect={(d) => setCalendarDate(d)}
                        className="p-2 pointer-events-auto"
                        locale={es}
                        modifiers={{
                          hasDelivery: (date) => rutaDates.has(format(date, "yyyy-MM-dd")),
                        }}
                        modifiersClassNames={{
                          hasDelivery: "bg-primary/20 font-bold text-primary",
                        }}
                      />
                    </CardContent>
                  </Card>
                  <div className="text-sm text-muted-foreground">
                    {calendarDate ? (
                      <p>Mostrando rutas del <span className="font-semibold text-foreground">{format(calendarDate, "EEEE dd MMM yyyy", { locale: es })}</span></p>
                    ) : (
                      <p>Selecciona una fecha para ver las entregas programadas. Los días con entregas están <span className="font-semibold text-primary">resaltados</span>.</p>
                    )}
                  </div>
                </div>
              )}
              {Object.keys(rutasByPlazaDay).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Truck className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-lg font-medium">Sin rutas creadas</p>
                  <p className="text-sm">Crea una ruta para comenzar a planificar</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(rutasByPlazaDay).map(([plazaId, { plaza, days }]) => (
                    <div key={plazaId}>
                      <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                        📍 {plaza.nombre || "Sin plaza"}
                      </h3>
                      <div className="space-y-4">
                        {Object.entries(days)
                          .sort(([a], [b]) => {
                            if (a === "sin-fecha") return 1;
                            if (b === "sin-fecha") return -1;
                            const today = format(new Date(), "yyyy-MM-dd");
                            if (a === today && b !== today) return -1;
                            if (b === today && a !== today) return 1;
                            return b.localeCompare(a);
                          })
                          .map(([day, rutas]) => (
                          <div key={day}>
                            <p className="text-xs font-semibold text-muted-foreground mb-2 ml-1">
                              📅 {day !== "sin-fecha" ? format(new Date(day + "T12:00:00"), "EEEE dd MMM yyyy", { locale: es }) : "Sin fecha"}
                            </p>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                              {[...rutas].sort((a, b) => Number(!!a.cerrada) - Number(!!b.cerrada)).map(ruta => (
                                <RouteDropColumn
                                  key={ruta.id}
                                  ruta={ruta}
                                  items={routeItems[ruta.id] || []}
                                  vehiculos={vehiculos}
                                  repartidoresAll={repartidoresAll}
                                  repartidoresRuta={allRutaRepartidores.filter((rr: any) => rr.ruta_id === ruta.id)}
                                  onEditRoute={handleOpenEditRoute}
                                  onDeleteRoute={deleteRoute}
                                  onDeliver={handleDeliver}
                                  onReorder={() => {}}
                                  onToggleCerrada={toggleRutaCerrada}
                                  onStartRoute={handleStartRoute}
                                  onFinishRoute={handleFinishRoute}
                                  onSortByRealTime={(r) => sortRouteByRealTime(r.id)}
                                  onSaveTiempoReal={(docId, min) => saveTiempoReal(ruta.id, docId, min)}
                                  onSaveKmManual={(docId, km) => saveKmManual(ruta.id, docId, km)}
                                  onSaveDocCoords={(docId, lat, lng, address) => saveDocCoords(ruta.id, docId, lat, lng, address)}
                                  onAdjustRouteTime={openAdjustRouteTime}
                                  onResetRouteTime={resetRouteTime}
                                  isAdmin={isAdmin}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          )}
        </div>

        <DragOverlay>
          {activeItem && <OverlayCard item={activeItem} />}
        </DragOverlay>
      </DndContext>

      {/* New Route Dialog */}
      <Dialog open={newRouteOpen} onOpenChange={setNewRouteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Ruta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plaza</Label>
              <Select value={newPlaza} onValueChange={setNewPlaza}>
                <SelectTrigger><SelectValue placeholder="Seleccionar plaza" /></SelectTrigger>
                <SelectContent>
                  {plazas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !newFecha && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newFecha ? format(newFecha, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newFecha} onSelect={setNewFecha} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Vehículo</Label>
              <Select value={newVehiculo} onValueChange={setNewVehiculo}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
                <SelectContent>
                  {vehiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nombre} {v.placas ? `(${v.placas})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Repartidores</Label>
              <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                {repartidoresAll.map((r: any) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded p-1">
                    <Checkbox checked={newRepartidores.includes(r.id)}
                      onCheckedChange={() => toggleRepartidor(r.id, newRepartidores, setNewRepartidores)} />
                    {r.nombre}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRouteOpen(false)}>Cancelar</Button>
            <Button onClick={() => createRoute.mutate()}
              disabled={!newPlaza || !newVehiculo || !newFecha || newRepartidores.length === 0 || createRoute.isPending}>
              {createRoute.isPending ? "Creando..." : "Crear Ruta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Route Dialog */}
      <Dialog open={!!editRouteData} onOpenChange={(open) => { if (!open) setEditRouteData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Ruta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fecha de entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !editFecha && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editFecha ? format(editFecha, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editFecha} onSelect={setEditFecha} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Vehículo</Label>
              <Select value={editVehiculo} onValueChange={setEditVehiculo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vehiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nombre} {v.placas ? `(${v.placas})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Repartidores</Label>
              <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
                {repartidoresAll.map((r: any) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/50 rounded p-1">
                    <Checkbox checked={editRepartidores.includes(r.id)}
                      onCheckedChange={() => toggleRepartidor(r.id, editRepartidores, setEditRepartidores)} />
                    {r.nombre}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRouteData(null)}>Cancelar</Button>
            <Button onClick={saveEditRoute}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver Dialog */}
      <Dialog open={deliverDialog} onOpenChange={setDeliverDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmar Entrega</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{deliverItem?.title}</p>
              <p className="text-xs text-muted-foreground">{deliverItem?.subtitle}</p>
            </div>
            <div>
              <Label>Notas de entrega</Label>
              <Textarea value={deliverNotes} onChange={(e) => setDeliverNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <div>
              <Label>Evidencia (PDF o Foto)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} />
              {evidenceFile && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><ImageIcon className="h-3 w-3" /> {evidenceFile.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverDialog(false)}>Cancelar</Button>
            <Button onClick={confirmDelivery} disabled={uploading}>{uploading ? "Subiendo..." : "Confirmar Entrega"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajuste manual de hora inicio/fin de ruta */}
      <Dialog open={!!adjustRoute} onOpenChange={(o) => { if (!o) setAdjustRoute(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ajustar hora de {adjustRoute?.mode === "start" ? "inicio" : "finalización"} de ruta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">
              Fecha y hora
            </Label>
            <Popover open={adjustPickerOpen} onOpenChange={setAdjustPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-light h-10",
                    !adjustDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                  {adjustDate
                    ? `${format(adjustDate, "dd MMM yyyy", { locale: es })}${adjustTime ? ` · ${adjustTime}` : ""}`
                    : "Selecciona fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={adjustDate}
                  onDayClick={(day) => setAdjustDate(day)}
                  defaultMonth={adjustDate || new Date()}
                  initialFocus
                  locale={es}
                  className={cn("p-3 pointer-events-auto font-light")}
                />
                <div className="border-t p-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={adjustTime}
                    onChange={(e) => setAdjustTime(e.target.value)}
                    className="h-9 font-light"
                  />
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Solo administradores. Se registrará tu nombre como editor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustRoute(null)}>Cancelar</Button>
            <Button onClick={saveAdjustedRouteTime} disabled={savingAdjust || !adjustDate}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
