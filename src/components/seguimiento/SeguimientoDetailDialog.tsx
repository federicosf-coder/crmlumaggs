import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmTasks } from "@/hooks/useCrmTasks";
import { useCreateCrmActivity } from "@/hooks/useCrmActivities";
import { CrmTaskItem } from "@/components/crm/CrmTaskItem";
import { CreateCrmTaskDialog } from "@/components/crm/CreateCrmTaskDialog";
import { Building2, TrendingUp, Calendar as CalendarIcon, Target, Plus, Phone, Mail, FileText, MessageCircle, AlertTriangle, ClipboardList } from "lucide-react";
import { formatDate, formatRelativeDate } from "@/lib/formatters";
import {
  type EmpresaVendedora,
  type SeguimientoEstatus,
  type SeguimientoVentasRow,
  useUpdateSeguimientoEstatusManual,
} from "@/hooks/useSeguimientoVentas";

interface Props {
  row: SeguimientoVentasRow | null;
  empresaVendedora: EmpresaVendedora;
  catalog: SeguimientoEstatus[];
  onOpenChange: (open: boolean) => void;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

export function SeguimientoDetailDialog({ row, empresaVendedora, catalog, onOpenChange }: Props) {
  const { session } = useAuth();
  const { toast } = useToast();
  const updateManual = useUpdateSeguimientoEstatusManual();
  const createActivity = useCreateCrmActivity();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");

  const open = !!row;
  const tieneVenta = !!row?.tiene_venta;

  // Tareas pendientes de la empresa (filtramos client-side por company_id)
  const { data: allTasks } = useCrmTasks({ completed: false });
  const companyTasks = useMemo(
    () => (allTasks || []).filter((t) => t.company_id === row?.company_id),
    [allTasks, row?.company_id],
  );

  // Actividades recientes de la empresa
  const { data: companyActivities } = useQuery({
    queryKey: ["seguimiento_company_activities", row?.company_id],
    enabled: !!row?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_activities")
        .select("id, type, title, description, created_at, activity_date")
        .eq("company_id", row!.company_id)
        .order("activity_date", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const ambito = tieneVenta ? "con_venta" : "sin_venta";
  const familiaManual = tieneVenta ? "riesgo" : "gestion";
  const statusOptions = useMemo(
    () => catalog.filter((c) => c.ambito === ambito && c.familia === familiaManual),
    [catalog, ambito, familiaManual],
  );

  const catalogMap = useMemo(() => {
    const m = new Map<string, SeguimientoEstatus>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  if (!row) return null;

  const effectiveId = row.estatus_manual && row.estatus_manual_id
    ? row.estatus_manual_id
    : (tieneVenta ? row.estatus_riesgo_id : row.estatus_gestion_id);
  const effective = effectiveId ? catalogMap.get(effectiveId) : null;
  const ritmo = row.estatus_ritmo_id ? catalogMap.get(row.estatus_ritmo_id) : null;

  const marcaLabel = empresaVendedora === "galsa_phillips66" ? "Phillips 66" : "Chevron";
  const headerGradient = empresaVendedora === "galsa_phillips66"
    ? "bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 border-l-4 border-red-500"
    : "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-l-4 border-blue-500";

  const handleManualChange = (val: string) => {
    if (val === "__auto__") {
      updateManual.mutate(
        { id: row.id, estatus_manual_id: null },
        { onSuccess: () => toast({ title: "Estatus automático activado" }) },
      );
    } else {
      updateManual.mutate(
        { id: row.id, estatus_manual_id: val },
        { onSuccess: () => toast({ title: "Estatus actualizado" }) },
      );
    }
  };

  const handleQuickActivity = (type: "call" | "email" | "meeting" | "note") => {
    if (!session?.user || !activityTitle.trim()) {
      toast({ title: "Ingresa un título", variant: "destructive" });
      return;
    }
    createActivity.mutate(
      { company_id: row.company_id, user_id: session.user.id, type, title: activityTitle },
      {
        onSuccess: () => {
          toast({ title: "Actividad registrada" });
          setActivityTitle("");
        },
      },
    );
  };

  const manualValue = row.estatus_manual && row.estatus_manual_id ? row.estatus_manual_id : "__auto__";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className={`rounded-lg p-4 shadow-sm ${headerGradient}`}>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <DialogTitle className="flex items-center gap-2 text-lg flex-wrap">
                {effective && (
                  <div
                    className="h-3 w-3 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: effective.color }}
                  />
                )}
                <span>{row.companies?.name || "—"}</span>
                <Badge variant="outline" className="text-xs font-semibold bg-white/80 border-foreground/10 shadow-sm">
                  {marcaLabel}
                </Badge>
                <Badge variant="outline" className="text-xs bg-white/70">
                  {tieneVenta ? "Con Venta" : "Sin Venta"}
                </Badge>
              </DialogTitle>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {effective && (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: effective.color }}
                >
                  {effective.es_urgente && <AlertTriangle className="h-3.5 w-3.5" />}
                  {effective.nombre}
                </span>
              )}
              {ritmo && tieneVenta && (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: ritmo.color }}
                >
                  Ritmo: {ritmo.nombre}
                </span>
              )}
              {row.estatus_manual && (
                <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-800">
                  Estatus manual
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left/main: métricas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg shadow-sm bg-muted/30 p-4 border-l-4" style={{ borderLeftColor: effective?.color || "hsl(var(--primary))" }}>
              <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Métricas
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                <Metric label="Potencial" value={fmtNum(row.potencial)} />
                <Metric label="Prom. mensual" value={fmtNum(row.promedio_historico_mensual)} />
                <Metric label="Ritmo" value={row.ritmo_pct != null ? `${Math.round(Number(row.ritmo_pct))}%` : "—"} />
                <Metric label="Acum. mes" value={fmtNum(row.acum_mes)} />
                <Metric label="Mes anterior" value={fmtNum(row.acum_mes_anterior)} />
                <Metric label="Acum. año" value={fmtNum(row.acum_anio)} />
                <Metric
                  label="Última compra"
                  value={
                    row.fecha_ultima_compra
                      ? `${formatDate(row.fecha_ultima_compra)}${row.dias_ultima_compra != null ? ` · ${row.dias_ultima_compra} d` : ""}`
                      : "—"
                  }
                />
                <Metric label="Ciclo (días)" value={row.ciclo_dias != null ? `${row.ciclo_dias}` : "—"} />
                <Metric label="Cotizaciones" value={`${row.cotizaciones_total}`} />
                <Metric
                  label="Últ. cotización"
                  value={
                    row.ultima_cotizacion_fecha
                      ? `${formatDate(row.ultima_cotizacion_fecha)}${row.dias_ultima_cotizacion != null ? ` · ${row.dias_ultima_cotizacion} d` : ""}`
                      : "—"
                  }
                />
                <Metric
                  label="Últ. actividad"
                  value={
                    row.ultima_actividad_fecha
                      ? `${formatDate(row.ultima_actividad_fecha)}${row.dias_ultima_actividad != null ? ` · ${row.dias_ultima_actividad} d` : ""}`
                      : "—"
                  }
                />
                <Metric label="Actividades activas" value={`${row.actividades_activas}`} />
              </div>
            </div>

            {/* Registrar actividad rápida */}
            <div className="rounded-lg shadow-sm bg-muted/30 p-4">
              <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
                <Target className="h-4 w-4" /> Registrar Actividad
              </h4>
              <Input
                placeholder="Título de la actividad..."
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
                className="mb-2"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleQuickActivity("call")}>
                  <Phone className="h-3 w-3 mr-1" /> Llamada
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleQuickActivity("email")}>
                  <Mail className="h-3 w-3 mr-1" /> Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleQuickActivity("meeting")}>
                  <CalendarIcon className="h-3 w-3 mr-1" /> Reunión
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleQuickActivity("note")}>
                  <FileText className="h-3 w-3 mr-1" /> Nota
                </Button>
              </div>
            </div>

