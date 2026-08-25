import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreditoDocsIntakeTab } from "@/components/credito/CreditoDocsIntakeTab";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileCheck, Settings, Plus, Search, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CREDITO_ESTADO_LABEL, CREDITO_ESTADO_COLOR, CREDITO_TIPO_LABEL,
  CREDITO_ESTADO_OPTIONS, CREDITO_TIPO_OPTIONS,
} from "@/lib/credito";

export default function CreditoList() {
  const { user, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canConfigure = hasAnyRole(["admin", "manager"]);
  const canVerIntake = hasAnyRole(["admin", "manager", "accounting", "customer_service"]);

  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<string>("all");
  const [estado, setEstado] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newTipo, setNewTipo] = useState<"cescemex" | "directo">("directo");
  const [newMonto, setNewMonto] = useState("");
  const [newDias, setNewDias] = useState("30");

  const { data: companies = [] } = useQuery({
    queryKey: ["credito-companies"],
    queryFn: async () => {
      return await fetchAllRows<any>((from, to) =>
        supabase
          .from("companies")
          .select("id, name, razon_social")
          .eq("is_active", true)
          .order("name")
          .range(from, to)
      );
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["credit_requests", search, tipo, estado],
    queryFn: async () => {
      let q = supabase
        .from("credit_requests")
        .select("id, folio, estado, tipo, monto_solicitado, dias_credito, fecha_limite, created_at, company_id, created_by, companies(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (tipo !== "all") q = q.eq("tipo", tipo as any);
      if (estado !== "all") q = q.eq("estado", estado as any);
      const { data, error } = await q;
      if (error) throw error;
      let list = data || [];
      if (search.trim()) {
        const s = search.toLowerCase();
        list = list.filter((r: any) =>
          (r.folio || "").toLowerCase().includes(s) ||
          ((r.companies as any)?.name || "").toLowerCase().includes(s),
        );
      }
      return list;
    },
  });

  // Counts by estado for completeness chips
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows as any[]) map[r.estado] = (map[r.estado] || 0) + 1;
    return map;
  }, [rows]);

  const handleCreate = async () => {
    if (!newCompanyId) { toast.error("Selecciona una empresa"); return; }
    setCreating(true);
    const { data, error } = await supabase
      .from("credit_requests")
      .insert({
        company_id: newCompanyId,
        tipo: newTipo as any,
        monto_solicitado: newMonto ? Number(newMonto) : null,
        dias_credito: newDias ? Number(newDias) : null,
        created_by: user?.id,
        estado: "borrador",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error) { toast.error("No se pudo crear: " + error.message); return; }
    toast.success("Solicitud creada");
    setNewOpen(false);
    setNewCompanyId(""); setNewMonto(""); setNewDias("30");
    qc.invalidateQueries({ queryKey: ["credit_requests"] });
    navigate(`/credito/${data!.id}`);
  };

  const { data: intakeCount = 0 } = useQuery({
    queryKey: ["credito-docs-intake-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("credito_docs_intake")
        .select("id", { count: "exact", head: true })
        .eq("estatus", "pendiente");
      return count || 0;
    },
    enabled: canVerIntake,
  });

  const contenidoSolicitudes = (
    <>
          {/* Resumen por estado */}
          <div className="flex gap-2 flex-wrap">
            {CREDITO_ESTADO_OPTIONS.slice(0, 8).map((o) => {
              const c = CREDITO_ESTADO_COLOR[o.value] || "bg-slate-50 text-slate-700 border-slate-200";
              const n = counts[o.value] || 0;
              const active = estado === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setEstado(active ? "all" : o.value)}
                  className={`inline-flex items-center gap-2 h-7 px-2.5 rounded-full border text-[10px] font-semibold uppercase tracking-widest transition-all ${c} ${active ? "ring-2 ring-primary/40" : "opacity-90 hover:opacity-100"}`}
                >
                  {o.label}
                  <span className="rounded-full bg-white/70 text-foreground px-1.5 min-w-[20px] text-center text-[10px] font-light tracking-normal normal-case">{n}</span>
                </button>
              );
            })}
          </div>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por folio o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {CREDITO_TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {CREDITO_ESTADO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Cargando...</div>
              ) : rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FileCheck className="h-10 w-10 mx-auto opacity-30 mb-2" />
                  <p>No hay solicitudes que coincidan con los filtros.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folio</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Días</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Creada</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rows as any[]).map((r) => {
                        const c = CREDITO_ESTADO_COLOR[r.estado] || "bg-slate-50 text-slate-700 border-slate-200";
                        return (
                          <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/credito/${r.id}`)}>
                            <TableCell className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.folio || "—"}</TableCell>
                            <TableCell>{(r.companies as any)?.name || "—"}</TableCell>
                            <TableCell>
                              {r.tipo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-200">
                                  {CREDITO_TIPO_LABEL[r.tipo]}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {r.monto_solicitado ? `$${Number(r.monto_solicitado).toLocaleString("es-MX", { minimumFractionDigits: 2 })}` : "—"}
                            </TableCell>
                            <TableCell>{r.dias_credito ?? "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border ${c}`}>
                                {CREDITO_ESTADO_LABEL[r.estado] || r.estado}
                              </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {format(new Date(r.created_at), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/credito/${r.id}`)} title="Ver">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
    </>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 border-b border-border/40 px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-light tracking-tight flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-violet-600" />
                Solicitudes de Crédito
              </h1>
              <p className="text-xs font-light text-muted-foreground mt-1">
                Gestiona solicitudes de crédito (Cescemex y Crédito Directo).
              </p>
            </div>
            <div className="flex gap-2">
              {canConfigure && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-violet-200 bg-gradient-to-r from-violet-50 to-blue-50 text-violet-700 hover:from-violet-100 hover:to-blue-100 hover:text-violet-800 text-[10px] font-semibold uppercase tracking-widest"
                >
                  <Link to="/credito/configuracion"><Settings className="h-3.5 w-3.5 mr-1.5" />Configurar documentos</Link>
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setNewOpen(true)}
                className="bg-gradient-to-br from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white shadow-md text-[10px] font-semibold uppercase tracking-widest"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />Nueva solicitud
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {canVerIntake ? (
        <Tabs defaultValue="solicitudes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              Documentos por correo
              {intakeCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{intakeCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="solicitudes" className="space-y-6">
            {contenidoSolicitudes}
          </TabsContent>
          <TabsContent value="docs">
            <CreditoDocsIntakeTab />
          </TabsContent>
        </Tabs>
      ) : (
        contenidoSolicitudes
      )}

      {/* Nueva solicitud */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-violet-50 to-blue-50 px-6 py-4 border-b">
            <DialogTitle className="text-base font-semibold tracking-tight">Nueva solicitud de crédito</DialogTitle>
            <DialogDescription className="text-xs">Selecciona la empresa y el tipo de crédito.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4 font-light">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase tracking-wide font-medium">Empresa</Label>
                <a
                  href="/directory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-violet-600 hover:text-violet-700 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Nueva empresa
                </a>
              </div>
              <SearchableSelect
                value={newCompanyId}
                onValueChange={setNewCompanyId}
                options={(companies as any[]).map((c) => ({ value: c.id, label: c.name || c.razon_social || c.id }))}
                placeholder="Buscar empresa..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide font-medium">Tipo de crédito</Label>
              <Select value={newTipo} onValueChange={(v) => setNewTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CREDITO_TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide font-medium">Monto solicitado</Label>
                <Input type="number" value={newMonto} onChange={(e) => setNewMonto(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide font-medium">Días de crédito</Label>
                <Input type="number" value={newDias} onChange={(e) => setNewDias(e.target.value)} placeholder="30" />
              </div>
            </div>
          </div>
          <DialogFooter className="bg-muted/40 px-6 py-3 border-t">
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Crear solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
