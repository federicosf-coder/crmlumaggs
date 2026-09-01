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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchAllRows } from "@/lib/supabasePagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Entity = "companies" | "contacts" | "addresses" | "productos";

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
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [duplicateIds, setDuplicateIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [freeSearch, setFreeSearch] = useState("");
  const [freeSelected, setFreeSelected] = useState<Set<string>>(new Set());
  const [customGroup, setCustomGroup] = useState<Group | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!open) {
      setGroups([]); setAllRows([]); setActiveGroupKey(null); setPrimaryId(null);
      setDuplicateIds(new Set()); setSearch(""); setConfirmOpen(false);
      setFreeSearch(""); setFreeSelected(new Set()); setCustomGroup(null);
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
          supabase.from("companies").select("id, name, razon_social, id_contpaq, email, phone, city, creado_automaticamente").range(from, to)
        );
        const all: Row[] = rows.map((r: any) => ({
          id: r.id,
          label: r.name,
          sub: [r.razon_social, r.id_contpaq, r.email, r.city].filter(Boolean).join(" • ") || null,
          raw: r,
        }));
        setAllRows(all);
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
      } else if (entity === "contacts") {
        const rows = await fetchAllRows<any>((from, to) =>
          supabase.from("contacts").select("id, first_name, last_name, email, phone, mobile, company_id, companies(name)").range(from, to)
        );
        const all: Row[] = rows.map((r: any) => ({
          id: r.id,
          label: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "(sin nombre)",
          sub: [r.email, r.mobile || r.phone, r.companies?.name].filter(Boolean).join(" • ") || null,
          raw: r,
        }));
        setAllRows(all);
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
      } else if (entity === "productos") {
        const rows = await fetchAllRows<any>((from, to) =>
          supabase.from("productos").select("id, codigo, nombre_producto, descripcion, is_active, creado_automaticamente").eq("is_active", true).range(from, to)
        );
        const all: Row[] = rows.map((r: any) => ({
          id: r.id,
          label: r.nombre_producto,
          sub: [r.codigo, r.descripcion].filter(Boolean).join(" • ") || null,
          raw: r,
        }));
        setAllRows(all);
        const buckets = new Map<string, { reason: string; rows: Row[] }>();
        const push = (key: string, reason: string, r: any) => {
          if (!key) return;
          const k = `${reason}::${key}`;
          if (!buckets.has(k)) buckets.set(k, { reason, rows: [] });
          const arr = buckets.get(k)!.rows;
          if (!arr.find(x => x.id === r.id)) arr.push({
            id: r.id,
            label: r.nombre_producto,
            sub: [r.codigo, r.descripcion].filter(Boolean).join(" • ") || null,
            raw: r,
          });
        };
        for (const r of rows) {
          push(normalize(r.nombre_producto), "Mismo nombre de producto", r);
        }
        const out: Group[] = [];
        for (const [k, v] of buckets) {
          if (v.rows.length >= 2) out.push({ key: k, reason: v.reason, rows: v.rows });
        }
        out.sort((a, b) => b.rows.length - a.rows.length);
        setGroups(out);
      } else {
        // addresses
        const rows = await fetchAllRows<any>((from, to) =>
          supabase
            .from("direcciones_empresa")
            .select("id, nombre, empresa_id, direccion_completa, calle, ciudad, codigo_google, coordenadas_lat, coordenadas_lng, is_active, companies(name)")
            .eq("is_active", true)
            .range(from, to)
        );
        const all: Row[] = rows.map((r: any) => ({
          id: r.id,
          label: r.nombre || r.direccion_completa || r.calle || "(sin nombre)",
          sub: [r.companies?.name, r.direccion_completa || r.calle, r.ciudad].filter(Boolean).join(" • ") || null,
          raw: r,
        }));
        setAllRows(all);
        const buckets = new Map<string, { reason: string; rows: Row[] }>();
        const push = (key: string, reason: string, r: any) => {
          if (!key) return;
          const k = `${reason}::${key}`;
          if (!buckets.has(k)) buckets.set(k, { reason, rows: [] });
          const arr = buckets.get(k)!.rows;
          if (!arr.find(x => x.id === r.id)) arr.push({
            id: r.id,
            label: r.nombre || r.direccion_completa || r.calle || "(sin nombre)",
            sub: [r.companies?.name, r.direccion_completa || r.calle, r.ciudad].filter(Boolean).join(" • ") || null,
            raw: r,
          });
        };
        for (const r of rows) {
          if (r.empresa_id) {
            push(`${r.empresa_id}|${normalize(r.direccion_completa || r.calle)}`, "Misma empresa y dirección", r);
          }
          if (r.codigo_google) push((r.codigo_google || "").trim().toLowerCase(), "Mismo Place ID", r);
          if (r.coordenadas_lat != null && r.coordenadas_lng != null && r.empresa_id) {
            const key = `${r.empresa_id}|${Number(r.coordenadas_lat).toFixed(5)},${Number(r.coordenadas_lng).toFixed(5)}`;
            push(key, "Mismas coordenadas en misma empresa", r);
          }
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
  const effectiveGroup = activeGroup || customGroup;

  const freeResults = useMemo(() => {
    const q = freeSearch.trim().toLowerCase();
    if (!q) return [];
    return allRows
      .filter(r => r.label.toLowerCase().includes(q) || (r.sub || "").toLowerCase().includes(q))
      .slice(0, 200);
  }, [allRows, freeSearch]);

  const toggleFreeSelected = (id: string) => {
    setFreeSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      // Construir grupo personalizado automáticamente al seleccionar
      const selectedIds = Array.from(next);
      const selected = allRows.filter(r => next.has(r.id));
      if (selected.length >= 2) {
        setCustomGroup({ key: "__custom__", reason: "Selección manual", rows: selected });
        setActiveGroupKey(null);
        setPrimaryId(prev2 => (prev2 && next.has(prev2) ? prev2 : selected[0].id));
        setDuplicateIds(() => {
          const dups = new Set(selectedIds);
          // El principal se calcula con setPrimaryId arriba; aquí quitamos el primero por defecto
          dups.delete(selected[0].id);
          return dups;
        });
      } else {
        setCustomGroup(null);
        setPrimaryId(null);
        setDuplicateIds(new Set());
      }
      return next;
    });
  };

  const useFreeSelection = () => {
    if (freeSelected.size < 2) {
      toast.error("Selecciona al menos 2 registros");
      return;
    }
    const selected = allRows.filter(r => freeSelected.has(r.id));
    const g: Group = { key: "__custom__", reason: "Selección manual", rows: selected };
    setCustomGroup(g);
    setActiveGroupKey(null);
    setPrimaryId(selected[0]?.id || null);
    setDuplicateIds(new Set(selected.slice(1).map(r => r.id)));
  };

  const selectGroup = (g: Group) => {
    setActiveGroupKey(g.key);
    setCustomGroup(null);
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
      let ok = 0;
      if (entity === "addresses") {
        // Soft merge: completar campos vacíos en el principal y desactivar duplicados.
        const primary = allRows.find(r => r.id === primaryId)?.raw;
        const fillable = ["nombre", "direccion_completa", "calle", "ciudad", "estado", "codigo_postal", "pais", "referencia", "coordenadas_lat", "coordenadas_lng", "codigo_google"];
        const patch: Record<string, any> = {};
        for (const dupId of duplicateIds) {
          const dup = allRows.find(r => r.id === dupId)?.raw;
          if (!dup) continue;
          for (const f of fillable) {
            if ((primary?.[f] == null || primary?.[f] === "") && dup[f] != null && dup[f] !== "" && patch[f] == null) {
              patch[f] = dup[f];
            }
          }
        }
        if (Object.keys(patch).length > 0) {
          const { error } = await (supabase.from("direcciones_empresa") as any).update(patch).eq("id", primaryId);
          if (error) throw error;
        }
        const dupIds = Array.from(duplicateIds);
        const { error: delErr } = await supabase.from("direcciones_empresa").update({ is_active: false }).in("id", dupIds);
        if (delErr) throw delErr;
        ok = dupIds.length;
      } else {
        const fnName = entity === "companies" ? "merge_companies" : entity === "productos" ? "merge_productos" : "merge_contacts";
        for (const dupId of duplicateIds) {
          const { error } = await (supabase.rpc as any)(fnName, {
            _primary_id: primaryId,
            _duplicate_id: dupId,
          });
          if (error) throw error;
          ok++;
        }
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
            <DialogTitle>Fusionar duplicados — {entity === "companies" ? "Empresas" : entity === "contacts" ? "Contactos" : entity === "productos" ? "Productos" : "Direcciones"}</DialogTitle>
            <DialogDescription>
              Detecta posibles duplicados, elige el registro principal y los demás se fusionarán en él.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Buscando duplicados...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[400px]">
              {/* Left: groups + free search */}
              <div className="border rounded-md flex flex-col">
                <Tabs defaultValue={groups.length === 0 ? "free" : "groups"} className="flex-1 flex flex-col">
                  <TabsList className="m-2">
                    <TabsTrigger value="groups">Grupos ({groups.length})</TabsTrigger>
                    <TabsTrigger value="free">Búsqueda libre</TabsTrigger>
                  </TabsList>
                  <TabsContent value="groups" className="flex-1 m-0">
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
                    <ScrollArea className="h-[330px]">
                      <div className="p-2 space-y-1">
                        {groups.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-2">
                            No se encontraron posibles duplicados automáticamente. Usa la pestaña "Búsqueda libre".
                          </p>
                        ) : filteredGroups.map(g => (
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
                  </TabsContent>
                  <TabsContent value="free" className="flex-1 m-0">
                    <div className="p-2 border-b space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={entity === "productos" ? "Buscar producto por código o nombre..." : `Buscar ${entity === "companies" ? "empresa" : "contacto"} por nombre, correo, etc...`}
                          className="pl-8 h-9"
                          value={freeSearch}
                          onChange={e => setFreeSearch(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {freeSelected.size} seleccionado(s)
                        </span>
                        <div className="flex gap-1">
                          {freeSelected.size > 0 && (
                            <Button size="sm" variant="ghost" className="h-7"
                              onClick={() => setFreeSelected(new Set())}>
                              Limpiar
                            </Button>
                          )}
                          <Button size="sm" className="h-7" onClick={useFreeSelection}
                            disabled={freeSelected.size < 2}>
                            Usar selección
                          </Button>
                        </div>
                      </div>
                    </div>
                    <ScrollArea className="h-[280px]">
                      <div className="p-2 space-y-1">
                        {freeSearch.trim() === "" ? (
                          <p className="text-xs text-muted-foreground p-2">
                            Escribe para buscar entre todos los registros.
                          </p>
                        ) : freeResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-2">Sin resultados.</p>
                        ) : (
                          freeResults.map(r => (
                            <label
                              key={r.id}
                              className={`flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                                freeSelected.has(r.id) ? "bg-accent" : "hover:bg-muted"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={freeSelected.has(r.id)}
                                onChange={() => toggleFreeSelected(r.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {r.label}
                                  {r.raw?.creado_automaticamente && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] ml-1.5">Creado automáticamente</Badge>
                                  )}
                                </div>
                                {r.sub && <div className="text-xs text-muted-foreground truncate">{r.sub}</div>}
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: detail */}
              <div className="border rounded-md flex flex-col">
                {effectiveGroup ? (
                  <>
                    <div className="p-3 border-b">
                      <p className="text-xs text-muted-foreground">{effectiveGroup.reason}</p>
                      <p className="text-sm font-medium">Elige el registro principal</p>
                    </div>
                    <ScrollArea className="h-[340px]">
                      <div className="p-3 space-y-2">
                        <RadioGroup value={primaryId || ""} onValueChange={onPickPrimary}>
                          {effectiveGroup.rows.map(r => (
                            <div key={r.id} className="flex items-start gap-2 p-2 rounded-md border">
                              <RadioGroupItem value={r.id} id={`p-${r.id}`} className="mt-1" />
                              <div className="flex-1 min-w-0">
                                <Label htmlFor={`p-${r.id}`} className="cursor-pointer font-medium block truncate">
                                  {r.label}
                                  {primaryId === r.id && (
                                    <Badge className="ml-2" variant="default">Principal</Badge>
                                  )}
                                  {r.raw?.creado_automaticamente && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] ml-1.5">Creado automáticamente</Badge>
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
                    Selecciona un grupo o realiza una búsqueda libre
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
              {entity === "productos"
                ? "Esta acción reasigna todas las relaciones (documentos, pedidos, inventario, kardex, demanda) del/los duplicado(s) al principal, completa los campos vacíos del principal y desactiva el/los duplicado(s). No se puede deshacer."
                : "Esta acción reasigna todas las relaciones (documentos, pagos, oportunidades, tareas, actividades, ejecutivos) del/los duplicado(s) al registro principal, completa los campos vacíos del principal y luego elimina el/los duplicado(s). No se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="text-sm">
            <p><span className="text-muted-foreground">Principal:</span>{" "}
              <strong>{effectiveGroup?.rows.find(r => r.id === primaryId)?.label}</strong>
            </p>
            <p className="mt-2 text-muted-foreground">A fusionar ({duplicateIds.size}):</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {Array.from(duplicateIds).map(id => {
                const r = effectiveGroup?.rows.find(x => x.id === id);
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