            {/* Línea de tiempo */}
            <div className="rounded-lg shadow-sm bg-muted/30 p-4">
              <h4 className="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4" /> Actividades
              </h4>
              {!companyActivities?.length ? (
                <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
              ) : (
                <div className="space-y-3">
                  {companyActivities.map((a: any) => (
                    <div key={a.id} className="flex gap-3 text-sm">
                      <div className="mt-1">
                        {a.type === "call" && <Phone className="h-4 w-4 text-blue-500" />}
                        {a.type === "email" && <Mail className="h-4 w-4 text-purple-500" />}
                        {a.type === "meeting" && <CalendarIcon className="h-4 w-4 text-orange-500" />}
                        {a.type === "note" && <FileText className="h-4 w-4 text-green-500" />}
                        {a.type === "whatsapp" && <MessageCircle className="h-4 w-4 text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{a.title}</p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{formatRelativeDate(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Estatus + Tareas */}
          <aside className="space-y-6 lg:border-l lg:pl-6">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-light">Estatus</Label>
              <Select value={manualValue} onValueChange={handleManualChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                      Automático
                    </span>
                  </SelectItem>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.color }} />
                        {o.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {row.estatus_manual && (
                <p className="text-[11px] text-muted-foreground mt-1 font-light">
                  Estatus fijado manualmente. Selecciona "Automático" para volver al cálculo.
                </p>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold inline-flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4" /> Tareas pendientes
                </h4>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Nueva
                </Button>
              </div>
              {!companyTasks?.length ? (
                <p className="text-xs text-muted-foreground">Sin tareas pendientes.</p>
              ) : (
                <div className="space-y-2">
                  {companyTasks.slice(0, 10).map((t) => (
                    <CrmTaskItem key={t.id} task={t} />
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>

      <CreateCrmTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        defaultCompanyId={row.company_id}
      />
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xs font-light mt-0.5">{value}</p>
    </div>
  );
}