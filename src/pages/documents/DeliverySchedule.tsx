import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarIcon, ArrowLeft, GripVertical, Truck, Upload, Check, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  id: string;
  doc: any;
  index: number;
  onDeliver: (doc: any) => void;
}

function SortableDeliveryItem({ id, doc, index, onDeliver }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
              <p className="text-xs text-muted-foreground">{doc.companies?.name || "Sin cliente"}</p>
              {doc.direccion_envio && (
                <p className="text-xs text-muted-foreground truncate max-w-[250px]">📍 {doc.direccion_envio}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">${Number(doc.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
            {doc.estatus_pedido === "programado_entrega" && (
              <Button size="sm" variant="outline" onClick={() => onDeliver(doc)}>
                <Check className="h-3 w-3 mr-1" /> Entregar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeliverySchedule() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedVehiculo, setSelectedVehiculo] = useState("");
  const [selectedRepartidor, setSelectedRepartidor] = useState("");
  const [orderedDocs, setOrderedDocs] = useState<any[]>([]);

  // Deliver dialog
  const [deliverDialog, setDeliverDialog] = useState(false);
  const [deliverDoc, setDeliverDoc] = useState<any>(null);
  const [deliverNotes, setDeliverNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

  // Fetch pedidos that are validated AND have fecha_entrega_programada matching selected date
  const { data: availablePedidos = [], isLoading: loadingPedidos } = useQuery({
    queryKey: ["pedidos-for-schedule", dateStr],
    queryFn: async () => {
      if (!dateStr) return [];
      const { data: validated } = await supabase
        .from("documentos")
        .select("*, companies(name)")
        .eq("tipo_documento", "pedido")
        .eq("is_active", true)
        .eq("estatus_pedido", "validado_contabilidad")
        .eq("fecha_entrega_programada", dateStr)
        .order("created_at");
      return validated || [];
    },
    enabled: !!dateStr,
  });

  // Get already scheduled for this date+vehicle+driver
  const { data: scheduledEntregas = [] } = useQuery({
    queryKey: ["entregas-programadas", dateStr, selectedVehiculo, selectedRepartidor],
    queryFn: async () => {
      if (!selectedVehiculo || !selectedRepartidor) return [];
      const { data } = await supabase
        .from("entregas_programadas")
        .select("*, documentos(*, companies(name))")
        .eq("fecha_entrega", dateStr)
        .eq("vehiculo_id", selectedVehiculo)
        .eq("repartidor_id", selectedRepartidor)
        .order("orden_ruta");
      return data || [];
    },
    enabled: !!dateStr && !!selectedVehiculo && !!selectedRepartidor,
  });

  // Merge: scheduled docs (in order) + available (not yet scheduled)
  useEffect(() => {
    const scheduledDocIds = new Set(scheduledEntregas.map((e: any) => e.documento_id));
    const scheduled = scheduledEntregas.map((e: any) => ({
      ...e.documentos,
      _entrega_id: e.id,
      _orden_ruta: e.orden_ruta,
      _is_scheduled: true,
    }));
    const unscheduled = availablePedidos.filter((d: any) => !scheduledDocIds.has(d.id));
    setOrderedDocs([...scheduled, ...unscheduled]);
  }, [scheduledEntregas, availablePedidos]);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVehiculo || !selectedRepartidor || !dateStr) throw new Error("Selecciona fecha, vehículo y repartidor");
      if (orderedDocs.length === 0) throw new Error("No hay pedidos para programar");

      // Delete existing schedules for this date+vehicle+driver
      await supabase
        .from("entregas_programadas")
        .delete()
        .eq("fecha_entrega", dateStr)
        .eq("vehiculo_id", selectedVehiculo)
        .eq("repartidor_id", selectedRepartidor);

      // Insert new schedule
      const rows = orderedDocs.map((doc, index) => ({
        documento_id: doc.id,
        vehiculo_id: selectedVehiculo,
        repartidor_id: selectedRepartidor,
        fecha_entrega: dateStr,
        orden_ruta: index,
      }));
      const { error } = await supabase.from("entregas_programadas").insert(rows);
      if (error) throw error;

      // Update all docs to programado_entrega
      for (const doc of orderedDocs) {
        if (doc.estatus_pedido !== "programado_entrega" && doc.estatus_pedido !== "entregado") {
          await supabase.from("documentos").update({ estatus_pedido: "programado_entrega" }).eq("id", doc.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Ruta de entrega guardada");
      queryClient.invalidateQueries({ queryKey: ["entregas-programadas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-for-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (err: any) => toast.error(err.message),
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

      // Update entrega_programada
      await supabase
        .from("entregas_programadas")
        .update({
          fecha_entrega_real: new Date().toISOString(),
          notas: deliverNotes || null,
          evidencia_url: evidenciaUrl,
        })
        .eq("documento_id", deliverDoc.id);

      // Update document status
      await supabase.from("documentos").update({ estatus_pedido: "entregado" }).eq("id", deliverDoc.id);

      toast.success("Entrega registrada");
      setDeliverDialog(false);
      queryClient.invalidateQueries({ queryKey: ["entregas-programadas"] });
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    } catch (err: any) {
      toast.error("Error: " + (err.message || "Error"));
    } finally {
      setUploading(false);
    }
  };

  const showList = selectedVehiculo && selectedRepartidor && dateStr;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Programación de Entregas</h1>
          <p className="text-muted-foreground text-sm">Organiza la ruta de entrega por fecha, vehículo y repartidor</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/documents")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Documentos
        </Button>
      </div>

      {/* Selectors: Date, Vehicle, Driver */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">2. Vehículo</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedVehiculo} onValueChange={setSelectedVehiculo}>
              <SelectTrigger><SelectValue placeholder="Seleccionar vehículo" /></SelectTrigger>
              <SelectContent>
                {vehiculos.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      <Truck className="h-3 w-3" /> {v.nombre} {v.placas ? `(${v.placas})` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vehiculos.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay vehículos registrados. Agrégalos en Catálogos.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">3. Repartidor</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedRepartidor} onValueChange={setSelectedRepartidor}>
              <SelectTrigger><SelectValue placeholder="Seleccionar repartidor" /></SelectTrigger>
              <SelectContent>
                {repartidores.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.nombre} {r.telefono ? `- ${r.telefono}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {repartidores.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">No hay repartidores registrados. Agrégalos en Catálogos.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drag & drop list */}
      {showList && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Ruta de Entrega — {selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}
              </CardTitle>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || orderedDocs.length === 0}>
                {saveMutation.isPending ? "Guardando..." : "Guardar Ruta"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Arrastra los pedidos para definir el orden de entrega</p>
          </CardHeader>
          <CardContent>
            {orderedDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="mx-auto h-10 w-10 mb-2 opacity-40" />
                <p>No hay pedidos validados disponibles para programar</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedDocs.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {orderedDocs.map((doc, index) => (
                      <SortableDeliveryItem key={doc.id} id={doc.id} doc={doc} index={index} onDeliver={handleOpenDeliver} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deliver confirmation dialog */}
      <Dialog open={deliverDialog} onOpenChange={setDeliverDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{deliverDoc?.numero_pedido || deliverDoc?.numero_cotizacion}</p>
              <p className="text-xs text-muted-foreground">{deliverDoc?.companies?.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Notas de entrega</Label>
              <Textarea value={deliverNotes} onChange={(e) => setDeliverNotes(e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
            <div className="space-y-2">
              <Label>Evidencia de Entrega (PDF o Foto)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              />
              {evidenceFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> {evidenceFile.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmDelivery} disabled={uploading}>
              {uploading ? "Subiendo..." : "Confirmar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
