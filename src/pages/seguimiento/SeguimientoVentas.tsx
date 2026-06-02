import { useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { BackButton } from "@/components/BackButton";
import { PageBanner } from "@/components/PageBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, TrendingUp, AlertTriangle, Calendar as CalendarIcon } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import {
  useSeguimientoVentas,
  useSeguimientoEstatusCatalogo,
  type EmpresaVendedora,
  type SeguimientoVentasRow,
  type SeguimientoEstatus,
} from "@/hooks/useSeguimientoVentas";
import { SeguimientoDetailDialog } from "@/components/seguimiento/SeguimientoDetailDialog";

function StatusBadge({ estatus }: { estatus: SeguimientoEstatus | undefined | null }) {
  if (!estatus) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest text-white whitespace-nowrap"
      style={{ backgroundColor: estatus.color }}
      title={estatus.nombre}
    >
      {estatus.es_urgente && <AlertTriangle className="h-3 w-3" />}
      {estatus.nombre}
    </span>
  );
}

function daysColor(days: number | null | undefined): string {
  if (days == null) return "text-muted-foreground";
  if (days < 15) return "text-emerald-600";
  if (days <= 30) return "text-amber-600";
  if (days <= 60) return "text-orange-600";
  return "text-red-600";
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("es-MX", { maximumFractionDigits: 0 });
}

