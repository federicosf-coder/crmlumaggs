import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Merge, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Entity = "companies" | "contacts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entity: Entity;
  onMerged: () => void;
}

interface Row {
  id: string;
  label: string;
  sub: string | null;
  raw: any;
}

interface Group {
  key: string;
  reason: string;
  rows: Row[];
}

function normalize(s: string | null | undefined) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function digits(s: string | null | undefined) {
  return (s || "").toString().replace(/\D/g, "");
}

export function MergeDuplicatesDialog({ open, onOpenChange, entity, onMerged }: Props) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!open) {
      setGroups([]); setActiveGroupKey(null); setPrimaryId(null);
      setDuplicateIds(new Set()); setSearch(""); setConfirmOpen(false);
      return;
    }
    void detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entity]);

  const detect = async () => {
    setLoading(true);
    try {
      if (entity === "companies") {
        const rows = await fetchAllRows<any>((from, to) =>
          supabase.from("companies").select("id, name, razon_social, id_contpaq, email, phone, city").range(from, to)
        );
        const buckets = new Map<string, { reason: string; rows: Row[] }>();
        const push = (key: string, reason: string, r: any) => {
          if (!key) return;
          const k = `${reason}::${key}`;
          if (!buckets.has(k)) buckets.set(k, { reason, rows: [] });
          const arr = buckets.get(k)!.rows;
          if (!arr.find(x => x.id === r.id)) arr.push({
            id: r.id,
            label: r.name,
            sub: [r.razon_social, r.id_contpaq, r.email, r.city].filter(Boolean).join(" • ") || null,
            raw: r,
          });
        };
        for (const r of rows) {
          push(normalize(r.name), "Mismo nombre", r);
          push(normalize(r.razon_social), "Misma razón social", r);
          push((r.id_contpaq || "").trim().toLowerCase(), "Mismo ID Contpaq", r);
          push((r.email || "").trim().toLowerCase(), "Mismo correo", r);
        }
        const out: Group[] = [];
        for (const [k, v] of buckets) {
          if (v.rows.length >= 2) out.push({ key: k, reason: v.reason, rows: v.rows });
        }
        out.sort((a, b) => b.rows.length - a.rows.length);
        setGroups(out);
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, mobile, company_id, companies(name)");
        if (error) throw error;
        const rows = (data || []) as any[];
        const buckets = new Map<string, { reason: string; rows: Row[] }>();
        const push = (key: string, reason: string, r: any) => {
          if (!key) return;
          const k = `${reason}::${key}`;
          if (!buckets.has(k)) buckets.set(k, { reason, rows: [] });
          const arr = buckets.get(k)!.rows;
          if (!arr.find(x => x.id === r.id)) arr.push({
            id: r.id,
            label: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "(sin nombre)",
            sub: [r.email, r.mobile || r.phone, r.companies?.name].filter(Boolean).join(" • ") || null,
            raw: r,
          });
        };
        for (const r of rows) {
          push((r.email || "").trim().toLowerCase(), "Mismo correo", r);
          const fullName = normalize(`${r.first_name || ""} ${r.last_name || ""}`);
          if (fullName && r.company_id) push(`${fullName}|${r.company_id}`, "Mismo nombre en misma empresa", r);
          const dm = digits(r.mobile);
          const dp = digits(r.phone);
          if (dm.length >= 8) push(dm, "Mismo celular", r);
          if (dp.length >= 8 && dp !== dm) push(dp, "Mismo teléfono", r);
        }
        const out: Group[] = [];
        for (const [k, v] of buckets) {
          if (v.rows.length >= 2) out.push({ key: k, reason: v.reason, rows: v.rows });
        }
        out.sort((a, b) => b.rows.length - a.rows.length);
        setGroups(out);
      }
    } catch (e: any) {
      toast.error("Error detectando duplicados: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const s = search.toLowerCase();
    return groups.filter(g =>
      g.reason.toLowerCase().includes(s) ||
      g.rows.some(r => r.label.toLowerCase().includes(s) || (r.sub || "").toLowerCase().includes(s))
    );
  }, [groups, search]);

  const activeGroup = groups.find(g => g.key === activeGroupKey) || null;

  const selectGroup = (g: Group) => {
    setActiveGroupKey(g.key);
    setPrimaryId(g.rows[0]?.id || null);
    setDuplicateIds(new Set(g.rows.slice(1).map(r => r.id)));
  };

  const toggleDuplicate = (id: string) => {
    if (id === primaryId) return;
    setDuplicateIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onPickPrimary = (id: string) => {
    setPrimaryId(id);
    setDuplicateIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleMerge = async () => {
    if (!primaryId || duplicateIds.size === 0) return;
    setMerging(true);
    try {
      const fnName = entity === "companies" ? "merge_companies" : "merge_contacts";
      let ok = 0;
      for (const dupId of duplicateIds) {
        const { error } = await (supabase.rpc as any)(fnName, {
          _primary_id: primaryId,
          _duplicate_id: dupId,
        });
        if (error) throw error;
        ok++;
      }
      toast.success(`${ok} registro(s) fusionado(s) correctamente`);
      setConfirmOpen(false);
      onOpenChange(false);
      onMerged();
    } catch (e: any) {
      toast.error("Error al fusionar: " + (e.message || ""));
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Fusionar duplicados — {entity === "companies" ? "Empresas" : "Contactos"}</DialogTitle>
            <DialogDescription>
              Detecta posibles duplicados, elige el registro principal y los demás se fusionarán en él.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Buscando duplicados...</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No se encontraron posibles duplicados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[400px]">
              {/* Left: groups */}
              <div className="border rounded-md flex flex-col">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar grupos..."
                      className="pl-8 h-9"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <ScrollArea className="h-[380px]">
                  <div className="p-2 space-y-1">
                    {filteredGroups.map(g => (
                      <button
                        key={g.key}
                        onClick={() => selectGroup(g)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          activeGroupKey === g.key ? "bg-accent" : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{g.rows[0]?.label}</span>
                          <Badge variant="secondary" className="shrink-0">{g.rows.length}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{g.reason}</div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Right: detail */}
              <div className="border rounded-md flex flex-col">
                {activeGroup ? (
                  <>
                    <div className="p-3 border-b">
                      <p className="text-xs text-muted-foreground">{activeGroup.reason}</p>
                      <p className="text-sm font-medium">Elige el registro principal</p>
                    </div>
                    <ScrollArea className="h-[340px]">
                      <div className="p-3 space-y-2">
                        <RadioGroup value={primaryId || ""} onValueChange={onPickPrimary}>
                          {activeGroup.rows.map(r => (
                            <div key={r.id} className="flex items-start gap-2 p-2 rounded-md border">
                              <RadioGroupItem value={r.id} id={`p-${r.id}`} className="mt-1" />
                              <div className="flex-1 min-w-0">
                                <Label htmlFor={`p-${r.id}`} className="cursor-pointer font-medium block truncate">
                                  {r.label}
                                  {primaryId === r.id && (
                                    <Badge className="ml-2" variant="default">Principal</Badge>
                                  )}
                                </Label>
                                {r.sub && <p className="text-xs text-muted-foreground truncate">{r.sub}</p>}
                                {primaryId !== r.id && (
                                  <label className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={duplicateIds.has(r.id)}
                                      onChange={() => toggleDuplicate(r.id)}
                                    />
                                    Fusionar este al principal
                                  </label>
                                )}
                              </div>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
                    Selecciona un grupo de la izquierda
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button
              disabled={!primaryId || duplicateIds.size === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Merge className="h-4 w-4 mr-1" />
              Fusionar {duplicateIds.size > 0 ? `(${duplicateIds.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar fusión
            </DialogTitle>
            <DialogDescription>
              Esta acción reasigna todas las relaciones (documentos, pagos, oportunidades, tareas, actividades, ejecutivos)
              del/los duplicado(s) al registro principal, completa los campos vacíos del principal y luego elimina
              el/los duplicado(s). No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="text-sm">
            <p><span className="text-muted-foreground">Principal:</span>{" "}
              <strong>{activeGroup?.rows.find(r => r.id === primaryId)?.label}</strong>
            </p>
            <p className="mt-2 text-muted-foreground">A fusionar ({duplicateIds.size}):</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {Array.from(duplicateIds).map(id => {
                const r = activeGroup?.rows.find(x => x.id === id);
                return <li key={id}>• {r?.label}</li>;
              })}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={merging}>Cancelar</Button>
            <Button variant="destructive" onClick={handleMerge} disabled={merging}>
              {merging ? "Fusionando..." : "Confirmar y fusionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}