import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Lead } from "@/hooks/useLeads";

interface Props {
  lead: Lead;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function splitNombre(nombre: string | null) {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { first: partes[0] ?? "", last: "" };
  return { first: partes[0], last: partes.slice(1).join(" ") };
}

export function VincularLeadDialog({ lead, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const inicial = useMemo(() => splitNombre(lead.nombre), [lead.nombre]);

  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [crearContacto, setCrearContacto] = useState(true);
  const [firstName, setFirstName] = useState(inicial.first);
  const [lastName, setLastName] = useState(inicial.last);
  const [telefono, setTelefono] = useState(lead.telefono ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [saving, setSaving] = useState(false);

  const [nuevaEmpresa, setNuevaEmpresa] = useState(lead.empresa_nombre || lead.nombre || "");
  const [nuevoTel, setNuevoTel] = useState(lead.telefono ?? "");
  const [nuevoEmail, setNuevoEmail] = useState(lead.email ?? "");

  useEffect(() => {
    if (!open) return;
    setCompanyId("");
    setCrearContacto(true);
    setFirstName(inicial.first);
    setLastName(inicial.last);
    setTelefono(lead.telefono ?? "");
    setEmail(lead.email ?? "");
    setNuevaEmpresa(lead.empresa_nombre || lead.nombre || "");
    setNuevoTel(lead.telefono ?? "");
    setNuevoEmail(lead.email ?? "");
  }, [open, lead, inicial]);

  // Carga inicial + búsqueda de empresas
  const [busqueda, setBusqueda] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      let q = (supabase as any).from("companies").select("id, name").order("name").limit(20);
      if (busqueda.trim()) q = q.ilike("name", `%${busqueda.trim()}%`);
      const { data } = await q;
      if (!cancel) setCompanies((data ?? []) as { id: string; name: string }[]);
    })();
    return () => { cancel = true; };
  }, [open, busqueda]);

  const opciones = companies.map((c) => ({ value: c.id, label: c.name }));

  async function insertarContacto(cid: string) {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from("contacts")
      .insert({
        first_name: firstName || lead.nombre,
        last_name: lastName || null,
        phone: telefono || null,
        email: email || null,
        company_id: cid,
        created_by: userData.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async function finalizar(cid: string, contactId: string | null) {
    const { error } = await (supabase as any)
      .from("leads")
      .update({ company_id: cid, contact_id: contactId })
      .eq("id", lead.id);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["leads"] });
    toast.success("Prospecto vinculado correctamente");
    onOpenChange(false);
  }

  async function vincularExistente() {
    if (!companyId) return;
    setSaving(true);
    try {
      const contactId = crearContacto ? await insertarContacto(companyId) : null;
      await finalizar(companyId, contactId);
    } catch (e: any) {
      toast.error(e.message ?? "Error al vincular");
    } finally {
      setSaving(false);
    }
  }

  async function crearYVincular() {
    if (!nuevaEmpresa.trim()) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("companies")
        .insert({
          name: nuevaEmpresa.trim(),
          phone: nuevoTel || null,
          email: nuevoEmail || null,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const cid = data.id as string;
      const contactId = await insertarContacto(cid);
      await finalizar(cid, contactId);
    } catch (e: any) {
      toast.error(e.message ?? "Error al crear la empresa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 -m-6 mb-2 p-6 rounded-t-lg">
          <DialogTitle className="font-light">Vincular o convertir prospecto</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="existente">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existente">Empresa existente</TabsTrigger>
            <TabsTrigger value="nueva">Empresa nueva</TabsTrigger>
          </TabsList>

          <TabsContent value="existente" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</Label>
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar empresa por nombre..."
              />
              <SearchableSelect
                value={companyId}
                onValueChange={setCompanyId}
                options={opciones}
                placeholder="Seleccionar empresa..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="crear-contacto" checked={crearContacto} onCheckedChange={(v) => setCrearContacto(!!v)} />
              <Label htmlFor="crear-contacto" className="text-sm font-light">Crear contacto con estos datos</Label>
            </div>

            {crearContacto && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Apellido</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono</Label>
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            )}

            <DialogFooter className="bg-muted/40 -mx-6 -mb-6 px-6 py-4 mt-4">
              <Button onClick={vincularExistente} disabled={!companyId || saving}>
                Vincular a esta empresa
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="nueva" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nombre de la empresa</Label>
              <Input value={nuevaEmpresa} onChange={(e) => setNuevaEmpresa(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Teléfono</Label>
              <Input value={nuevoTel} onChange={(e) => setNuevoTel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
              <Input value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} />
            </div>

            <DialogFooter className="bg-muted/40 -mx-6 -mb-6 px-6 py-4 mt-4">
              <Button onClick={crearYVincular} disabled={!nuevaEmpresa.trim() || saving}>
                Crear empresa y vincular
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
