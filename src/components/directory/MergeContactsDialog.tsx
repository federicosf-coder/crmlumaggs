import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2, Search } from "lucide-react";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import { toast } from "sonner";

interface ContactRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email2?: string | null;
  mobile: string | null;
  tel_emp?: string | null;
  whatsapp_phone?: string | null;
  company_id: string | null;
  companies?: { name: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: () => void;
}

export function MergeContactsDialog({ open, onOpenChange, onMerged }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [principalId, setPrincipalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, { contact: ContactRow; dealsCount: number }>>({});
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch(""); setDebounced(""); setResults([]); setSelected(new Set());
      setPrincipalId(null); setExpandedId(null); setDetailsCache({});
    }
  }, [open]);

  useEffect(() => {
    if (!open || debounced.length < 2) { setResults([]); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const term = `%${debounced}%`;
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, mobile, company_id, companies(name)")
        .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},mobile.ilike.${term},whatsapp_phone.ilike.${term}`)
        .limit(20);
      if (!cancel) {
        if (error) toast.error("Error: " + error.message);
        setResults((data as any) || []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [debounced, open]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (principalId === id) setPrincipalId(null); }
      else next.add(id);
      return next;
    });
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!detailsCache[id]) {
      const [{ data: c }, { count }] = await Promise.all([
        supabase.from("contacts").select("id, first_name, last_name, email, email2, mobile, tel_emp, whatsapp_phone, company_id, companies(name)").eq("id", id).maybeSingle(),
        supabase.from("crm_deals").select("id", { count: "exact", head: true }).eq("contact_id", id),
      ]);
      if (c) setDetailsCache(prev => ({ ...prev, [id]: { contact: c as any, dealsCount: count || 0 } }));
    }
  };

  const nameOf = (c: ContactRow) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "(sin nombre)";
  const principalContact = useMemo(() => results.find(r => r.id === principalId) || null, [results, principalId]);
  const duplicates = useMemo(() => results.filter(r => selected.has(r.id) && r.id !== principalId), [results, selected, principalId]);
  const canMerge = selected.size >= 2 && !!principalId && selected.has(principalId);

  const handleMerge = async () => {
    if (!principalId || duplicates.length === 0) return;
    const ids = duplicates.map(d => d.id);
    setMerging(true);
    try {
      const upd = async (table: any) => {
        const { error } = await (supabase.from(table) as any).update({ contact_id: principalId }).in("contact_id", ids);
        if (error) throw error;
      };
      await upd("crm_deals");
      await upd("whatsapp_conversations");
      await upd("whatsapp_messages");
      await upd("whatsapp_campaign_recipients");

      const { data: ejecRows } = await (supabase.from("contact_ejecutivos") as any)
        .select("user_id").in("contact_id", ids);
      const uniqueUsers = Array.from(new Set((ejecRows || []).map((r: any) => r.user_id)));
      if (uniqueUsers.length > 0) {
        const rows = uniqueUsers.map(uid => ({ contact_id: principalId, user_id: uid }));
        await (supabase.from("contact_ejecutivos") as any).upsert(rows, { onConflict: "contact_id,user_id", ignoreDuplicates: true });
      }
      await (supabase.from("contact_ejecutivos") as any).delete().in("contact_id", ids);

      const { error: delErr } = await supabase.from("contacts").delete().in("id", ids);
      if (delErr) throw delErr;

      toast.success(`Fusión completada: ${ids.length} contacto(s) eliminado(s)`);
      onOpenChange(false);
      onMerged?.();
    } catch (err: any) {
      toast.error("Error al fusionar: " + (err.message || "Error"));
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">Fusionar contactos duplicados</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5 overflow-y-auto flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar por nombre, email, móvil o WhatsApp..."
              className="pl-9 h-9 font-light"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
            {loading && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</div>}
            {!loading && debounced.length < 2 && <div className="p-4 text-xs text-muted-foreground">Escribe al menos 2 caracteres para buscar.</div>}
            {!loading && debounced.length >= 2 && results.length === 0 && <div className="p-4 text-xs text-muted-foreground">Sin resultados.</div>}
            {results.map(c => {
              const isSelected = selected.has(c.id);
              const isPrincipal = principalId === c.id;
              const isExpanded = expandedId === c.id;
              const det = detailsCache[c.id];
              return (
                <div key={c.id} className="p-3 hover:bg-muted/30">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(c.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{nameOf(c)}</span>
                        {isPrincipal && <Badge variant="secondary" className="text-[10px]">Principal</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.companies?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.email || "—"} · {c.mobile || "—"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="principal"
                          checked={isPrincipal}
                          disabled={!isSelected}
                          onChange={() => setPrincipalId(c.id)}
                        />
                        Principal
                      </label>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleExpand(c.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 ml-7 rounded-md bg-muted/40 p-3 text-xs space-y-1 font-light">
                      {det ? (
                        <>
                          <div><span className="uppercase tracking-wide text-muted-foreground">Nombre:</span> {nameOf(det.contact)}</div>
                          <div><span className="uppercase tracking-wide text-muted-foreground">Empresa:</span> {det.contact.companies?.name || "—"}</div>
                          <div><span className="uppercase tracking-wide text-muted-foreground">Email:</span> {det.contact.email || "—"}</div>
                          <div><span className="uppercase tracking-wide text-muted-foreground">Email 2:</span> {det.contact.email2 || "—"}</div>
                          <div><span className="uppercase tracking-wide text-muted-foreground">Móvil:</span> {det.contact.mobile || "—"}</div>
                          <div><span className="uppercase tracking-wide text-muted-foreground">Tel. empresa:</span> {det.contact.tel_emp || "—"}</div>
                          <div><span className="uppercase tracking-wide text-muted-foreground">WhatsApp:</span> {det.contact.whatsapp_phone || "—"}</div>
                          <div><span className="uppercase tracking-wide text-muted-foreground">Deals relacionados:</span> {det.dealsCount}</div>
                        </>
                      ) : (
                        <div className="text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Cargando...</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selected.size >= 2 && principalContact && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Principal:</span> <span className="font-medium">{nameOf(principalContact)}</span></div>
              <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Se eliminarán:</span> <span className="font-light">{duplicates.map(nameOf).join(", ") || "—"}</span></div>
            </div>
          )}
          {selected.size >= 2 && !principalId && (
            <div className="text-xs text-amber-700 dark:text-amber-300">Marca uno de los seleccionados como Principal para habilitar la fusión.</div>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-5 py-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>Cancelar</Button>
          <Button onClick={handleMerge} disabled={!canMerge || merging}>
            {merging ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fusionando...</>) : "Fusionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}