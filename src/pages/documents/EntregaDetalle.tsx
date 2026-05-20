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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, MapPin, Upload, FileText, Image as ImageIcon, Trash2, Check,
  Navigation, Pencil, Loader2, ExternalLink, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AddressAutocompleteInput, emptyAddress, type AddressValue } from "@/components/AddressAutocompleteInput";
import { AddressDisplay } from "@/components/AddressDisplay";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { openDocFilesSignedUrl } from "@/lib/storageSignedUrl";
import { SignedDocImage } from "@/components/SignedDocImage";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CompanyAddressDialog } from "@/components/directory/CompanyAddressDialog";

export default function EntregaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const [uploading, setUploading] = useState<"evidencia" | "firmado" | null>(null);
  const [marking, setMarking] = useState(false);
  const [editAddrOpen, setEditAddrOpen] = useState(false);
  const [addrDialogOpen, setAddrDialogOpen] = useState(false);
  const [editingAddr, setEditingAddr] = useState<any | null>(null);
  const [selectedDireccionId, setSelectedDireccionId] = useState<string>("");
  const [newAddress, setNewAddress] = useState("");
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [newCity, setNewCity] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editNombreTouched, setEditNombreTouched] = useState(false);
  const [refreshingCoords, setRefreshingCoords] = useState(false);
  const [usingMyLocation, setUsingMyLocation] = useState(false);
  const [origenCambio, setOrigenCambio] = useState<"manual" | "ubicacion_actual">("manual");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const { ready: gmapsReady } = useGoogleMaps();
  const [gettingLocation, setGettingLocation] = useState(false);
  const [notas, setNotas] = useState("");
  const [savingNotas, setSavingNotas] = useState(false);
  const [estatusPedido, setEstatusPedido] = useState<string>("");
  const [fechaEntrega, setFechaEntrega] = useState<string>("");
  const [savingEstatus, setSavingEstatus] = useState(false);
  const [savingFecha, setSavingFecha] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustValue, setAdjustValue] = useState<string>("");
  const [savingAdjust, setSavingAdjust] = useState(false);

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

  // Direcciones registradas de la empresa (para lookup)
  const empresaIdForAddrs = (documento as any)?.empresa_id;
  const { data: direccionesEmpresa = [] } = useQuery({
    queryKey: ["direcciones-empresa-lookup", empresaIdForAddrs],
    queryFn: async () => {
      if (!empresaIdForAddrs) return [];
      const { data } = await supabase
        .from("direcciones_empresa")
        .select("id, nombre, direccion_completa, calle, ciudad, estado, codigo_postal, coordenadas_lat, coordenadas_lng, tipo, is_active")
        .eq("empresa_id", empresaIdForAddrs)
        .eq("is_active", true)
        .order("nombre", { ascending: true });
      return data || [];
    },
    enabled: !!empresaIdForAddrs,
  });

  // Nombre del usuario que ajustó manualmente la fecha/hora de entrega
  const editadaPorId = (entrega as any)?.fecha_entrega_real_editada_por as string | undefined;
  const { data: editorProfile } = useQuery({
    queryKey: ["entrega-editor-profile", editadaPorId],
    queryFn: async () => {
      if (!editadaPorId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", editadaPorId)
        .maybeSingle();
      return data;
    },
    enabled: !!editadaPorId,
  });

  useEffect(() => {
    if (documento?.direccion_envio) setNewAddress(documento.direccion_envio);
  }, [documento?.direccion_envio]);

  useEffect(() => {
    if (entrega?.notas !== undefined && entrega?.notas !== null) setNotas(entrega.notas);
    if (entrega?.fecha_entrega) setFechaEntrega(entrega.fecha_entrega);
  }, [entrega?.notas, entrega?.fecha_entrega]);

  useEffect(() => {
    if (documento?.estatus_pedido) setEstatusPedido(documento.estatus_pedido);
  }, [documento?.estatus_pedido]);

  // Auto-seleccionar dirección registrada que coincida con la del documento,
  // para que el selector muestre el nombre en lugar del placeholder.
  useEffect(() => {
    if (selectedDireccionId) return;
    if (!direccionesEmpresa || (direccionesEmpresa as any[]).length === 0) return;
    if (!documento) return;
    const list = direccionesEmpresa as any[];
    const docNombre = ((documento as any).direccion_envio_nombre || "").trim().toLowerCase();
    const docAddr = (documento.direccion_envio || "").trim().toLowerCase();
    let match: any = null;
    if (docNombre) {
      match = list.find((d) => (d.nombre || "").trim().toLowerCase() === docNombre);
    }
    if (!match && docAddr) {
      match = list.find((d) => {
        const full = (d.direccion_completa || [d.calle, d.ciudad, d.estado, d.codigo_postal].filter(Boolean).join(", ")).trim().toLowerCase();
        return full && full === docAddr;
      });
    }
    if (match) setSelectedDireccionId(match.id);
  }, [direccionesEmpresa, documento, selectedDireccionId]);

  const ESTATUS_OPCIONES: { value: string; label: string }[] = [
    { value: "confirmado_cliente", label: "Confirmado cliente" },
    { value: "espera_autorizacion_precio", label: "Espera autorización precio" },
    { value: "precio_autorizado", label: "Precio autorizado" },
    { value: "validado_contabilidad", label: "Validado contabilidad" },
    { value: "programado_entrega", label: "Programado entrega" },
    { value: "entregado", label: "Entregado" },
    { value: "cancelado", label: "Cancelado" },
  ];

  const saveEstatus = async (value: string) => {
    if (!id) return;
    setEstatusPedido(value);
    setSavingEstatus(true);
    const { error } = await supabase
      .from("documentos")
      .update({ estatus_pedido: value as any })
      .eq("id", id);
    setSavingEstatus(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Estatus actualizado");
      queryClient.invalidateQueries({ queryKey: ["entrega-doc", id] });
    }
  };

  const saveFechaEntrega = async (value: string) => {
    if (!entrega?.id) {
      toast.error("No hay entrega programada");
      return;
    }
    setFechaEntrega(value);
    setSavingFecha(true);
    const { error } = await supabase
      .from("entregas_programadas")
      .update({ fecha_entrega: value })
      .eq("id", entrega.id);
    setSavingFecha(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Fecha actualizada");
      queryClient.invalidateQueries({ queryKey: ["entrega-programada", id] });
    }
  };

  const saveNotas = async () => {
    if (!entrega?.id) {
      toast.error("No hay entrega programada para guardar notas");
      return;
    }
    setSavingNotas(true);
    const { error } = await supabase
      .from("entregas_programadas")
      .update({ notas })
      .eq("id", entrega.id);
    setSavingNotas(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Notas guardadas");
      queryClient.invalidateQueries({ queryKey: ["entrega-programada", id] });
    }
  };

  const openMaps = () => {
    if (!documento) return;
    const lat = (documento as any).direccion_envio_lat;
    const lng = (documento as any).direccion_envio_lng;
    const q = lat && lng
      ? `${lat},${lng}`
      : encodeURIComponent(documento.direccion_envio || "");
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  // Build default name: Empresa | Tipo | Calle | Ciudad (skip empties)
  const buildDefaultNombre = (calle: string, ciudad: string | null) => {
    const empresa = (documento as any)?.companies?.name || "";
    const tipo = "Entrega";
    const calleShort = (calle || "").split(",")[0]?.trim() || "";
    return [empresa, tipo, calleShort, ciudad || ""]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(" | ");
  };

  const refreshCoordsFromAddress = async () => {
    if (!newAddress.trim()) {
      toast.error("Escribe primero una dirección");
      return;
    }
    setRefreshingCoords(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newAddress)}&limit=1&addressdetails=1`,
        { headers: { "Accept-Language": "es" } }
      );
      const json = await res.json();
      if (Array.isArray(json) && json[0]?.lat && json[0]?.lon) {
        setNewLat(parseFloat(json[0].lat));
        setNewLng(parseFloat(json[0].lon));
        const a = json[0].address || {};
        const ciudad = a.city || a.town || a.village || a.municipality || null;
        if (ciudad) setNewCity(ciudad);
        toast.success("Coordenadas actualizadas");
      } else {
        toast.error("No se encontraron coordenadas para esta dirección");
      }
    } catch {
      toast.error("Error al obtener coordenadas");
    } finally {
      setRefreshingCoords(false);
    }
  };

  const useMyLocationForDelivery = async () => {
    if (!navigator.geolocation) {
      toast.error("Tu dispositivo no soporta geolocalización");
      return;
    }
    if (!documento || !id) return;
    setUsingMyLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let direccion = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        let ciudad: string | null = null;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "es" } }
          );
          const json = await res.json();
          if (json?.display_name) direccion = json.display_name;
          const a = json?.address || {};
          ciudad = a.city || a.town || a.village || a.municipality || null;
        } catch { /* keep coords-only fallback */ }

        try {
          const updates: any = {
            direccion_envio: direccion,
            direccion_envio_lat: lat,
            direccion_envio_lng: lng,
          };
          // Only autogenerate name if currently empty
          if (!(documento as any).direccion_envio_nombre) {
            updates.direccion_envio_nombre = buildDefaultNombre(direccion, ciudad);
          }
          const { error } = await supabase.from("documentos").update(updates).eq("id", id);
          if (error) throw error;
          await supabase.from("documento_direccion_bitacora").insert({
            documento_id: id,
            direccion_anterior: documento.direccion_envio,
            direccion_nueva: direccion,
            latitud: lat,
            longitud: lng,
            origen: "ubicacion_actual",
            usuario_id: user?.id,
          });
          toast.success("Dirección actualizada con tu ubicación");
          queryClient.invalidateQueries({ queryKey: ["entrega-doc", id] });
          refetchBitacora();
        } catch (e: any) {
          toast.error(e.message || "Error al guardar la ubicación");
        } finally {
          setUsingMyLocation(false);
        }
      },
      (err) => {
        setUsingMyLocation(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado"
            : "No se pudo obtener tu ubicación"
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFiles = async (files: FileList | null, categoria: "evidencia" | "firmado") => {
    if (!files || files.length === 0 || !id) return;
    setUploading(categoria);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const folder = categoria === "evidencia" ? "evidencias" : "firmados";
        const path = `${folder}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
          categoria,
        } as any);
        if (insErr) throw insErr;
      }
      toast.success("Archivos cargados");
      refetchArchivos();
    } catch (e: any) {
      toast.error(e.message || "Error al cargar archivos");
    } finally {
      setUploading(null);
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

    // Try to capture device GPS at the moment of delivery (best-effort)
    const capturedCoords: { lat: number; lng: number } | null = await new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.warning("Tu dispositivo no soporta geolocalización; se marcará entregada sin coordenadas.");
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            toast.warning("Permiso de ubicación denegado. Se marcará entregada sin coordenadas GPS.");
          } else {
            toast.warning("No se pudo obtener ubicación; se marcará entregada sin coordenadas.");
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

    const { error } = await supabase
      .from("documentos")
      .update({ estatus_pedido: "entregado" })
      .eq("id", id);

    if (!error && entrega) {
      const updates: any = { fecha_entrega_real: new Date().toISOString() };
      if (capturedCoords) {
        updates.delivered_latitude = capturedCoords.lat;
        updates.delivered_longitude = capturedCoords.lng;
      }
      await supabase.from("entregas_programadas").update(updates).eq("id", entrega.id);
    }
    setMarking(false);
    if (error) toast.error(error.message);
    else {
      toast.success(
        capturedCoords
          ? `Entregado · GPS ${capturedCoords.lat.toFixed(5)}, ${capturedCoords.lng.toFixed(5)}`
          : "Marcado como entregado"
      );
      setEstatusPedido("entregado");
      queryClient.invalidateQueries({ queryKey: ["entrega-doc", id] });
      queryClient.invalidateQueries({ queryKey: ["entrega-programada", id] });
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
    const addrText = newAddress.trim();
    let latToSave = newLat;
    let lngToSave = newLng;
    let addrToSave = addrText;

    if (!addrToSave && latToSave == null && lngToSave == null) {
      toast.error("Captura una dirección o coordenadas");
      return;
    }

    // Autocompletar la pieza faltante usando el geocoder de Google Maps.
    const g = (window as any).google;
    if (gmapsReady && g?.maps) {
      try {
        const geocoder = new g.maps.Geocoder();
        // Caso 1: hay dirección pero faltan coordenadas → forward geocoding
        if (addrToSave && (latToSave == null || lngToSave == null)) {
          const res: any = await new Promise((resolve, reject) => {
            geocoder.geocode({ address: addrToSave, region: "mx" }, (results: any, status: any) => {
              if (status === "OK" && results?.[0]) resolve(results[0]);
              else reject(new Error(`Geocoder: ${status}`));
            });
          });
          const loc = res.geometry?.location;
          latToSave = typeof loc?.lat === "function" ? loc.lat() : loc?.lat;
          lngToSave = typeof loc?.lng === "function" ? loc.lng() : loc?.lng;
        }
        // Caso 2: hay coordenadas pero falta dirección → reverse geocoding
        else if (!addrToSave && latToSave != null && lngToSave != null) {
          const res: any = await new Promise((resolve, reject) => {
            geocoder.geocode({ location: { lat: Number(latToSave), lng: Number(lngToSave) } }, (results: any, status: any) => {
              if (status === "OK" && results?.[0]) resolve(results[0]);
              else reject(new Error(`Geocoder: ${status}`));
            });
          });
          addrToSave = res.formatted_address || `${latToSave}, ${lngToSave}`;
        }
      } catch (e: any) {
        toast.error(e?.message || "No se pudo completar la dirección/coordenadas automáticamente");
        return;
      }
    } else if (!addrToSave || latToSave == null || lngToSave == null) {
      toast.error("Google Maps no está listo para calcular la información faltante");
      return;
    }

    setSavingAddr(true);
    try {
      const updates: any = { direccion_envio: addrToSave };
      if (latToSave !== null) updates.direccion_envio_lat = latToSave;
      if (lngToSave !== null) updates.direccion_envio_lng = lngToSave;
      // Nombre: respect manual edits; only auto-fill if empty
      const currentNombre = (documento as any).direccion_envio_nombre || "";
      if (editNombreTouched) {
        updates.direccion_envio_nombre = editNombre.trim();
      } else if (!currentNombre) {
        updates.direccion_envio_nombre = buildDefaultNombre(addrToSave, newCity);
      }
      const { error } = await supabase.from("documentos").update(updates).eq("id", id);
      if (error) throw error;
      await supabase.from("documento_direccion_bitacora").insert({
        documento_id: id,
        direccion_anterior: documento.direccion_envio,
        direccion_nueva: addrToSave,
        latitud: latToSave,
        longitud: lngToSave,
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
          {ESTATUS_OPCIONES.find((o) => o.value === documento.estatus_pedido)?.label || "—"}
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
              {entrega.fecha_entrega_real && (
                <div className="text-green-600 dark:text-green-400">
                  <Check className="inline h-3.5 w-3.5 mr-1" />
                  Entregado: {format(new Date(entrega.fecha_entrega_real), "dd MMM yyyy HH:mm", { locale: es })}
                </div>
              )}
              {(entrega as any).delivered_latitude != null && (entrega as any).delivered_longitude != null && (
                <div className="text-xs text-muted-foreground">
                  📍 GPS de entrega: {Number((entrega as any).delivered_latitude).toFixed(6)}, {Number((entrega as any).delivered_longitude).toFixed(6)}
                  {" · "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${(entrega as any).delivered_latitude},${(entrega as any).delivered_longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    ver
                  </a>
                </div>
              )}
              {entrega.fecha_entrega_real && (archivos as any[]).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                  {(archivos as any[]).map((a) => {
                    const isImg = a.tipo_archivo?.startsWith("image/");
                    const isPdf = a.tipo_archivo === "application/pdf";
                    return (
                       <button
                         key={a.id}
                         type="button"
                         onClick={() => openDocFilesSignedUrl(a.url_archivo)}
                         className="border rounded-md p-2 hover:bg-accent/40 transition-colors flex flex-col gap-1 min-w-0 text-left"
                         title={a.nombre_archivo}
                       >
                         {isImg ? (
                           <SignedDocImage src={a.url_archivo} alt={a.nombre_archivo} className="h-16 w-full object-cover rounded" />
                         ) : (
                          <div className="h-16 w-full flex items-center justify-center bg-muted rounded">
                            {isPdf ? <FileText className="h-6 w-6 text-primary" /> : <FileText className="h-6 w-6 text-muted-foreground" />}
                          </div>
                        )}
                        <div className="text-[11px] truncate">{a.nombre_archivo}</div>
                       </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <Separator className="my-2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="estatus-pedido" className="text-xs text-muted-foreground">Estatus Pedido</Label>
              <Select value={estatusPedido} onValueChange={saveEstatus} disabled={savingEstatus}>
                <SelectTrigger id="estatus-pedido" className="h-9">
                  <SelectValue placeholder="Selecciona estatus" />
                </SelectTrigger>
                <SelectContent>
                  {ESTATUS_OPCIONES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fecha-entrega" className="text-xs text-muted-foreground">Fecha Entrega</Label>
              <Input
                id="fecha-entrega"
                type="date"
                className="h-9"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== entrega?.fecha_entrega) {
                    saveFechaEntrega(e.target.value);
                  }
                }}
                disabled={savingFecha || !entrega}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dirección */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Dirección de Entrega
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => {
            setNewLat(docLat ?? null);
            setNewLng(docLng ?? null);
            setNewCity(null);
            setOrigenCambio("manual");
            setNewAddress(documento.direccion_envio || "");
            setEditNombre((documento as any).direccion_envio_nombre || "");
            setEditNombreTouched(false);
            setSelectedDireccionId("");
            setEditAddrOpen(true);
          }}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1 pb-2 border-b">
            <Label className="text-xs">Seleccionar dirección registrada de la empresa</Label>
            {direccionesEmpresa.length > 0 ? (
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={selectedDireccionId}
                    onValueChange={async (val) => {
                      setSelectedDireccionId(val);
                      const d: any = direccionesEmpresa.find((x: any) => x.id === val);
                      if (!d || !id || !documento) return;
                      const direccion = d.direccion_completa || [d.calle, d.ciudad, d.estado, d.codigo_postal].filter(Boolean).join(", ");
                      const updates: any = {
                        direccion_envio: direccion,
                        direccion_envio_lat: d.coordenadas_lat ?? null,
                        direccion_envio_lng: d.coordenadas_lng ?? null,
                      };
                      if (!(documento as any).direccion_envio_nombre && d.nombre) {
                        updates.direccion_envio_nombre = d.nombre;
                      }
                      const { error } = await supabase.from("documentos").update(updates).eq("id", id);
                      if (error) { toast.error(error.message); return; }
                      await supabase.from("documento_direccion_bitacora").insert({
                        documento_id: id,
                        direccion_anterior: documento.direccion_envio,
                        direccion_nueva: direccion,
                        latitud: d.coordenadas_lat ?? null,
                        longitud: d.coordenadas_lng ?? null,
                        origen: "lookup_direcciones_empresa",
                        usuario_id: user?.id,
                      });
                      toast.success("Dirección actualizada desde catálogo");
                      queryClient.invalidateQueries({ queryKey: ["entrega-doc", id] });
                      refetchBitacora();
                    }}
                    options={(direccionesEmpresa as any[]).map((d) => ({
                      value: d.id,
                      label: d.nombre || d.direccion_completa || d.calle || "Sin nombre",
                      description: (d.direccion_completa || d.calle) && (d.nombre)
                        ? (d.direccion_completa || d.calle)
                        : undefined,
                      searchText: `${d.nombre || ""} ${d.direccion_completa || ""} ${d.calle || ""} ${d.ciudad || ""}`,
                    }))}
                    placeholder="Selecciona una dirección..."
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={!selectedDireccionId}
                  title="Ver / Editar dirección"
                  onClick={() => {
                    if (!empresaIdForAddrs || !selectedDireccionId) return;
                    const sel = (direccionesEmpresa as any[]).find((d) => d.id === selectedDireccionId);
                    setEditingAddr(sel || null);
                    setAddrDialogOpen(true);
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-md border border-dashed p-2">
                <p className="text-xs text-muted-foreground">Esta empresa no tiene direcciones registradas todavía.</p>
                {empresaIdForAddrs && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { setEditingAddr(null); setAddrDialogOpen(true); }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Agregar dirección
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Elige una de las direcciones registradas o edita manualmente con el botón "Editar".</p>
          </div>
          {(documento as any).direccion_envio_nombre && (
            <p className="text-sm font-medium">{(documento as any).direccion_envio_nombre}</p>
          )}
          <p className="text-sm">{documento.direccion_envio || <span className="text-muted-foreground italic">Sin dirección</span>}</p>
          {(docLat && docLng) && (
            <p className="text-xs text-muted-foreground">📍 {Number(docLat).toFixed(6)}, {Number(docLng).toFixed(6)}</p>
          )}
          {/* Si la dirección del documento no está en el catálogo de la empresa, ofrecer guardarla */}
          {empresaIdForAddrs && documento.direccion_envio && (direccionesEmpresa as any[]).length === 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Esta dirección no está registrada en el catálogo de la empresa.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-amber-400 text-amber-900 hover:bg-amber-100"
                onClick={async () => {
                  const nombre = (documento as any).direccion_envio_nombre || documento.direccion_envio;
                  const { data: inserted, error } = await supabase
                    .from("direcciones_empresa")
                    .insert({
                      empresa_id: empresaIdForAddrs,
                      nombre,
                      tipo: "envio",
                      tipos: ["envio"],
                      calle: documento.direccion_envio,
                      direccion_completa: documento.direccion_envio,
                      coordenadas_lat: docLat ?? null,
                      coordenadas_lng: docLng ?? null,
                    } as any)
                    .select("id")
                    .single();
                  if (error) { toast.error(error.message); return; }
                  toast.success("Dirección guardada en el catálogo de la empresa");
                  queryClient.invalidateQueries({ queryKey: ["direcciones-empresa-lookup"] });
                  setSelectedDireccionId((inserted as any).id);
                }}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Guardar como dirección de la empresa
              </Button>
            </div>
          )}
          {(documento.direccion_envio || (docLat && docLng)) && (
            <AddressDisplay
              address={documento.direccion_envio}
              lat={docLat}
              lng={docLng}
              showText={false}
              showMap
              mapHeight={180}
            />
          )}
          {documento.direccion_envio && (
            <Button size="sm" variant="default" onClick={openMaps} className="w-full sm:w-auto">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir en Google Maps
            </Button>
          )}
          <div className="pt-2 border-t mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={useMyLocationForDelivery}
              disabled={usingMyLocation}
              className="w-full sm:w-auto"
            >
              {usingMyLocation ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Navigation className="h-3.5 w-3.5 mr-1" />}
              Usar mi ubicación actual
            </Button>
            <p className="text-xs text-muted-foreground mt-1">Este botón actualiza la dirección usando tu ubicación actual.</p>
          </div>
        </CardContent>
      </Card>

      {/* Evidencia de Entrega */}
      <ArchivosCard
        titulo="Evidencia de Entrega"
        categoria="evidencia"
        inputId="files-evidencia"
        archivos={(archivos as any[]).filter((a) => (a.categoria || "firmado") === "evidencia")}
        uploading={uploading === "evidencia"}
        onUpload={(fl) => handleFiles(fl, "evidencia")}
        onDelete={deleteFile}
      />

      {/* Documento Firmado */}
      <ArchivosCard
        titulo="Documento Firmado"
        categoria="firmado"
        inputId="files-firmado"
        archivos={(archivos as any[]).filter((a) => (a.categoria || "firmado") === "firmado")}
        uploading={uploading === "firmado"}
        onUpload={(fl) => handleFiles(fl, "firmado")}
        onDelete={deleteFile}
      />
      {/* Notas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Notas de la entrega..."
          />
          <Button size="sm" onClick={saveNotas} disabled={savingNotas || !entrega}>
            {savingNotas && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar notas
          </Button>
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
            <AddressAutocompleteInput
              value={{
                direccion_completa: newAddress,
                latitud: newLat,
                longitud: newLng,
                ciudad: null,
                estado: null,
                pais: null,
                codigo_postal: null,
                codigo_google: null,
              }}
              onChange={(v: AddressValue) => {
                setNewAddress(v.direccion_completa);
                setNewLat(v.latitud);
                setNewLng(v.longitud);
                setNewCity(v.ciudad ?? null);
                setOrigenCambio("manual");
                setSelectedDireccionId("");
              }}
              label="Dirección de entrega"
              required
              placeholder="Buscar dirección..."
            />
            <div>
              <Label>Nombre</Label>
              <Input
                value={editNombre}
                onChange={(e) => { setEditNombre(e.target.value); setEditNombreTouched(true); }}
                placeholder="Se generará automáticamente: Empresa | Tipo | Calle | Ciudad"
              />
              <p className="text-xs text-muted-foreground mt-1">Identificador editable de la dirección. No se sobrescribe al actualizar.</p>
            </div>
            <div className="rounded-md border p-2 space-y-2">
              <div className="text-xs text-muted-foreground">Coordenadas</div>
              <div className="text-sm">
                {newLat != null && newLng != null
                  ? <>📍 {Number(newLat).toFixed(6)}, {Number(newLng).toFixed(6)}</>
                  : <span className="text-muted-foreground italic">Sin coordenadas</span>}
              </div>
              <Button size="sm" variant="outline" onClick={refreshCoordsFromAddress} disabled={refreshingCoords}>
                {refreshingCoords ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Navigation className="h-3.5 w-3.5 mr-1" />}
                Actualizar coordenadas
              </Button>
            </div>
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
      {empresaIdForAddrs && (
        <CompanyAddressDialog
          open={addrDialogOpen}
          onOpenChange={(v) => { setAddrDialogOpen(v); if (!v) setEditingAddr(null); }}
          empresaId={empresaIdForAddrs}
          empresaName={(documento as any)?.empresa_nombre || ""}
          editing={editingAddr}
        />
      )}
    </div>
  );
}

function ArchivosCard({
  titulo, categoria, inputId, archivos, uploading, onUpload, onDelete,
}: {
  titulo: string;
  categoria: "evidencia" | "firmado";
  inputId: string;
  archivos: any[];
  uploading: boolean;
  onUpload: (files: FileList | null) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor={inputId} className="block">
          <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-accent/30 transition-colors">
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">{uploading ? "Cargando..." : "Toca para subir fotos o PDFs"}</p>
            <p className="text-xs text-muted-foreground mt-1">Múltiples archivos · imágenes y PDF</p>
          </div>
          <input
            id={inputId}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }}
          />
        </Label>

        {archivos.length > 0 && (
          <div className="space-y-1.5">
            {archivos.map((a) => {
              const isImg = a.tipo_archivo?.startsWith("image/");
              return (
                <div key={a.id} className="flex items-center gap-2 p-2 border rounded-md">
                  {isImg ? <ImageIcon className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                  <button type="button" onClick={() => openDocFilesSignedUrl(a.url_archivo)} className="flex-1 text-sm truncate hover:underline text-left">{a.nombre_archivo}</button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
