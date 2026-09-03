import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox, KeyRound, RefreshCw, Search, MessageCircle, Mail, ExternalLink,
  CheckCircle2, XCircle, Clock, Flame, Snowflake, LifeBuoy, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLeads, useTomarLead, useDescartarLead, type Lead, type LeadEstatus } from "@/hooks/useLeads";
import { LeadSourcesDialog } from "@/components/leads/LeadSourcesDialog";
import { ImportarLeadsDialog } from "@/components/leads/ImportarLeadsDialog";
import { useAuth } from "@/contexts/AuthContext";

const ESTATUS_META: Record<LeadEstatus, { label: string; className: string }> = {
  nuevo: { label: "Nuevo", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  pendiente_atencion: { label: "Pendiente de atención", className: "bg-amber-100 text-amber-800 border-amber-200" },
  alerta: { label: "En alerta", className: "bg-orange-100 text-orange-800 border-orange-200" },
  frio: { label: "Lead frío", className: "bg-sky-100 text-sky-800 border-sky-200" },
  recuperacion: { label: "Recuperación", className: "bg-violet-100 text-violet-800 border-violet-200" },
  atendido: { label: "Atendido", className: "bg-slate-100 text-slate-700 border-slate-200" },
  descartado: { label: "Descartado", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

function transcurrido(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

function semaforo(lead: Lead) {
  if (lead.primer_contacto_at) return "bg-slate-300";
  const mins = (Date.now() - new Date(lead.created_at).getTime()) / 60000;
  if (mins < 15) return "bg-emerald-500";
  if (mins < 60) return "bg-amber-500";
  if (mins < 1440) return "bg-orange-500";
  return "bg-rose-500";
}

export default function LeadsInbox() {
  const { hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const { data: leads = [], isLoading, refetch } = useLeads();
  const tomar = useTomarLead();
  const descartar = useDescartarLead();
  const [search, setSearch] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [tab, setTab] = useState("bandeja");
  const esAdmin = hasAnyRole(["admin", "manager"]);

  const kpis = useMemo(() => ({
    nuevos: leads.filter((l) => l.estatus === "nuevo").length,
    pendientes: leads.filter((l) => l.estatus === "pendiente_atencion").length,
    alerta: leads.filter((l) => l.estatus === "alerta").length,
    frios: leads.filter((l) => l.estatus === "frio").length,
    recuperacion: leads.filter((l) => l.estatus === "recuperacion").length,
  }), [leads]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = leads.filter((l) => {
      if (tab === "bandeja") return ["nuevo", "pendiente_atencion", "alerta", "frio"].includes(l.estatus);
      if (tab === "recuperacion") return l.estatus === "recuperacion";
      return ["atendido", "descartado"].includes(l.estatus);
    });
    if (!q) return base;
    return base.filter((l) =>
      [l.nombre, l.email, l.telefono, l.empresa_nombre, l.interes, l.utm_campaign, l.lead_sources?.nombre]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [leads, search, tab]);

  const recalcular = async () => {
    const { error } = await (supabase as any).rpc("recompute_lead_sla");
    if (error) toast.error(error.message);
    else {
      toast.success("Estados actualizados");
      qc.invalidateQueries({ queryKey: ["leads"] });
    }
  };

  const KPI = ({ icon: Icon, label, value, color }: any) => (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-2xl font-light leading-none">{value}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          <h1 className="text-xl font-light">Bandeja de Prospectos</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetch(); recalcular(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
          </Button>
          {esAdmin && (
            <Button size="sm" onClick={() => setSourcesOpen(true)}>
              <KeyRound className="h-4 w-4 mr-1" /> Fuentes y API
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KPI icon={Sparkles} label="Nuevos" value={kpis.nuevos} color="#10b981" />
        <KPI icon={Clock} label="Pendientes" value={kpis.pendientes} color="#f59e0b" />
        <KPI icon={Flame} label="En alerta" value={kpis.alerta} color="#f97316" />
        <KPI icon={Snowflake} label="Fríos" value={kpis.frios} color="#0ea5e9" />
        <KPI icon={LifeBuoy} label="Recuperación" value={kpis.recuperacion} color="#8b5cf6" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="bandeja">Bandeja</TabsTrigger>
            <TabsTrigger value="recuperacion">Recuperación</TabsTrigger>
            <TabsTrigger value="cerrados">Atendidos / Descartados</TabsTrigger>
          </TabsList>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar prospecto..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-violet-50 to-blue-50">
                  <TableHead className="text-[11px] uppercase tracking-wide">Tiempo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Prospecto</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Contacto</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Origen</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Interés / Mensaje</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Cargando...</TableCell></TableRow>
                )}
                {!isLoading && filtrados.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sin prospectos en esta vista.</TableCell></TableRow>
                )}
                {filtrados.map((l, i) => (
                  <TableRow key={l.id} className={i % 2 ? "bg-muted/30 hover:bg-blue-50/40" : "hover:bg-blue-50/40"}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${semaforo(l)}`} />
                        <span className="text-xs text-muted-foreground">{transcurrido(l.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{l.nombre}</p>
                      {l.empresa_nombre && <p className="text-[11px] text-muted-foreground">{l.empresa_nombre}</p>}
                      {l.ciudad && <p className="text-[11px] text-muted-foreground">{l.ciudad}</p>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.telefono && <p>{l.telefono}</p>}
                      {l.email && <p className="text-muted-foreground">{l.email}</p>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>{l.lead_sources?.nombre ?? "—"}</p>
                      {(l.utm_source || l.utm_campaign) && (
                        <p className="text-[11px] text-muted-foreground">{[l.utm_source, l.utm_campaign].filter(Boolean).join(" / ")}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[240px]">
                      {l.interes && <p className="font-medium">{l.interes}</p>}
                      {l.mensaje && <p className="text-muted-foreground line-clamp-2">{l.mensaje}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ESTATUS_META[l.estatus]?.className}>
                        {ESTATUS_META[l.estatus]?.label ?? l.estatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {l.telefono && (
                          <Button size="icon" variant="ghost" title="WhatsApp" asChild>
                            <a href={`https://wa.me/${l.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {l.email && (
                          <Button size="icon" variant="ghost" title="Correo" asChild>
                            <a href={`mailto:${l.email}`}><Mail className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {l.contact_id && (
                          <Button size="icon" variant="ghost" title="Ver contacto" asChild>
                            <Link to={`/directory?tab=contacts&select=${l.contact_id}`}><ExternalLink className="h-4 w-4" /></Link>
                          </Button>
                        )}
                        {!["atendido", "descartado"].includes(l.estatus) && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => tomar.mutate(l)} disabled={tomar.isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Tomar
                            </Button>
                            <Button size="icon" variant="ghost" title="Descartar"
                              onClick={() => {
                                const motivo = window.prompt("Motivo para descartar:");
                                if (motivo) descartar.mutate({ id: l.id, motivo });
                              }}>
                              <XCircle className="h-4 w-4 text-rose-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <LeadSourcesDialog open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
}
