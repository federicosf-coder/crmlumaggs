import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";
import { Plus, Search, Pencil, MapPin } from "lucide-react";

const TIPO_LABELS: Record<string, string> = {
  envio: "Entrega",
  fiscal: "Fiscal",
  comercial: "Comercial",
  sucursal: "Sucursal",
  principal: "Principal",
};

const TIPO_OPTIONS = [
  { value: "envio", label: "Entrega" },
  { value: "fiscal", label: "Fiscal" },
  { value: "comercial", label: "Comercial" },
  { value: "sucursal", label: "Sucursal" },
  { value: "principal", label: "Principal" },
];

interface Address {
  id: string;
  empresa_id: string;
  tipo: string;
  calle: string;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
  referencia: string | null;
  coordenadas_lat: number | null;
  coordenadas_lng: number | null;
  codigo_google: string | null;
  is_active: boolean;
  companies?: { name: string } | null;
}

export default function DeliveryAddresses() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const [form, setForm] = useState({
    empresa_id: "", tipo: "envio", calle: "", ciudad: "", estado: "",
    codigo_postal: "", referencia: "", coordenadas_lat: "", coordenadas_lng: "", codigo_google: "",
  });

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["all_addresses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("direcciones_empresa")
        .select("*, companies(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data || []) as Address[];
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
    return (
      a.calle.toLowerCase().includes(q) ||
      (a.ciudad || "").toLowerCase().includes(q) ||
      (a.estado || "").toLowerCase().includes(q) ||
      (a.companies?.name || "").toLowerCase().includes(q) ||
      (a.codigo_google || "").toLowerCase().includes(q)
    );
  });

  const resetForm = () => {
    setForm({ empresa_id: "", tipo: "envio", calle: "", ciudad: "", estado: "", codigo_postal: "", referencia: "", coordenadas_lat: "", coordenadas_lng: "", codigo_google: "" });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (a: Address) => {
    setEditing(a);
    setForm({
      empresa_id: a.empresa_id,
      tipo: a.tipo,
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

  const handleSave = async () => {
    if (!form.empresa_id || !form.calle.trim()) {
      toast.error("Empresa y Dirección son obligatorios");
      return;
    }
    const payload: any = {
      empresa_id: form.empresa_id,
      tipo: form.tipo as any,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Direcciones</h1>
          <p className="text-muted-foreground text-sm">Gestión de direcciones de empresas</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Agregar Dirección
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar dirección, empresa, código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>C.P.</TableHead>
                <TableHead>Código Google</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin direcciones</TableCell></TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(a)}>
                    <TableCell className="font-medium">{a.companies?.name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{TIPO_LABELS[a.tipo] || a.tipo}</Badge></TableCell>
                    <TableCell>{a.calle}</TableCell>
                    <TableCell>{a.ciudad || "—"}</TableCell>
                    <TableCell>{a.estado || "—"}</TableCell>
                    <TableCell>{a.codigo_postal || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.codigo_google || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(a); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button onClick={handleSave} disabled={!form.empresa_id || !form.calle.trim()}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
