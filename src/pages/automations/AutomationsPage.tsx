import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Zap, Pencil, Trash2, FileText, MousePointerClick, Save, FilePlus,
  PenLine, ArrowRightLeft, Calendar, Timer, CalendarCheck, CalendarX,
  CalendarDays, Clock, Activity,
} from "lucide-react";
import { PageBanner } from "@/components/PageBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAutomations, useToggleAutomation, useDeleteAutomation, type Automation,
} from "@/hooks/useAutomations";
import { useAutomationRuns, useAllAutomationRuns } from "@/hooks/useAutomationRuns";

const ENTITY_META: Record<string, { label: string; className: string }> = {
  deal: { label: "Negocio", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  company: { label: "Empresa", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
  document: { label: "Documento", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
  contact: { label: "Contacto", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  task: { label: "Tarea", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
  seguimiento_venta: { label: "Seguimiento a Ventas", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  payment: { label: "Cobranza", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  credit_request: { label: "Solicitud de crédito", className: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100" },
  entrega: { label: "Entrega", className: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
};

const TRIGGER_META: Record<string, { label: string; icon: React.ElementType }> = {
  button_click: { label: "Click en botón", icon: MousePointerClick },
  on_save: { label: "Al guardar", icon: Save },
  on_create: { label: "Al crear", icon: FilePlus },
  on_field_change: { label: "Cambio de campo", icon: PenLine },
  on_stage_change: { label: "Cambio de etapa", icon: ArrowRightLeft },
  on_status_change: { label: "Cambio de estado", icon: ArrowRightLeft },
  date_reached: { label: "Fecha alcanzada", icon: Calendar },
  days_before_date: { label: "Días antes", icon: Calendar },
  days_after_date: { label: "Días después", icon: Calendar },
  deal_stalled: { label: "Negocio estancado", icon: Timer },
  month_start: { label: "Inicio de mes", icon: CalendarCheck },
  month_end: { label: "Fin de mes", icon: CalendarX },
  month_day: { label: "Día del mes", icon: CalendarDays },
  daily_at_time: { label: "Diario a la hora", icon: Clock },
  field_value_reaches: { label: "Valor alcanzado", icon: Activity },
};

function formatDateTime(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("es-MX", {
      dateStyle: "short", timeStyle: "short",
    });
  } catch { return "—"; }
}

export default function AutomationsPage() {
  const navigate = useNavigate();
  const { data: automations = [], isLoading } = useAutomations();
  const toggle = useToggleAutomation();
  const del = useDeleteAutomation();

  const [tab, setTab] = useState<"all" | "active" | "inactive" | "history">("all");
  const [logFor, setLogFor] = useState<Automation | null>(null);
  const [toDelete, setToDelete] = useState<Automation | null>(null);

  const filtered = useMemo(() => {
    if (tab === "active") return automations.filter((a) => a.is_active);
    if (tab === "inactive") return automations.filter((a) => !a.is_active);
    return automations;
  }, [automations, tab]);

  return (
    <div className="container mx-auto py-6">
      <PageBanner
        title="Automatizaciones"
        description="Diseña reglas que ejecutan acciones automáticamente."
      >
        <Button onClick={() => navigate("/automations/new")}>
          <Plus className="h-4 w-4" /> Nueva automatización
        </Button>
      </PageBanner>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="inactive">Inactivas</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {tab === "history" ? (
            <RunsHistory />
          ) : isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
              <Zap className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Sin automatizaciones. Crea la primera.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Disparador</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última ejecución</TableHead>
                    <TableHead className="text-right">Ejecuciones</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const ent = ENTITY_META[a.entity_type] ?? { label: a.entity_type, className: "" };
                    const trg = TRIGGER_META[a.trigger_type] ?? { label: a.trigger_type, icon: Zap };
                    const TIcon = trg.icon;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ent.className}>{ent.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <TIcon className="h-3 w-3" /> {trg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={a.is_active}
                            onCheckedChange={(v) =>
                              toggle.mutate({ id: a.id, is_active: v })
                            }
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(a.last_run_at)}</TableCell>
                        <TableCell className="text-right">{a.run_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => navigate(`/automations/${a.id}/edit`)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => setLogFor(a)}
                              title="Ver log"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => setToDelete(a)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RunLogSheet automation={logFor} onOpenChange={(o) => !o && setLogFor(null)} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar automatización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también sus acciones y log de ejecuciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) del.mutate(toDelete.id);
                setToDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RunLogSheet({
  automation,
  onOpenChange,
}: {
  automation: Automation | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: runs = [], isLoading } = useAutomationRuns(automation?.id ?? null);

  return (
    <Sheet open={!!automation} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{automation?.name ?? "Log de ejecuciones"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Sin ejecuciones registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow>
                      <TableCell>{formatDateTime(r.run_at)}</TableCell>
                      <TableCell className="text-sm">
                        {r.entity_label ?? r.entity_id ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            r.status === "success"
                              ? "bg-green-100 text-green-800"
                              : r.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{r.actions_executed}</TableCell>
                    </TableRow>
                    {r.status === "failed" && r.error_message && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-xs text-destructive bg-destructive/5">
                          {r.error_message}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RunsHistory() {
  const { data: runs = [], isLoading } = useAllAutomationRuns(300);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
        <Activity className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Aún no hay ejecuciones registradas.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Automatización</TableHead>
            <TableHead>Entidad</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <Fragment key={r.id}>
              <TableRow>
                <TableCell className="whitespace-nowrap">{formatDateTime(r.run_at)}</TableCell>
                <TableCell className="font-medium">{r.automation_name ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {r.entity_label ?? r.entity_id ?? "—"}
                  {r.entity_type && (
                    <span className="text-xs text-muted-foreground ml-1">({r.entity_type})</span>
                  )}
                </TableCell>
                <TableCell className="text-xs capitalize">{r.triggered_by}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      r.status === "success"
                        ? "bg-green-100 text-green-800"
                        : r.status === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  >
                    {r.status === "success" ? "Éxito" : r.status === "failed" ? "Falló" : "Omitida"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{r.actions_executed}</TableCell>
              </TableRow>
              {r.status === "failed" && r.error_message && (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-destructive bg-destructive/5">
                    {r.error_message}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}