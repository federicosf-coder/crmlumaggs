import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AddressAutocompleteInput, emptyAddress, type AddressValue } from "@/components/AddressAutocompleteInput";
import { AddressDisplay } from "@/components/AddressDisplay";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TipoCatalogItem { clave: string; etiqueta: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  empresaName?: string;
  editing?: any | null;
  onSaved?: () => void;
}

export function CompanyAddressDialog({ open, onOpenChange, empresaId, empresaName, editing, onSaved }: Props) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [mode, setMode] = useState<"form" | "link">("form");
  const [linkAddressId, setLinkAddressId] = useState("");

  const [form, setForm] = useState<{
    tipos: string[]; nombre: string; nombre_touched: boolean; referencia: string; address: AddressValue;
  }>({
    tipos: ["envio"], nombre: "", nombre_touched: false, referencia: "", address: { ...emptyAddress },
  });

  const { data: tiposCatalog = [] } = useQuery({
    queryKey: ["tipos_direccion_catalog_inline"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("tipos_direccion")
        .select("clave, etiqueta").eq("is_active", true).order("etiqueta");
      return (data || []) as TipoCatalogItem[];
    },
    enabled: open,
  });
  const labelByClave = (c: string) => tiposCatalog.find(t => t.clave === c)?.etiqueta || c;

  // Direcciones de OTRAS empresas para vincular
  const { data: linkable = [] } = useQuery({
    queryKey: ["linkable_addresses", empresaId, open],
    queryFn: async () => {
      const { data } = await supabase
        .from("direcciones_empresa")
        .select("id, nombre, direccion_completa, calle, ciudad, empresa_id, companies(name)")
        .eq("is_active", true)
        .neq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(2000);
      return data || [];
    },
    enabled: open && !isEdit,
  });

  useEffect(() => {
    if (!open) return;
    setMode("form");
    setLinkAddressId("");
    if (editing) {
      const tipos = editing.tipos && editing.tipos.length > 0 ? editing.tipos : (editing.tipo ? [editing.tipo] : []);
      setForm({
        tipos,
        nombre: editing.nombre || "",
        nombre_touched: !!(editing.nombre && editing.nombre.trim()),
        referencia: editing.referencia || "",
        address: {
          direccion_completa: editing.direccion_completa || editing.calle || "",
          latitud: editing.coordenadas_lat,
          longitud: editing.coordenadas_lng,
          ciudad: editing.ciudad,
          estado: editing.estado,
          pais: editing.pais,
          codigo_postal: editing.codigo_postal,
          codigo_google: editing.codigo_google,
        },
      });
    } else {
      setForm({ tipos: ["envio"], nombre: "", nombre_touched: false, referencia: "", address: { ...emptyAddress } });
    }
  }, [open, editing]);

  const toggleTipo = (c: string) =>
    setForm(p => ({ ...p, tipos: p.tipos.includes(c) ? p.tipos.filter(t => t !== c) : [...p.tipos, c] }));

  const handleSave = async () => {
    const dir = form.address.direccion_completa.trim();
    if (!dir) { toast.error("La dirección es obligatoria"); return; }
    if (form.tipos.length === 0) { toast.error("Selecciona al menos un tipo"); return; }
    const primaryTipo = form.tipos[0];
    const calleForName = (form.address.direccion_completa || "").split(",")[0]?.trim() || "";
    const autoNombre = [empresaName, labelByClave(primaryTipo), calleForName, form.address.ciudad || ""]
      .map(s => (s || "").trim()).filter(Boolean).join(" | ");
    const payload: any = {
      empresa_id: empresaId,
      tipo: primaryTipo,
      tipos: form.tipos,
      nombre: form.nombre.trim() || autoNombre,
      calle: dir,
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
    if (isEdit) {
      const { error } = await supabase.from("direcciones_empresa").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Dirección actualizada");
    } else {
      const { error } = await supabase.from("direcciones_empresa").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Dirección creada");
    }
    qc.invalidateQueries({ queryKey: ["company_addresses_form"] });
    qc.invalidateQueries({ queryKey: ["all_addresses"] });
    onSaved?.();
    onOpenChange(false);
  };

  const handleLink = async () => {
    if (!linkAddressId) { toast.error("Selecciona una dirección"); return; }
    const { error } = await supabase
      .from("direcciones_empresa")
      .update({ empresa_id: empresaId })
      .eq("id", linkAddressId);
    if (error) { toast.error(error.message); return; }
    toast.success("Dirección vinculada");
    qc.invalidateQueries({ queryKey: ["company_addresses_form"] });
    qc.invalidateQueries({ queryKey: ["all_addresses"] });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{isEdit ? "Editar Dirección" : "Nueva Dirección"}</DialogTitle>
        </DialogHeader>

        {!isEdit && (
          <div className="px-6 pt-1 pb-2 shrink-0 flex gap-2">
            <Button type="button" size="sm" variant={mode === "form" ? "default" : "outline"} onClick={() => setMode("form")}>
              Crear nueva
            </Button>
            <Button type="button" size="sm" variant={mode === "link" ? "default" : "outline"} onClick={() => setMode("link")}>
              Vincular existente
            </Button>
          </div>
        )}

        <div className="space-y-3 overflow-y-auto px-6 py-2 flex-1">
          {mode === "link" && !isEdit ? (
            <div className="space-y-2">
              <Label>Dirección existente</Label>
              <SearchableSelect
                value={linkAddressId}
                onValueChange={setLinkAddressId}
                placeholder="Buscar dirección registrada en otra empresa..."
                options={(linkable as any[]).map(a => ({
                  value: a.id,
                  label: `${a.nombre || a.direccion_completa || a.calle} — ${a.companies?.name || "Sin empresa"}`,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Al vincular, la dirección se reasigna a esta empresa.
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label>Tipos * (uno o más)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1 p-3 border rounded-md bg-muted/30">
                  {tiposCatalog.map(t => (
                    <label key={t.clave} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={form.tipos.includes(t.clave)} onCheckedChange={() => toggleTipo(t.clave)} />
                      <span className="text-sm">{t.etiqueta}</span>
                    </label>
                  ))}
                </div>
              </div>
              <AddressAutocompleteInput
                value={form.address}
                onChange={v => setForm(p => ({ ...p, address: v }))}
                label="Dirección completa"
                required
                placeholder="Buscar dirección en Google Maps..."
              />
              <div>
                <Label>Nombre</Label>
                <Input
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value, nombre_touched: true }))}
                  placeholder="Se generará automáticamente: Empresa | Tipo | Calle | Ciudad"
                />
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
                <Input value={form.referencia} onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))} placeholder="Detalles adicionales" />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {mode === "link" && !isEdit ? (
            <Button onClick={handleLink} disabled={!linkAddressId}>Vincular</Button>
          ) : (
            <Button onClick={handleSave} disabled={!form.address.direccion_completa.trim() || form.tipos.length === 0}>
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}