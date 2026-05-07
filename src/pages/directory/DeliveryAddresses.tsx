import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ImportExportMenu } from "@/components/ImportExportMenu";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Search, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { AddressAutocompleteInput, emptyAddress, type AddressValue } from "@/components/AddressAutocompleteInput";
import { AddressDisplay } from "@/components/AddressDisplay";
import { BackButton } from "@/components/BackButton";

interface TipoCatalogItem {
  id: string;
  clave: string;
  etiqueta: string;
  is_active: boolean;
}

interface Address {
  id: string;
  empresa_id: string;
  nombre: string | null;
  tipo: string;
  tipos: string[] | null;
  calle: string;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
  pais: string | null;
  direccion_completa: string | null;
  referencia: string | null;
  coordenadas_lat: number | null;
  coordenadas_lng: number | null;
  codigo_google: string | null;
  is_active: boolean;
  companies?: { name: string } | null;
}

export default function DeliveryAddresses() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  type SortField = "empresa" | "nombre" | "tipos" | "direccion" | "coordenadas";
  const [sortField, setSortField] = useState<SortField>("empresa");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDirection(d => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDirection("asc"); }
  };
  const SortIcon = ({ f }: { f: SortField }) => {
    if (sortField !== f) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 inline text-muted-foreground" />;
    return sortDirection === "asc"
      ? <ChevronUp className="h-3.5 w-3.5 ml-1 inline" />
      : <ChevronDown className="h-3.5 w-3.5 ml-1 inline" />;
  };

  const [form, setForm] = useState<{
    empresa_id: string;
    tipos: string[];
    nombre: string;
    nombre_touched: boolean;
    referencia: string;
    address: AddressValue;
  }>({
    empresa_id: "",
    tipos: ["envio"],
    nombre: "",
    nombre_touched: false,
    referencia: "",
    address: { ...emptyAddress },
  });

  const { data: tiposCatalog = [] } = useQuery({
    queryKey: ["tipos_direccion_catalog"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("tipos_direccion")
        .select("id, clave, etiqueta, is_active")
        .eq("is_active", true)
        .order("etiqueta");
      return (data || []) as TipoCatalogItem[];
    },
  });

  const labelByClave = (clave: string) =>
    tiposCatalog.find((t) => t.clave === clave)?.etiqueta || clave;

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["all_addresses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("direcciones_empresa")
        .select("*, companies(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data || []) as unknown as Address[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies_for_addr"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const filtered = addresses.filter((a) => {
    const q = search.toLowerCase();
    const tipos = (a.tipos && a.tipos.length ? a.tipos : [a.tipo]).join(" ").toLowerCase();
    const coord = `${a.coordenadas_lat ?? ""},${a.coordenadas_lng ?? ""}`;
    return (
      a.calle.toLowerCase().includes(q) ||
      (a.nombre || "").toLowerCase().includes(q) ||
      (a.ciudad || "").toLowerCase().includes(q) ||
      (a.estado || "").toLowerCase().includes(q) ||
      (a.companies?.name || "").toLowerCase().includes(q) ||
      tipos.includes(q) ||
      coord.includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    const getVal = (x: Address): string | number => {
      switch (sortField) {
        case "empresa": return (x.companies?.name || "").toLowerCase();
        case "nombre": return (x.nombre || "").toLowerCase();
        case "tipos": return ((x.tipos && x.tipos.length ? x.tipos : [x.tipo]).join(",") || "").toLowerCase();
        case "direccion": return (x.direccion_completa || x.calle || "").toLowerCase();
        case "coordenadas": return x.coordenadas_lat != null ? Number(x.coordenadas_lat) : Number.NEGATIVE_INFINITY;
      }
    };
    const va = getVal(a); const vb = getVal(b);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  const resetForm = () => {
    setForm({ empresa_id: "", tipos: ["envio"], nombre: "", nombre_touched: false, referencia: "", address: { ...emptyAddress } });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (a: Address) => {
    setEditing(a);
    const tipos = a.tipos && a.tipos.length > 0 ? a.tipos : (a.tipo ? [a.tipo] : []);
    setForm({
      empresa_id: a.empresa_id,
      tipos,
      nombre: a.nombre || "",
      nombre_touched: !!(a.nombre && a.nombre.trim()),
      referencia: a.referencia || "",
      address: {
        direccion_completa: a.direccion_completa || a.calle || "",
        latitud: a.coordenadas_lat,
        longitud: a.coordenadas_lng,
        ciudad: a.ciudad,
        estado: a.estado,
        pais: a.pais,
        codigo_postal: a.codigo_postal,
        codigo_google: a.codigo_google,
      },
    });
    setDialogOpen(true);
  };

  const toggleTipo = (clave: string) => {
    setForm((p) => ({
      ...p,
      tipos: p.tipos.includes(clave) ? p.tipos.filter((t) => t !== clave) : [...p.tipos, clave],
    }));
  };

  const handleSave = async () => {
    const dir = form.address.direccion_completa.trim();
    if (!form.empresa_id || !dir) {
      toast.error("Empresa y Dirección son obligatorios");
      return;
    }
    if (form.tipos.length === 0) {
      toast.error("Selecciona al menos un tipo");
      return;
    }
    // Keep legacy `tipo` synced with first selection (DB column is NOT NULL)
    const primaryTipo = form.tipos[0];
    const empresaName = (companies as any[]).find((c) => c.id === form.empresa_id)?.name || "";
    const calleForName = (form.address.direccion_completa || "").split(",")[0]?.trim() || "";
    const ciudadForName = form.address.ciudad || "";
    const autoNombre = [empresaName, labelByClave(primaryTipo), calleForName, ciudadForName]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(" | ");
    const nombreFinal = form.nombre.trim() || autoNombre;
    const payload: any = {
      empresa_id: form.empresa_id,
      tipo: primaryTipo,
      tipos: form.tipos,
      nombre: nombreFinal,
      calle: dir, // legacy NOT NULL column kept in sync
      direccion_completa: dir,
      ciudad: form.address.ciudad || null,
      estado: form.address.estado || null,
      pais: form.address.pais || null,
      codigo_postal: form.address.codigo_postal || null,
      referencia: form.referencia.trim() || null,
      coordenadas_lat: form.address.latitud,
      coordenadas_lng: form.address.longitud,
      codigo_google: form.address.codigo_google || null,
    };

    if (editing) {
      const { error } = await supabase.from("direcciones_empresa").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Dirección actualizada");
    } else {
      const { error } = await supabase.from("direcciones_empresa").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Dirección creada");
    }

    qc.invalidateQueries({ queryKey: ["all_addresses"] });
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-4">
      <BackButton fallback="/directory" />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Direcciones</h1>
          <p className="text-muted-foreground text-sm">Gestión de direcciones de empresas</p>
        </div>
        <div className="flex items-center gap-2">
          {hasRole("admin") && (
            <ImportExportMenu
              table="direcciones_empresa"
              entityLabel="Direcciones"
              upsertKey="codigo_google"
              fields={[
                { key: "empresa_id", label: "Empresa ID" },
                { key: "tipos", label: "Tipos" },
                { key: "calle", label: "Calle" },
                { key: "ciudad", label: "Ciudad" },
                { key: "estado", label: "Estado" },
                { key: "codigo_postal", label: "Código Postal" },
                { key: "referencia", label: "Referencia" },
                { key: "coordenadas_lat", label: "Latitud" },
                { key: "coordenadas_lng", label: "Longitud" },
                { key: "codigo_google", label: "Código Google" },
              ]}
              data={addresses as any}
              onImported={() => qc.invalidateQueries({ queryKey: ["all_addresses"] })}
            />
          )}
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Agregar Dirección
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar dirección, empresa, coordenadas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><button type="button" onClick={() => toggleSort("empresa")} className="inline-flex items-center hover:text-foreground">Empresa<SortIcon f="empresa" /></button></TableHead>
                <TableHead><button type="button" onClick={() => toggleSort("nombre")} className="inline-flex items-center hover:text-foreground">Nombre<SortIcon f="nombre" /></button></TableHead>
                <TableHead><button type="button" onClick={() => toggleSort("tipos")} className="inline-flex items-center hover:text-foreground">Tipos<SortIcon f="tipos" /></button></TableHead>
                <TableHead><button type="button" onClick={() => toggleSort("direccion")} className="inline-flex items-center hover:text-foreground">Dirección<SortIcon f="direccion" /></button></TableHead>
                <TableHead><button type="button" onClick={() => toggleSort("coordenadas")} className="inline-flex items-center hover:text-foreground">Coordenadas<SortIcon f="coordenadas" /></button></TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin direcciones</TableCell></TableRow>
              ) : (
                sorted.map((a) => {
                  const tipos = a.tipos && a.tipos.length ? a.tipos : [a.tipo];
                  const coords = a.coordenadas_lat != null && a.coordenadas_lng != null
                    ? `${Number(a.coordenadas_lat).toFixed(5)}, ${Number(a.coordenadas_lng).toFixed(5)}`
                    : "—";
                  return (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(a)}>
                      <TableCell className="font-medium">{a.companies?.name || "—"}</TableCell>
                      <TableCell className="font-medium">{a.nombre || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tipos.map((t) => (
                            <Badge key={t} variant="outline">{labelByClave(t)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{a.direccion_completa || a.calle}</span>
                          <AddressDisplay
                            address={a.direccion_completa || a.calle}
                            lat={a.coordenadas_lat}
                            lng={a.coordenadas_lng}
                            iconOnly
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{coords}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(a); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{editing ? "Editar Dirección" : "Nueva Dirección"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto px-6 py-2 flex-1">
            <div>
              <Label>Empresa *</Label>
              <SearchableSelect
                value={form.empresa_id}
                onValueChange={(v) => setForm((p) => ({ ...p, empresa_id: v }))}
                placeholder="Seleccionar empresa"
                options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div>
              <Label>Tipos * (selecciona uno o más)</Label>
              <div className="grid grid-cols-2 gap-2 mt-1 p-3 border rounded-md bg-muted/30">
                {tiposCatalog.map((t) => (
                  <label key={t.clave} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.tipos.includes(t.clave)}
                      onCheckedChange={() => toggleTipo(t.clave)}
                    />
                    <span className="text-sm">{t.etiqueta}</span>
                  </label>
                ))}
              </div>
            </div>
            <AddressAutocompleteInput
              value={form.address}
              onChange={(v) => setForm((p) => ({ ...p, address: v }))}
              label="Dirección completa"
              required
              placeholder="Buscar dirección en Google Maps..."
            />
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value, nombre_touched: true }))}
                placeholder="Se generará automáticamente: Empresa | Tipo | Calle | Ciudad"
              />
              <p className="text-xs text-muted-foreground mt-1">Identificador principal de la dirección. Editable libremente.</p>
            </div>
            {(form.address.direccion_completa || (form.address.latitud != null && form.address.longitud != null)) && (
              <AddressDisplay
                address={form.address.direccion_completa}
                lat={form.address.latitud}
                lng={form.address.longitud}
                showText={false}
                showMap
              />
            )}
            <div>
              <Label>Referencia</Label>
              <Input value={form.referencia} onChange={(e) => setForm((p) => ({ ...p, referencia: e.target.value }))} placeholder="Detalles adicionales (entre calles, color de fachada, etc.)" />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.empresa_id || !form.address.direccion_completa.trim() || form.tipos.length === 0}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
