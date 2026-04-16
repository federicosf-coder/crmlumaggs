import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileSignature, MapPin, Truck, Upload, FileText, Image as ImageIcon, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_LABEL: Record<string, string> = {
  confirmado_cliente: "Confirmado por cliente",
  espera_autorizacion_precio: "Espera autorización de precio",
  precio_autorizado: "Precio autorizado",
  validado_contabilidad: "Validado por contabilidad",
  programado_entrega: "Programado para entrega",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export default function EntregaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const { data: documento, isLoading } = useQuery({
    queryKey: ["entrega-documento", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*, companies(name, phone), contacts(first_name, last_name, phone)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: entrega } = useQuery({
    queryKey: ["entrega-programada", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas_programadas")
        .select("*, rutas_entrega(*, plazas(nombre)), repartidores(nombre, telefono), vehiculos(nombre, placas)")
        .eq("documento_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: archivos = [], refetch: refetchArchivos } = useQuery({
    queryKey: ["entrega-archivos-firmados", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documento_archivos_firmados")
        .select("*")
        .eq("documento_id", id!)
        .order("fecha_carga", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !id) return;
    setUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `firmados/${id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("document-files").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("document-files").getPublicUrl(path);
        const { error: insErr } = await supabase.from("documento_archivos_firmados").insert({
          documento_id: id,
          tipo_archivo: file.type || (ext === "pdf" ? "application/pdf" : "image/*"),
          nombre_archivo: file.name,
          url_archivo: urlData.publicUrl,
          usuario_carga: user?.id,
        });
        if (insErr) throw insErr;
      }
      toast.success(`${files.length} archivo(s) cargados`);
      refetchArchivos();
      e.target.value = "";
    } catch (err: any) {
      toast.error(err.message || "Error al cargar archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (archivoId: string) => {
    if (!confirm("¿Eliminar este archivo firmado?")) return;
    const { error } = await supabase.from("documento_archivos_firmados").delete().eq("id", archivoId);
    if (error) { toast.error(error.message); return; }
    toast.success("Archivo eliminado");
    refetchArchivos();
  };

  const marcarEntregado = async () => {
    if (!id) return;
    if (!confirm("¿Marcar como entregado?")) return;
    const { error: e1 } = await supabase.from("documentos").update({ estatus_pedido: "entregado" }).eq("id", id);
    if (e1) { toast.error(e1.message); return; }
    if (entrega) {
      await supabase.from("entregas_programadas")
        .update({ fecha_entrega_real: new Date().toISOString() })
        .eq("documento_id", id);
    }
    toast.success("Entrega marcada como completada");
    queryClient.invalidateQueries({ queryKey: ["entrega-documento", id] });
    queryClient.invalidateQueries({ queryKey: ["entrega-programada", id] });
  };

  if (isLoading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</div>;
  }
  if (!documento) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Button>
        <p className="mt-4 text-muted-foreground">Documento no encontrado.</p>
      </div>
    );
  }

  const estatus = documento.estatus_pedido || "confirmado_cliente";
  const isImage = (tipo: string) => tipo?.startsWith("image/");
  const ruta = entrega?.rutas_entrega;
  const repartidor = entrega?.repartidores;
  const vehiculo = entrega?.vehiculos;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-5 w-5" /> Pantalla de Entrega
          </h1>
        </div>
        {estatus !== "entregado" && (
          <Button onClick={marcarEntregado} className="bg-success text-success-foreground hover:bg-success/90">
            Marcar como Entregado
          </Button>
        )}
      </div>

      {/* Info principal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">{documento.numero_pedido || documento.numero_cotizacion || "Documento"}</CardTitle>
            <Badge variant="outline" className="capitalize">{STATUS_LABEL[estatus] || estatus}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <p className="font-medium">{(documento as any).companies?.name || "Sin cliente"}</p>
              {(documento as any).companies?.phone && (
                <p className="text-xs text-muted-foreground">📞 {(documento as any).companies.phone}</p>
              )}
            </div>
            {(documento as any).contacts && (
              <div>
                <Label className="text-xs text-muted-foreground">Contacto</Label>
                <p className="font-medium">{(documento as any).contacts.first_name} {(documento as any).contacts.last_name}</p>
                {(documento as any).contacts.phone && (
                  <p className="text-xs text-muted-foreground">📞 {(documento as any).contacts.phone}</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Dirección de entrega</Label>
            {documento.direccion_envio ? (
              <div className="flex items-start gap-2 mt-1">
                <p className="flex-1">{documento.direccion_envio}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(documento.direccion_envio!)}`, "_blank")}
                >
                  <MapPin className="h-3.5 w-3.5 mr-1" /> Abrir
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground italic mt-1">Sin dirección registrada</p>
            )}
          </div>

          <Separator />

          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Ruta de entrega</Label>
            {ruta ? (
              <div className="mt-1 space-y-0.5">
                <p>📅 {ruta.fecha_entrega ? format(new Date(ruta.fecha_entrega + "T12:00:00"), "EEEE dd MMM yyyy", { locale: es }) : "Sin fecha"}</p>
                <p>📍 {ruta.plazas?.nombre || "Sin plaza"}</p>
                {vehiculo && <p>🚚 {vehiculo.nombre}{vehiculo.placas ? ` (${vehiculo.placas})` : ""}</p>}
                {repartidor && <p>👤 {repartidor.nombre}{repartidor.telefono ? ` — ${repartidor.telefono}` : ""}</p>}
              </div>
            ) : (
              <p className="text-muted-foreground italic mt-1">Sin ruta asignada</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documento Firmado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4" /> Documento Firmado
            <Badge variant="secondary">{archivos.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="firmado-upload" className="block">
              <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm">Cargando archivos...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-primary" />
                    <p className="text-sm font-medium">Toca aquí para cargar</p>
                    <p className="text-xs text-muted-foreground">Imágenes o PDFs (puedes seleccionar varios)</p>
                  </div>
                )}
              </div>
            </Label>
            <Input
              id="firmado-upload"
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>

          {archivos.length > 0 && (
            <div className="space-y-2">
              {archivos.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 p-2 border rounded-md hover:bg-accent/30">
                  {isImage(a.tipo_archivo) ? (
                    <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.nombre_archivo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(a.fecha_carga), "dd MMM yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(a.url_archivo, "_blank")} title="Abrir">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(a.id)} title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