export default function SeguimientoVentas() {
  const { brand } = useParams<{ brand: string }>();
  const invalidBrand = !!brand && brand !== "chevron" && brand !== "phillips66";
  const empresaVendedora: EmpresaVendedora =
    brand === "phillips66" ? "galsa_phillips66" : "lumaggs_chevron";
  const brandTitle = brand === "phillips66" ? "Seguimiento — Phillips 66" : "Seguimiento — Chevron";
  const brandSubtitle = brand === "phillips66" ? "Galsa" : "Lumaggs";

  const [tab, setTab] = useState<"con_venta" | "sin_venta">("con_venta");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SeguimientoVentasRow | null>(null);

  const tieneVenta = tab === "con_venta";
  const { data: rows = [], isLoading } = useSeguimientoVentas({ empresaVendedora, tieneVenta });
  const { data: catalog = [] } = useSeguimientoEstatusCatalogo();

  const catalogMap = useMemo(() => {
    const m = new Map<string, SeguimientoEstatus>();
    for (const c of catalog) m.set(c.id, c);
    return m;
  }, [catalog]);

  const getEffectiveStatusId = (row: SeguimientoVentasRow): string | null => {
    if (row.estatus_manual && row.estatus_manual_id) return row.estatus_manual_id;
    return tieneVenta ? row.estatus_riesgo_id : row.estatus_gestion_id;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? rows.filter((r) => (r.companies?.name || "").toLowerCase().includes(term))
      : rows;
    return [...base].sort((a, b) => {
      const ea = catalogMap.get(getEffectiveStatusId(a) || "");
      const eb = catalogMap.get(getEffectiveStatusId(b) || "");
      const ua = ea?.es_urgente ? 1 : 0;
      const ub = eb?.es_urgente ? 1 : 0;
      if (ua !== ub) return ub - ua;
      const da = tieneVenta ? (a.dias_ultima_compra ?? -1) : (a.dias_ultima_actividad ?? -1);
      const db = tieneVenta ? (b.dias_ultima_compra ?? -1) : (b.dias_ultima_actividad ?? -1);
      return db - da;
    });
  }, [rows, search, catalogMap, tieneVenta]);

  if (invalidBrand) return <Navigate to="/seguimiento" replace />;

  return (
    <div className="space-y-4">
      <BackButton fallback="/seguimiento" />
      <PageBanner
        title={brandTitle}
        description={brandSubtitle}
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        }
      />

      {/* Controles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border bg-muted/30 p-1 self-start">
          <button
            onClick={() => setTab("con_venta")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
              tab === "con_venta"
                ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Clientes con Venta
          </button>
          <button
            onClick={() => setTab("sin_venta")}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors ${
              tab === "sin_venta"
                ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Clientes sin Venta
          </button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 font-light"
          />
        </div>
      </div>

      {/* Lista mobile (cards) */}
      <div className="grid gap-3 md:hidden">
        {isLoading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Sin registros.</p>
        ) : (
          filtered.map((r) => {
            const eff = catalogMap.get(getEffectiveStatusId(r) || "");
            const ritmo = r.estatus_ritmo_id ? catalogMap.get(r.estatus_ritmo_id) : null;
            return (
              <Card
                key={r.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-border/60"
                onClick={() => setSelected(r)}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight">{r.companies?.name || "—"}</p>
                    <StatusBadge estatus={eff} />
                  </div>
                  {tieneVenta ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-light">
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Última compra</span>
                        <p className={`font-medium ${daysColor(r.dias_ultima_compra)}`}>
                          {r.dias_ultima_compra != null ? `${r.dias_ultima_compra} d` : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ritmo</span>
                        <div><StatusBadge estatus={ritmo} /></div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Prom. mensual</span>
                        <p>{fmtNum(r.promedio_historico_mensual)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Acum. mes</span>
                        <p>{fmtNum(r.acum_mes)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Potencial</span>
                        <p>{fmtNum(r.potencial)}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Actividades</span>
                        <p>{r.actividades_activas}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-light">
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Última actividad</span>
                        <p className={`font-medium ${daysColor(r.dias_ultima_actividad)}`}>
                          {r.dias_ultima_actividad != null ? `${r.dias_ultima_actividad} d` : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Cotizaciones</span>
                        <p>{r.cotizaciones_total}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Últ. cotización</span>
                        <p className={`font-medium ${daysColor(r.dias_ultima_cotizacion)}`}>
                          {r.dias_ultima_cotizacion != null ? `${r.dias_ultima_cotizacion} d` : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Actividades</span>
                        <p>{r.actividades_activas}</p>
                      </div>
                    </div>
                  )}
                  {r.proxima_tarea_fecha && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" /> Próx. tarea: {formatDate(r.proxima_tarea_fecha)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Tabla desktop */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Estatus</TableHead>
                {tieneVenta ? (
                  <>
                    <TableHead>Ritmo</TableHead>
                    <TableHead>Última compra</TableHead>
                    <TableHead className="text-right">Potencial</TableHead>
                    <TableHead className="text-right">Prom. mensual</TableHead>
                    <TableHead className="text-right">Acum. mes</TableHead>
                    <TableHead className="text-right">Mes ant.</TableHead>
                    <TableHead className="text-right">Acum. año</TableHead>
                    <TableHead className="text-center">Activ.</TableHead>
                    <TableHead>Próx. tarea</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Últ. actividad</TableHead>
                    <TableHead className="text-center">Cotiz.</TableHead>
                    <TableHead>Últ. cotización</TableHead>
                    <TableHead className="text-center">Activ.</TableHead>
                    <TableHead>Próx. tarea</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={tieneVenta ? 11 : 6} className="text-center text-muted-foreground py-8">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tieneVenta ? 11 : 6} className="text-center text-muted-foreground py-8">
                    Sin registros.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const eff = catalogMap.get(getEffectiveStatusId(r) || "");
                  const ritmo = r.estatus_ritmo_id ? catalogMap.get(r.estatus_ritmo_id) : null;
                  return (
                    <TableRow key={r.id} onClick={() => setSelected(r)} className="cursor-pointer">
                      <TableCell className="font-medium">{r.companies?.name || "—"}</TableCell>
                      <TableCell><StatusBadge estatus={eff} /></TableCell>
                      {tieneVenta ? (
                        <>
                          <TableCell><StatusBadge estatus={ritmo} /></TableCell>
                          <TableCell>
                            <span className={`font-medium ${daysColor(r.dias_ultima_compra)}`}>
                              {r.dias_ultima_compra != null ? `${r.dias_ultima_compra} d` : "—"}
                            </span>
                            {r.fecha_ultima_compra && (
                              <span className="block text-[10px] text-muted-foreground">
                                {formatDate(r.fecha_ultima_compra)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{fmtNum(r.potencial)}</TableCell>
                          <TableCell className="text-right">{fmtNum(r.promedio_historico_mensual)}</TableCell>
                          <TableCell className="text-right">{fmtNum(r.acum_mes)}</TableCell>
                          <TableCell className="text-right">{fmtNum(r.acum_mes_anterior)}</TableCell>
                          <TableCell className="text-right">{fmtNum(r.acum_anio)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{r.actividades_activas}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.proxima_tarea_fecha ? formatDate(r.proxima_tarea_fecha) : "—"}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <span className={`font-medium ${daysColor(r.dias_ultima_actividad)}`}>
                              {r.dias_ultima_actividad != null ? `${r.dias_ultima_actividad} d` : "—"}
                            </span>
                            {r.ultima_actividad_fecha && (
                              <span className="block text-[10px] text-muted-foreground">
                                {formatDate(r.ultima_actividad_fecha)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{r.cotizaciones_total}</TableCell>
                          <TableCell>
                            <span className={`font-medium ${daysColor(r.dias_ultima_cotizacion)}`}>
                              {r.dias_ultima_cotizacion != null ? `${r.dias_ultima_cotizacion} d` : "—"}
                            </span>
                            {r.ultima_cotizacion_fecha && (
                              <span className="block text-[10px] text-muted-foreground">
                                {formatDate(r.ultima_cotizacion_fecha)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{r.actividades_activas}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.proxima_tarea_fecha ? formatDate(r.proxima_tarea_fecha) : "—"}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <SeguimientoDetailDialog
        row={selected}
        empresaVendedora={empresaVendedora}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        catalog={catalog}
      />
    </div>
  );
}