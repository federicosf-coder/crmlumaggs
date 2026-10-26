import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { normalizeAudienceFilters, type AudienceFilters } from "@/lib/whatsappAudience";

type Audience = { id: string; name: string; description: string | null; filters_json: unknown; created_at: string };
const db = supabase as any;

async function countFor(f: AudienceFilters): Promise<number> {
  const { data, error } = await db.rpc("count_audience_contacts", { filters: f });
  if (error) throw error;
  return data ?? 0;
}

export default function WhatsAppAudiences() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth() as any;
  const [editing, setEditing] = useState<Partial<Audience> | null>(null);

  const { data: plazas = [] } = useQuery({
    queryKey: ["plazas-activas"],
    queryFn: async () => (await supabase.from("plazas").select("id,nombre").eq("is_active", true).order("nombre")).data ?? [],
  });
  const { data: giros = [] } = useQuery({
    queryKey: ["intereses-giro"],
    queryFn: async () => (await db.from("intereses_giro").select("id,nombre").eq("is_active", true).order("nombre")).data ?? [],
  });
  const { data: audiences = [], isLoading } = useQuery({
    queryKey: ["whatsapp_audiences"],
    queryFn: async (): Promise<(Audience & { count: number })[]> => {
      const { data, error } = await db.from("whatsapp_audiences").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return Promise.all((data ?? []).map(async (a: Audience) => ({ ...a, count: await countFor(normalizeAudienceFilters(a.filters_json)) })));
    },
  });

  const plazaName = (id: string | null) => (id ? plazas.find((p: any) => p.id === id)?.nombre ?? "—" : "Todas");
  const giroNames = (ids: string[]) => ids.map((i) => giros.find((g: any) => g.id === i)?.nombre).filter(Boolean) as string[];

  const remove = async (a: Audience) => {
    if (!confirm(`¿Eliminar la audiencia «${a.name}»?`)) return;
    const { error } = await db.from("whatsapp_audiences").delete().eq("id", a.id);
    if (error) return toast({ title: "No se pudo eliminar", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["whatsapp_audiences"] });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="h-6 w-6" /> Audiencias</h1>
          <p className="text-sm text-muted-foreground font-light">Grupos de contactos por plaza y giro para tus campañas de WhatsApp.</p>
        </div>
        <Button onClick={() => setEditing({ name: "", description: "", filters_json: normalizeAudienceFilters({}) })}>
          <Plus className="h-4 w-4" /> Nueva audiencia
        </Button>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gradient-to-r from-violet-50 to-blue-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="divide-x">
              <th className="p-2 text-left">Nombre</th><th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-left">Plaza</th><th className="p-2 text-left">Giros</th>
              <th className="p-2 text-right">Contactos</th><th className="p-2 text-left">Creada</th><th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Cargando…</td></tr>}
            {!isLoading && audiences.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Aún no hay audiencias guardadas.</td></tr>}
            {audiences.map((a, i) => {
              const f = normalizeAudienceFilters(a.filters_json);
              return (
                <tr key={a.id} className={`divide-x ${i % 2 ? "bg-muted/30" : ""}`}>
                  <td className="p-2 font-medium">{a.name}</td>
                  <td className="p-2 font-light">{a.description || "—"}</td>
                  <td className="p-2">{plazaName(f.plaza_id)}</td>
                  <td className="p-2"><div className="flex flex-wrap gap-1">{giroNames(f.giro_ids).length ? giroNames(f.giro_ids).map((g) => <Badge key={g} variant="secondary">{g}</Badge>) : "Todos"}</div></td>
                  <td className="p-2 text-right font-semibold">{a.count.toLocaleString("es-MX")}</td>
                  <td className="p-2">{new Date(a.created_at).toLocaleDateString("es-MX")}</td>
                  <td className="p-2 whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <AudienceDialog
          initial={editing} plazas={plazas as any[]} giros={giros as any[]} userId={user?.id ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["whatsapp_audiences"] }); }}
        />
      )}
    </div>
  );
}

function AudienceDialog({ initial, plazas, giros, userId, onClose, onSaved }: {
  initial: Partial<Audience>; plazas: any[]; giros: any[]; userId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial.name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [filters, setFilters] = useState<AudienceFilters>(normalizeAudienceFilters(initial.filters_json));
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let active = true; setCount(null);
    const t = setTimeout(() => countFor(filters).then((n) => active && setCount(n)).catch(() => active && setCount(0)), 300);
    return () => { active = false; clearTimeout(t); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!name.trim()) return toast({ title: "Escribe un nombre", variant: "destructive" });
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, filters_json: filters, updated_at: new Date().toISOString() };
    const { error } = initial.id
      ? await db.from("whatsapp_audiences").update(payload).eq("id", initial.id)
      : await db.from("whatsapp_audiences").insert({ ...payload, created_by: userId });
    setSaving(false);
    if (error) return toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
    toast({ title: "Audiencia guardada" });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
          <DialogTitle>{initial.id ? "Editar audiencia" : "Nueva audiencia"}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto font-light">
          <div className="space-y-1"><Label className="text-xs uppercase tracking-wide">Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs uppercase tracking-wide">Descripción</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Plaza</Label>
            <Select value={filters.plaza_id ?? "all"} onValueChange={(v) => setFilters({ ...filters, plaza_id: v === "all" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plazas</SelectItem>
                {plazas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Giros (al menos uno)</Label>
            <div className="grid grid-cols-2 gap-1">
              {giros.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={filters.giro_ids.includes(g.id)} onCheckedChange={(c) => setFilters({ ...filters, giro_ids: c ? [...filters.giro_ids, g.id] : filters.giro_ids.filter((x) => x !== g.id) })} />
                  {g.nombre}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={filters.exclude_blocked} onCheckedChange={(c) => setFilters({ ...filters, exclude_blocked: !!c })} />
            Excluir números bloqueados
          </label>
        </div>
        <div className="px-6 py-3 border-t bg-muted/40 flex items-center justify-between">
          <span className="text-sm">Coinciden: <b>{count === null ? "…" : count.toLocaleString("es-MX")}</b> contactos</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
