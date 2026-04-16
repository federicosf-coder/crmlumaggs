import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, MapPin, Upload, FileText, Image as ImageIcon, Trash2, Check,
  Navigation, Pencil, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function EntregaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [uploading, setUploading] = useState<"evidencia" | "firmado" | null>(null);
  const [marking, setMarking] = useState(false);
  const [editAddrOpen, setEditAddrOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [origenCambio, setOrigenCambio] = useState<"manual" | "ubicacion_actual">("manual");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Documento
  const { data: documento, isLoading } = useQuery({
    queryKey: ["entrega-doc", id],
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

  // Entrega programada
  const { data: entrega } = useQuery({
    queryKey: ["entrega-programada", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas_programadas")
        .select("*, vehiculos(nombre, placas), repartidores(nombre)")
        .eq("documento_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  // Archivos firmados
  const { data: archivos = [], refetch: refetchArchivos } = useQuery({
    queryKey: ["archivos-firmados", id],
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

  // Bitácora de cambios de dirección
  const { data: bitacora = [], refetch: refetchBitacora } = useQuery({
    queryKey: ["bitacora-direccion", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documento_direccion_bitacora")
        .select("*")
        .eq("documento_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (documento?.direccion_envio) setNewAddress(documento.direccion_envio);
  }, [documento?.direccion_envio]);

  const openMaps = () => {
    if (!documento) return;
    const lat = (documento as any).direccion_envio_lat;
    const lng = (documento as any).direccion_envio_lng;
    const q = lat && lng
      ? `${lat},${lng}`
      : encodeURIComponent(documento.direccion_envio || "");
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `firmados/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("document-files")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("document-files").getPublicUrl(path);
        const { error: insErr } = await supabase.from("documento_archivos_firmados").insert({
          documento_id: id,
          nombre_archivo: file.name,
          tipo_archivo: file.type || "application/octet-stream",
          url_archivo: urlData.publicUrl,
          usuario_carga: user?.id,
        });
        if (insErr) throw insErr;
      }
      toast.success("Archivos cargados");
      refetchArchivos();
    } catch (e: any) {
      toast.error(e.message || "Error al cargar archivos");
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (archivoId: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    const { error } = await supabase.from("documento_archivos_firmados").delete().eq("id", archivoId);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); refetchArchivos(); }
  };

  const markDelivered = async () => {
    if (!id) return;
    setMarking(true);
    const { error } = await supabase
      .from("documentos")
      .update({ estatus_pedido: "entregado" })
      .eq("id", id);
    if (!error && entrega) {
      await supabase
        .from("entregas_programadas")
        .update({ fecha_entrega_real: new Date().toISOString() })
        .eq("id", entrega.id);
    }
    setMarking(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Marcado como entregado");
      queryClient.invalidateQueries({ queryKey: ["entrega-doc", id] });
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu dispositivo no soporta geolocalización");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setNewLat(lat);
        setNewLng(lng);
        setOrigenCambio("ubicacion_actual");
        // Reverse geocode (best-effort, no API key required)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "es" } }
          );
          const json = await res.json();
          if (json?.display_name) setNewAddress(json.display_name);
          else setNewAddress(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
        } catch {
          setNewAddress(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
        }
        setGettingLocation(false);
        toast.success("Ubicación capturada");
      },
      (err) => {
        setGettingLocation(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado"
            : "No se pudo obtener tu ubicación"
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveAddress = async () => {
    if (!id || !documento) return;
    if (!newAddress.trim()) {
      toast.error("La dirección no puede estar vacía");
      return;
    }
    setSavingAddr(true);
    try {
      const updates: any = { direccion_envio: newAddress.trim() };
      if (newLat !== null) updates.direccion_envio_lat = newLat;
      if (newLng !== null) updates.direccion_envio_lng = newLng;
      const { error } = await supabase.from("documentos").update(updates).eq("id", id);
      if (error) throw error;
      await supabase.from("documento_direccion_bitacora").insert({
        documento_id: id,
        direccion_anterior: documento.direccion_envio,
        direccion_nueva: newAddress.trim(),
        latitud: newLat,
        longitud: newLng,
        origen: origenCambio,
        usuario_id: user?.id,
      });
      toast.success("Dirección actualizada");
      setEditAddrOpen(false);
      setConfirmOpen(false);
      setNewLat(null);
      setNewLng(null);
      setOrigenCambio("manual");
      queryClient.invalidateQueries({ queryKey: ["entrega-doc", id] });
      refetchBitacora();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSavingAddr(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (!documento) return <div className="p-8 text-center text-muted-foreground">Documento no encontrado</div>;

  const numero = documento.numero_pedido || documento.numero_factura || documento.numero_cotizacion || documento.id.slice(0, 8);
  const docLat = (documento as any).direccion_envio_lat;
  const docLng = (documento as any).direccion_envio_lng;

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">Entrega · {numero}</h1>
          <p className="text-sm text-muted-foreground">{documento.companies?.name}</p>
        </div>
        <Badge variant={documento.estatus_pedido === "entregado" ? "default" : "secondary"}>
          {documento.estatus_pedido || "—"}
        </Badge>
      </div>

      {/* Información */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Información</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Cliente:</span> <strong>{documento.companies?.name || "—"}</strong></div>
          {documento.contacts && (
            <div><span className="text-muted-foreground">Contacto:</span> {documento.contacts.first_name} {documento.contacts.last_name} {documento.contacts.phone && `· ${documento.contacts.phone}`}</div>
          )}
          {entrega && (
            <>
              <div><span className="text-muted-foreground">Vehículo:</span> {entrega.vehiculos?.nombre || "—"} {entrega.vehiculos?.placas && `(${entrega.vehiculos.placas})`}</div>
              <div><span className="text-muted-foreground">Repartidor:</span> {entrega.repartidores?.nombre || "—"}</div>
              <div><span className="text-muted-foreground">Fecha:</span> {entrega.fecha_entrega ? format(new Date(entrega.fecha_entrega + "T12:00:00"), "dd MMM yyyy", { locale: es }) : "—"}</div>
              {entrega.fecha_entrega_real && (
                <div className="text-green-600 dark:text-green-400">
                  <Check className="inline h-3.5 w-3.5 mr-1" />
                  Entregado: {format(new Date(entrega.fecha_entrega_real), "dd MMM yyyy HH:mm", { locale: es })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dirección */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Dirección de Entrega
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => { setNewLat(null); setNewLng(null); setOrigenCambio("manual"); setNewAddress(documento.direccion_envio || ""); setEditAddrOpen(true); }}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{documento.direccion_envio || <span className="text-muted-foreground italic">Sin dirección</span>}</p>
          {(docLat && docLng) && (
            <p className="text-xs text-muted-foreground">📍 {Number(docLat).toFixed(6)}, {Number(docLng).toFixed(6)}</p>
          )}
          {documento.direccion_envio && (
            <Button size="sm" variant="default" onClick={openMaps} className="w-full sm:w-auto">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir en Google Maps
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Documento Firmado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Documento Firmado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="files" className="block">
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent/30 transition-colors">
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">{uploading ? "Cargando..." : "Toca para subir fotos o PDFs"}</p>
              <p className="text-xs text-muted-foreground mt-1">Múltiples archivos · imágenes y PDF</p>
            </div>
            <input
              id="files"
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
          </Label>

          {archivos.length > 0 && (
            <div className="space-y-1.5">
              {archivos.map((a: any) => {
                const isImg = a.tipo_archivo?.startsWith("image/");
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 border rounded-md">
                    {isImg ? <ImageIcon className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                    <a href={a.url_archivo} target="_blank" rel="noreferrer" className="flex-1 text-sm truncate hover:underline">{a.nombre_archivo}</a>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteFile(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acción principal */}
      {documento.estatus_pedido !== "entregado" && (
        <Button className="w-full h-12 text-base" onClick={markDelivered} disabled={marking}>
          {marking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Marcar como Entregado
        </Button>
      )}

      {/* Bitácora */}
      {bitacora.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Historial de Dirección</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {bitacora.map((b: any) => (
              <div key={b.id} className="text-xs border-l-2 border-primary pl-2 py-1">
                <div className="text-muted-foreground">{format(new Date(b.created_at), "dd MMM yyyy HH:mm", { locale: es })} · {b.origen}</div>
                <div>{b.direccion_nueva}</div>
                {b.latitud && b.longitud && (
                  <div className="text-muted-foreground">📍 {Number(b.latitud).toFixed(6)}, {Number(b.longitud).toFixed(6)}</div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Editar dirección */}
      <Dialog open={editAddrOpen} onOpenChange={setEditAddrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar dirección</DialogTitle>
            <DialogDescription>Edita la dirección o usa tu ubicación actual</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={useCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
              Usar mi ubicación actual
            </Button>
            <div>
              <Label htmlFor="addr">Dirección</Label>
              <Textarea
                id="addr"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                rows={3}
                placeholder="Calle, número, colonia, ciudad..."
              />
            </div>
            {newLat !== null && newLng !== null && (
              <p className="text-xs text-muted-foreground">📍 {newLat.toFixed(6)}, {newLng.toFixed(6)}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditAddrOpen(false)}>Cancelar</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!newAddress.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Confirmar cambio?</DialogTitle>
            <DialogDescription>Esta acción actualizará la dirección del documento y quedará registrada en la bitácora.</DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <div><span className="text-muted-foreground">Anterior:</span><br />{documento.direccion_envio || "—"}</div>
            <Separator />
            <div><span className="text-muted-foreground">Nueva:</span><br /><strong>{newAddress}</strong></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={saveAddress} disabled={savingAddr}>
              {savingAddr && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
