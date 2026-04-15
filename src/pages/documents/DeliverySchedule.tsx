import { useState, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import { CalendarIcon, ArrowLeft, GripVertical, Truck, Plus, Check, Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Sortable Item ───────────────────────────────────────────
function SortableDeliveryItem({ id, doc, index, onDeliver, onRemove }: {
  id: string; doc: any; index: number; onDeliver: (doc: any) => void; onRemove: (docId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <Card className="flex-1">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-mono">{index + 1}</Badge>
            <div>
              <p className="font-medium text-sm">{doc.numero_pedido || doc.numero_cotizacion || "Sin número"}</p>
              <p className="text-xs text-muted-foreground">{doc.companies?.name || doc._company_name || "Sin cliente"}</p>
              {doc.direccion_envio && <p className="text-xs text-muted-foreground truncate max-w-[250px]">📍 {doc.direccion_envio}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            {doc.estatus_pedido === "programado_entrega" && (
              <Button size="sm" variant="outline" onClick={() => onDeliver(doc)}>
                <Check className="h-3 w-3 mr-1" /> Entregar
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => onRemove(doc.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Route Card Component ────────────────────────────────────
function RouteCard({ ruta, vehiculos, repartidores, availablePedidos, dateStr, onRefresh }: {
  ruta: any; vehiculos: any[]; repartidores: any[]; availablePedidos: any[]; dateStr: string; onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [orderedDocs, setOrderedDocs] = useState<any[]>([]);
  const [editingRoute, setEditingRoute] = useState(false);
  const [vehiculoId, setVehiculoId] = useState(ruta.vehiculo_id);
  const [repartidorId, setRepartidorId] = useState(ruta.repartidor_id);
  const [addingPedido, setAddingPedido] = useState(false);

  // Deliver dialog
  const [deliverDialog, setDeliverDialog] = useState(false);
  const [deliverDoc, setDeliverDoc] = useState<any>(null);
  const [deliverNotes, setDeliverNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch entregas for this route
  const { data: entregas = [], refetch: refetchEntregas } = useQuery({
    queryKey: ["entregas-ruta", ruta.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas_programadas")
        .select("*, documentos(*, companies(name))")
        .eq("ruta_id", ruta.id)
        .order("orden_ruta");
      return data || [];
    },
  });

  useEffect(() => {
    setOrderedDocs(entregas.map((e: any) => ({
      ...e.documentos,
      _entrega_id: e.id,
      _orden_ruta: e.orden_ruta,
      _is_scheduled: true,
    })));
  }, [entregas]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedDocs((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Save order
  const saveOrder = useMutation({
    mutationFn: async () => {
      for (let i = 0; i < orderedDocs.length; i++) {
        const doc = orderedDocs[i];
        if (doc._entrega_id) {
          await supabase.from("entregas_programadas").update({ orden_ruta: i }).eq("id", doc._entrega_id);
        }
      }
    },
    onSuccess: () => { toast.success("Orden actualizado"); refetchEntregas(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Update route vehicle/driver
  const updateRoute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rutas_entrega").update({
        vehiculo_id: vehiculoId,
        repartidor_id: repartidorId,
      }).eq("id", ruta.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ruta actualizada"); setEditingRoute(false); onRefresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  // Add pedido to route
  const addPedido = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("entregas_programadas").insert({
        documento_id: docId,
        ruta_id: ruta.id,
        vehiculo_id: ruta.vehiculo_id,
        repartidor_id: ruta.repartidor_id,
        fecha_entrega: dateStr,
        orden_ruta: orderedDocs.length,
      });
      if (error) throw error;
      await supabase.from("documentos").update({ estatus_pedido: "programado_entrega" }).eq("id", docId);
    },
    onSuccess: () => {
      toast.success("Pedido agregado a la ruta");
      refetchEntregas();
      queryClient.invalidateQueries({ queryKey: ["pedidos-for-schedule"] });
      setAddingPedido(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Remove pedido from route
  const removePedido = async (docId: string) => {
    await supabase.from("entregas_programadas").delete().eq("documento_id", docId).eq("ruta_id", ruta.id);
    await supabase.from("documentos").update({ estatus_pedido: "validado_contabilidad" }).eq("id", docId);
    toast.success("Pedido removido de la ruta");
    refetchEntregas();
    queryClient.invalidateQueries({ queryKey: ["pedidos-for-schedule"] });
  };

  // Delete route
  const deleteRoute = useMutation({
    mutationFn: async () => {
      // Reset all docs to validado_contabilidad
      for (const doc of orderedDocs) {
        if (doc.estatus_pedido === "programado_entrega") {
          await supabase.from("documentos").update({ estatus_pedido: "validado_contabilidad" }).eq("id", doc.id);
        }
      }
      const { error } = await supabase.from("rutas_entrega").delete().eq("id", ruta.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ruta eliminada"); onRefresh(); queryClient.invalidateQueries({ queryKey: ["pedidos-for-schedule"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleOpenDeliver = (doc: any) => {
    setDeliverDoc(doc);
    setDeliverNotes("");
    setEvidenceFile(null);
    setDeliverDialog(true);
  };

  const handleConfirmDelivery = async () => {
    if (!deliverDoc) return;
    setUploading(true);
    try {
      let evidenciaUrl: string | null = null;
      if (evidenceFile) {
        const ext = evidenceFile.name.split(".").pop();
        const path = `entregas/${deliverDoc.id}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("document-files").upload(path, evidenceFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("document-files").getPublicUrl(path);
        evidenciaUrl = urlData.publicUrl;
      }
      await supabase.from("entregas_programadas").update({
        fecha_entrega_real: new Date().toISOString(),
        notas: deliverNotes || null,
        evidencia_url: evidenciaUrl,
      }).eq("documento_id", deliverDoc.id).eq("ruta_id", ruta.id);
      await supabase.from("documentos").update({ estatus_pedido: "entregado" }).eq("id", deliverDoc.id);
      toast.success("Entrega registrada");
      setDeliverDialog(false);
      refetchEntregas();
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    } finally {
      setUploading(false);
    }
  };

  const vehiculo = vehiculos.find((v: any) => v.id === ruta.vehiculo_id);
  const repartidor = repartidores.find((r: any) => r.id === ruta.repartidor_id);

  // Available pedidos not already in ANY route for this date
  const scheduledDocIds = new Set(orderedDocs.map(d => d.id));
  const unassignedPedidos = availablePedidos.filter((p: any) => !scheduledDocIds.has(p.id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {vehiculo?.nombre || "Sin vehículo"} {vehiculo?.placas ? `(${vehiculo.placas})` : ""}
              <span className="text-muted-foreground">·</span>
              {repartidor?.nombre || "Sin repartidor"}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{orderedDocs.length} entregas programadas</p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setAddingPedido(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setVehiculoId(ruta.vehiculo_id); setRepartidorId(ruta.repartidor_id); setEditingRoute(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveOrder.mutate()} disabled={saveOrder.isPending}>
              {saveOrder.isPending ? "..." : "Guardar Orden"}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("¿Eliminar esta ruta?")) deleteRoute.mutate(); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {orderedDocs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Truck className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Sin entregas. Agrega pedidos a esta ruta.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedDocs.map(d => d.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderedDocs.map((doc, index) => (
                  <SortableDeliveryItem key={doc.id} id={doc.id} doc={doc} index={index} onDeliver={handleOpenDeliver} onRemove={removePedido} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      {/* Edit route dialog */}
      <Dialog open={editingRoute} onOpenChange={setEditingRoute}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Ruta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vehículo</Label>
              <Select value={vehiculoId} onValueChange={setVehiculoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{vehiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nombre} {v.placas ? `(${v.placas})` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Repartidor</Label>
              <Select value={repartidorId} onValueChange={setRepartidorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{repartidores.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoute(false)}>Cancelar</Button>
            <Button onClick={() => updateRoute.mutate()} disabled={updateRoute.isPending}>
              {updateRoute.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add pedido dialog */}
      <Dialog open={addingPedido} onOpenChange={setAddingPedido}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Agregar Pedido a Ruta</DialogTitle></DialogHeader>
          {unassignedPedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay pedidos disponibles para esta fecha.</p>
          ) : (
            <div className="space-y-2">
              {unassignedPedidos.map((p: any) => (
                <Card key={p.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => addPedido.mutate(p.id)}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.numero_pedido || "Sin número"}</p>
                      <p className="text-xs text-muted-foreground">{p.companies?.name}</p>
                      {p.direccion_envio && <p className="text-xs text-muted-foreground truncate max-w-[300px]">📍 {p.direccion_envio}</p>}
                    </div>
                    <span className="text-sm font-semibold">${Number(p.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deliver dialog */}
      <Dialog open={deliverDialog} onOpenChange={setDeliverDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmar Entrega</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{deliverDoc?.numero_pedido || deliverDoc?.numero_cotizacion}</p>
              <p className="text-xs text-muted-foreground">{deliverDoc?.companies?.name || deliverDoc?._company_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Notas de entrega</Label>
              <Textarea value={deliverNotes} onChange={(e) => setDeliverNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <div className="space-y-2">
              <Label>Evidencia (PDF o Foto)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} />
              {evidenceFile && <p className="text-xs text-muted-foreground flex items-center gap-1"><ImageIcon className="h-3 w-3" /> {evidenceFile.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmDelivery} disabled={uploading}>{uploading ? "Subiendo..." : "Confirmar Entrega"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function DeliverySchedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedPlaza, setSelectedPlaza] = useState("");

  // New route dialog
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  const [newVehiculo, setNewVehiculo] = useState("");
  const [newRepartidor, setNewRepartidor] = useState("");

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

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

  const { data: repartidores = [] } = useQuery({
    queryKey: ["repartidores"],
    queryFn: async () => {
      const { data } = await supabase.from("repartidores").select("*").eq("is_active", true).order("nombre");
      return data || [];
    },
  });

  // Fetch routes for selected date + plaza
  const { data: rutas = [], refetch: refetchRutas } = useQuery({
    queryKey: ["rutas-entrega", dateStr, selectedPlaza],
    queryFn: async () => {
      if (!dateStr || !selectedPlaza) return [];
      const { data } = await supabase
        .from("rutas_entrega")
        .select("*")
        .eq("fecha_entrega", dateStr)
        .eq("plaza_id", selectedPlaza)
        .order("created_at");
      return data || [];
    },
    enabled: !!dateStr && !!selectedPlaza,
  });

  // Fetch available pedidos (validated, matching date, matching plaza)
  const { data: availablePedidos = [] } = useQuery({
    queryKey: ["pedidos-for-schedule", dateStr, selectedPlaza],
    queryFn: async () => {
      if (!dateStr || !selectedPlaza) return [];
      const { data } = await supabase
        .from("documentos")
        .select("*, companies(name)")
        .eq("tipo_documento", "pedido")
        .eq("is_active", true)
        .eq("estatus_pedido", "validado_contabilidad")
        .eq("fecha_entrega_programada", dateStr)
        .eq("plaza_id", selectedPlaza)
        .order("created_at");
      return data || [];
    },
    enabled: !!dateStr && !!selectedPlaza,
  });

  // Create new route
  const createRoute = useMutation({
    mutationFn: async () => {
      if (!newVehiculo || !newRepartidor) throw new Error("Selecciona vehículo y repartidor");
      const { error } = await supabase.from("rutas_entrega").insert({
        plaza_id: selectedPlaza,
        vehiculo_id: newVehiculo,
        repartidor_id: newRepartidor,
        fecha_entrega: dateStr,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ruta creada");
      setNewRouteOpen(false);
      setNewVehiculo("");
      setNewRepartidor("");
      refetchRutas();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleRefresh = () => {
    refetchRutas();
    queryClient.invalidateQueries({ queryKey: ["pedidos-for-schedule"] });
  };

  const plazaName = plazas.find((p: any) => p.id === selectedPlaza)?.nombre;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Programación de Entregas</h1>
          <p className="text-muted-foreground text-sm">Define rutas de entrega por día y plaza</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/documents")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Documentos
        </Button>
      </div>

      {/* Filters: Date + Plaza */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">1. Fecha de Entrega</CardTitle></CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">2. Plaza</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedPlaza} onValueChange={setSelectedPlaza}>
              <SelectTrigger><SelectValue placeholder="Seleccionar plaza" /></SelectTrigger>
              <SelectContent>
                {plazas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            {plazas.length === 0 && <p className="text-xs text-muted-foreground mt-1">No hay plazas registradas. Agrégalas en Catálogos.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Routes */}
      {dateStr && selectedPlaza && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Rutas — {plazaName} — {selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}
            </h2>
            <Button onClick={() => setNewRouteOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva Ruta
            </Button>
          </div>

          {rutas.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Truck className="mx-auto h-10 w-10 mb-2 opacity-40" />
                <p>No hay rutas para esta fecha y plaza.</p>
                <p className="text-sm">Crea una nueva ruta para comenzar.</p>
              </CardContent>
            </Card>
          ) : (
            rutas.map((ruta: any) => (
              <RouteCard
                key={ruta.id}
                ruta={ruta}
                vehiculos={vehiculos}
                repartidores={repartidores}
                availablePedidos={availablePedidos}
                dateStr={dateStr}
                onRefresh={handleRefresh}
              />
            ))
          )}
        </div>
      )}

      {/* New route dialog */}
      <Dialog open={newRouteOpen} onOpenChange={setNewRouteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nueva Ruta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plaza</Label>
              <Input disabled value={plazaName || ""} />
            </div>
            <div>
              <Label>Vehículo</Label>
              <Select value={newVehiculo} onValueChange={setNewVehiculo}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
                <SelectContent>{vehiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nombre} {v.placas ? `(${v.placas})` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Repartidor</Label>
              <Select value={newRepartidor} onValueChange={setNewRepartidor}>
                <SelectTrigger><SelectValue placeholder="Seleccionar repartidor" /></SelectTrigger>
                <SelectContent>{repartidores.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRouteOpen(false)}>Cancelar</Button>
            <Button onClick={() => createRoute.mutate()} disabled={!newVehiculo || !newRepartidor || createRoute.isPending}>
              {createRoute.isPending ? "Creando..." : "Crear Ruta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
