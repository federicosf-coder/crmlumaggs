import { useState, useEffect, useMemo } from "react";
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
  ClipboardCheck, MapPin, Lock, Unlock, Map as MapIcon, List as ListIcon,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
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
};

// ─── Types ────────────────────────────────────────────────────
type PoolItem = {
  id: string;
  type: "pedido" | "tarea";
  title: string;
  subtitle: string;
  address?: string;
  total?: number;
  estatus: string;
  plaza_id?: string;
  fecha_documento?: string;
  raw: any;
};

// ─── Draggable Card ──────────────────────────────────────────
function DraggablePoolCard({ item }: { item: PoolItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const cfg = STATUS_CONFIG[item.estatus] || STATUS_CONFIG.confirmado_cliente;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={cn("border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-colors", cfg.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            {item.type === "tarea" ? <ListChecks className="h-3.5 w-3.5 shrink-0" /> : <Package className="h-3.5 w-3.5 shrink-0" />}
            <span className="font-medium text-sm truncate">{item.title}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
          {item.fecha_documento && (
            <p className="text-xs text-muted-foreground mt-0.5">📅 {format(new Date(item.fecha_documento + "T12:00:00"), "dd MMM yyyy", { locale: es })}</p>
          )}
          {item.address && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 min-w-0">
              <span className="truncate">📍 {item.address}</span>
              <AddressDisplay address={item.address} iconOnly />
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {item.total != null && (
            <span className="text-sm font-semibold">${Number(item.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
          )}
          <Badge variant="outline" className={cn("text-[10px] mt-1 block", cfg.color)}>{cfg.label}</Badge>
        </div>
      </div>
    </div>
  );
}

// ─── Overlay Card (while dragging) ───────────────────────────
function OverlayCard({ item }: { item: PoolItem }) {
  const cfg = STATUS_CONFIG[item.estatus] || STATUS_CONFIG.confirmado_cliente;
  return (
    <div className={cn("border rounded-lg p-3 shadow-xl", cfg.bg)} style={{ width: 320 }}>
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
        {item.total != null && (
          <span className="text-sm font-semibold">${Number(item.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
        )}
      </div>
    </div>
  );
}

// ─── Route Drop Column ───────────────────────────────────────
function RouteDropColumn({ ruta, items, vehiculos, repartidoresAll, repartidoresRuta, onEditRoute, onDeleteRoute, onDeliver, onReorder, onToggleCerrada }: {
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
}) {
  const navigate = useNavigate();
  const cerrada = !!ruta.cerrada;
  const { setNodeRef, isOver } = useDroppable({ id: `ruta-${ruta.id}`, disabled: cerrada });
  const vehiculo = vehiculos.find((v: any) => v.id === ruta.vehiculo_id);
  const repartidorNames = repartidoresRuta.map(rr => {
    const rep = repartidoresAll.find((r: any) => r.id === rr.repartidor_id);
    return rep?.nombre || "?";
  });

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
                <DraggablePoolCard item={item} />
              </div>
              {item.type === "pedido" && (
                <div className="absolute top-1 right-8 z-10 flex gap-0.5">
                  {item.address && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6 shadow"
                      title="Abrir mapa"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address!)}`, "_blank");
                      }}
                    >
                      <MapPin className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="default"
                    className="h-6 w-6 shadow"
                    title="Abrir entrega"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); navigate(`/delivery/entrega/${item.id}`); }}
                  >
                    <ClipboardCheck className="h-3 w-3" />
                  </Button>
                </div>
              )}
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
        <span>${items.reduce((s, i) => s + (i.total || 0), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function DeliverySchedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showPool, setShowPool] = useState(false);
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
      const { data } = await supabase
        .from("documentos")
        .select("*, companies(name), documento_productos(cantidad, producto_id, productos(presentacion_id, presentaciones(nombre)))")
        .eq("tipo_documento", "pedido")
        .eq("is_active", true)
        .in("estatus_pedido", [...POOL_STATUSES])
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Pool: tasks with programable_entrega
  const { data: poolTasks = [], refetch: refetchPoolTasks } = useQuery({
    queryKey: ["pool-tasks-entrega"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_tasks")
        .select("*, companies(name), contacts(first_name, last_name)")
        .eq("programable_entrega", true)
        .eq("completed", false)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // All routes (no filter by date/plaza - show all active)
  const { data: allRutas = [], refetch: refetchRutas } = useQuery({
    queryKey: ["all-rutas-entrega"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rutas_entrega")
        .select("*, plazas(nombre)")
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
      .filter((p: any) => !scheduledDocIds.has(p.id))
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
          estatus: p.estatus_pedido || "confirmado_cliente",
          plaza_id: p.plaza_id || undefined,
          fecha_documento: p.fecha_documento || undefined,
          raw: p,
        };
      });

    const taskItems: PoolItem[] = poolTasks.map((t: any) => ({
      id: `task-${t.id}`,
      type: "tarea" as const,
      title: t.title,
      subtitle: t.companies?.name || (t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : "Sin asignar"),
      total: undefined,
      estatus: "confirmado_cliente",
      plaza_id: undefined,
      raw: t,
    }));

    return [...pedidoItems, ...taskItems];
  }, [poolPedidos, poolTasks, allEntregas]);

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
          estatus: doc?.estatus_pedido || "programado_entrega",
          plaza_id: doc?.plaza_id || undefined,
          fecha_documento: doc?.fecha_documento || undefined,
          raw: doc,
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
        const { error } = await supabase.from("entregas_programadas").insert({
          documento_id: item.id,
          ruta_id: ruta.id,
          vehiculo_id: ruta.vehiculo_id,
          repartidor_id: ruta.repartidor_id,
          fecha_entrega: ruta.fecha_entrega,
          orden_ruta: (routeItems[ruta.id]?.length || 0),
        });
        if (error) { toast.error(error.message); return; }
        await supabase.from("documentos").update({
          estatus_pedido: "programado_entrega",
          plaza_id: ruta.plaza_id,
          fecha_entrega_programada: ruta.fecha_entrega,
        }).eq("id", item.id);
        toast.success("Pedido programado en ruta");
      }
      // TODO: handle task drop

      refetchPool();
      refetchEntregas();
      return;
    }

    // Route → Pool (return to pool)
    if (activeContainer !== "pool" && overContainer === "pool") {
      const item = (routeItems[activeContainer] || []).find(i => i.id === active.id);
      if (!item || item.type !== "pedido") return;

      await supabase.from("entregas_programadas").delete()
        .eq("documento_id", item.id).eq("ruta_id", activeContainer);
      // Reset status to the previous pool status - use validado_contabilidad as default
      await supabase.from("documentos").update({
        estatus_pedido: "validado_contabilidad",
        fecha_entrega_programada: null,
      }).eq("id", item.id);
      toast.success("Pedido devuelto al pool");
      refetchPool();
      refetchEntregas();
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
        await supabase.from("documentos").update({
          estatus_pedido: "validado_contabilidad",
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
    refetchRutaRepartidores();
  };

  const removeItemFromRoute = async (itemId: string) => {
    const container = findContainer(itemId);
    if (!container || container === "pool") return;
    await supabase.from("entregas_programadas").delete()
      .eq("documento_id", itemId).eq("ruta_id", container);
    await supabase.from("documentos").update({
      estatus_pedido: "validado_contabilidad",
      fecha_entrega_programada: null,
    }).eq("id", itemId);
    toast.success("Pedido devuelto al pool");
    refetchPool();
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
      await supabase.from("documentos").update({ estatus_pedido: "entregado" }).eq("id", deliverItem.id);
      toast.success("Entrega registrada");
      setDeliverDialog(false);
      refetchEntregas();
      refetchPool();
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Planeación de Entregas</h1>
            <p className="text-muted-foreground text-xs">Arrastra pedidos del pool a las rutas para programarlos</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setNewRouteOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva Ruta
            </Button>
            <Button variant="outline" onClick={() => navigate("/documents")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Documentos
            </Button>
          </div>
        </div>
        {/* Plaza filter chips + pool toggle + view toggle */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap items-center">
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
          </div>
          <div className="flex items-center gap-2">
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
          </div>
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
                  {filteredPool.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">Sin pedidos disponibles</p>
                    </div>
                  ) : (
                    filteredPool.map(item => <DraggablePoolCard key={item.id} item={item} />)
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
    </div>
  );
}
