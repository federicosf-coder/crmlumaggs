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
import { Plus, Search, Pencil } from "lucide-react";
import { AddressAutocompleteInput, emptyAddress, type AddressValue } from "@/components/AddressAutocompleteInput";

interface TipoCatalogItem {
  id: string;
  clave: string;
  etiqueta: string;
  is_active: boolean;
}

interface Address {
  id: string;
  empresa_id: string;
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

  const [form, setForm] = useState<{
    empresa_id: string;
    tipos: string[];
    referencia: string;
    address: AddressValue;
  }>({
    empresa_id: "",
    tipos: ["envio"],
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
      (a.ciudad || "").toLowerCase().includes(q) ||
      (a.estado || "").toLowerCase().includes(q) ||
      (a.companies?.name || "").toLowerCase().includes(q) ||
      tipos.includes(q) ||
      coord.includes(q)
    );
  });

  const resetForm = () => {
    setForm({ empresa_id: "", tipos: ["envio"], calle: "", ciudad: "", estado: "", codigo_postal: "", referencia: "", coordenadas_lat: "", coordenadas_lng: "", codigo_google: "" });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (a: Address) => {
    setEditing(a);
    const tipos = a.tipos && a.tipos.length > 0 ? a.tipos : (a.tipo ? [a.tipo] : []);
    setForm({
      empresa_id: a.empresa_id,
      tipos,
      calle: a.calle,
      ciudad: a.ciudad || "",
      estado: a.estado || "",
      codigo_postal: a.codigo_postal || "",
      referencia: a.referencia || "",
      coordenadas_lat: a.coordenadas_lat != null ? String(a.coordenadas_lat) : "",
      coordenadas_lng: a.coordenadas_lng != null ? String(a.coordenadas_lng) : "",
      codigo_google: a.codigo_google || "",
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
    if (!form.empresa_id || !form.calle.trim()) {
      toast.error("Empresa y Dirección son obligatorios");
      return;
    }
    if (form.tipos.length === 0) {
      toast.error("Selecciona al menos un tipo");
      return;
    }
    // Keep legacy `tipo` synced with first selection (DB column is NOT NULL)
    const primaryTipo = form.tipos[0];
    const payload: any = {
      empresa_id: form.empresa_id,
      tipo: primaryTipo,
      tipos: form.tipos,
      calle: form.calle.trim(),
      ciudad: form.ciudad.trim() || null,
      estado: form.estado.trim() || null,
      codigo_postal: form.codigo_postal.trim() || null,
      referencia: form.referencia.trim() || null,
      coordenadas_lat: form.coordenadas_lat ? Number(form.coordenadas_lat) : null,
      coordenadas_lng: form.coordenadas_lng ? Number(form.coordenadas_lng) : null,
      codigo_google: form.codigo_google.trim() || null,
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
                <TableHead>Empresa</TableHead>
                <TableHead>Tipos</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>C.P.</TableHead>
                <TableHead>Coordenadas</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin direcciones</TableCell></TableRow>
              ) : (
                filtered.map((a) => {
                  const tipos = a.tipos && a.tipos.length ? a.tipos : [a.tipo];
                  const coords = a.coordenadas_lat != null && a.coordenadas_lng != null
                    ? `${Number(a.coordenadas_lat).toFixed(5)}, ${Number(a.coordenadas_lng).toFixed(5)}`
                    : "—";
                  return (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(a)}>
                      <TableCell className="font-medium">{a.companies?.name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tipos.map((t) => (
                            <Badge key={t} variant="outline">{labelByClave(t)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{a.calle}</TableCell>
                      <TableCell>{a.ciudad || "—"}</TableCell>
                      <TableCell>{a.estado || "—"}</TableCell>
                      <TableCell>{a.codigo_postal || "—"}</TableCell>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Dirección" : "Nueva Dirección"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
            <div>
              <Label>Calle / Dirección *</Label>
              <Input value={form.calle} onChange={(e) => setForm((p) => ({ ...p, calle: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Ciudad</Label><Input value={form.ciudad} onChange={(e) => setForm((p) => ({ ...p, ciudad: e.target.value }))} /></div>
              <div><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Código Postal</Label><Input value={form.codigo_postal} onChange={(e) => setForm((p) => ({ ...p, codigo_postal: e.target.value }))} /></div>
              <div><Label>Código Google</Label><Input value={form.codigo_google} onChange={(e) => setForm((p) => ({ ...p, codigo_google: e.target.value }))} placeholder="Ej: ChIJ..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitud</Label><Input type="number" step="any" value={form.coordenadas_lat} onChange={(e) => setForm((p) => ({ ...p, coordenadas_lat: e.target.value }))} placeholder="Ej: 25.6866" /></div>
              <div><Label>Longitud</Label><Input type="number" step="any" value={form.coordenadas_lng} onChange={(e) => setForm((p) => ({ ...p, coordenadas_lng: e.target.value }))} placeholder="Ej: -100.3161" /></div>
            </div>
            <div>
              <Label>Referencia</Label>
              <Input value={form.referencia} onChange={(e) => setForm((p) => ({ ...p, referencia: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.empresa_id || !form.calle.trim() || form.tipos.length === 0}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
