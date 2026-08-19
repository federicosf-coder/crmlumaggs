import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/PageBanner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ANIO = 2026;

interface CostosConfig {
  id: string;
  anio: number;
  costo_poliza_total: number;
  aportacion_chevron: number;
  costo_por_cliente: number;
  recuperacion_siniestros: number;
  margen_utilidad_pct: number;
  notas: string | null;
}

export default function CescemexROIReport() {
  const { hasRole } = useAuth();
  const puedeEditar = hasRole("admin") || hasRole("manager");
  const qc = useQueryClient();
  const [form, setForm] = useState({
    costo_poliza_total: 0,
    aportacion_chevron: 0,
    costo_por_cliente: 0,
    recuperacion_siniestros: 0,
    margen_utilidad_pct: 20,
  });
  const [guardando, setGuardando] = useState(false);

  const { data: config } = useQuery({
    queryKey: ["cescemex-costos-config", ANIO],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cescemex_costos_config")
        .select("*")
        .eq("anio", ANIO)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as CostosConfig;
      const { data: created, error: e2 } = await (supabase as any)
        .from("cescemex_costos_config")
        .insert({ anio: ANIO })
        .select("*")
        .single();
      if (e2) throw e2;
      return created as CostosConfig;
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        costo_poliza_total: Number(config.costo_poliza_total ?? 0),
        aportacion_chevron: Number(config.aportacion_chevron ?? 0),
        costo_por_cliente: Number(config.costo_por_cliente ?? 0),
        recuperacion_siniestros: Number(config.recuperacion_siniestros ?? 0),
        margen_utilidad_pct: Number(config.margen_utilidad_pct ?? 20),
      });
    }
  }, [config]);

  const { data: clientesActivos = 0 } = useQuery({
    queryKey: ["cescemex-clientes-activos"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("tipo_pago", "credito_cescemex");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: carteraProtegida = 0 } = useQuery({
    queryKey: ["cescemex-cartera-protegida", ANIO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("subtotal")
        .eq("tipo_documento", "factura")
        .neq("estatus_factura", "cancelada")
        .eq("is_active", true)
        .eq("tipo_pago", "credito_cescemex")
        .gte("fecha_documento", `${ANIO}-01-01`)
        .limit(20000);
      if (error) throw error;
      return (data ?? []).reduce((a, d: { subtotal: number | null }) => a + Number(d.subtotal ?? 0), 0);
    },
  });

  const guardar = async () => {
    if (!config) return;
    setGuardando(true);
    const { error } = await (supabase as any)
      .from("cescemex_costos_config")
      .update(form)
      .eq("id", config.id);
    setGuardando(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Supuestos actualizados");
    qc.invalidateQueries({ queryKey: ["cescemex-costos-config", ANIO] });
  };

  const costoNetoPoliza = form.costo_poliza_total - form.aportacion_chevron;
  const costoVariable = clientesActivos * form.costo_por_cliente;
  const costoRealTotal = costoNetoPoliza + costoVariable;
  const beneficioNeto = costoRealTotal - form.recuperacion_siniestros;
  const pctCartera = carteraProtegida > 0 ? (costoRealTotal / carteraProtegida) * 100 : 0;

  const money = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  const Linea = ({
    label,
    valor,
    tono,
    destacado,
    nota,
  }: {
    label: string;
    valor: number;
    tono?: "rojo" | "naranja" | "verde";
    destacado?: boolean;
    nota?: string;
  }) => (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2 border-b last:border-b-0",
        destacado && "border-y bg-muted/40 px-3 rounded-md my-1"
      )}
    >
      <div>
        <div className={cn("text-sm font-light", destacado && "font-medium")}>{label}</div>
        {nota && <div className="text-xs text-muted-foreground font-light">{nota}</div>}
      </div>
      <div
        className={cn(
          "tabular-nums",
          destacado ? "text-2xl font-semibold" : "text-base",
          tono === "rojo" && "text-red-600",
          tono === "naranja" && "text-orange-600",
          tono === "verde" && "text-emerald-600"
        )}
      >
        {money(valor)}
      </div>
    </div>
  );

  return (
    <>
      <PageBanner
        title={`ROI Póliza Cescemex ${ANIO}`}
        description="Costo real anual de la póliza de crédito y su peso sobre la cartera protegida."
      />
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Supuestos {ANIO}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!puedeEditar ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-sm font-light">
                <div><span className="text-muted-foreground">Costo total póliza:</span> {money(form.costo_poliza_total)}</div>
                <div><span className="text-muted-foreground">Aportación Chevron:</span> {money(form.aportacion_chevron)}</div>
                <div><span className="text-muted-foreground">Costo por cliente/año:</span> {money(form.costo_por_cliente)}</div>
                <div><span className="text-muted-foreground">Recuperación siniestros:</span> {money(form.recuperacion_siniestros)}</div>
                <div><span className="text-muted-foreground">Margen de utilidad:</span> {form.margen_utilidad_pct}%</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    ["costo_poliza_total", "Costo total póliza"],
                    ["aportacion_chevron", "Aportación Chevron"],
                    ["costo_por_cliente", "Costo por cliente / año"],
                    ["recuperacion_siniestros", "Recuperación por siniestros"],
                  ] as const).map(([campo, label]) => (
                    <div key={campo} className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide">{label}</Label>
                      <Input
                        type="number"
                        value={form[campo]}
                        onChange={(e) => setForm((f) => ({ ...f, [campo]: Number(e.target.value) }))}
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={guardar} disabled={guardando} size="sm">
                  {guardando ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Costo real anual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Linea label="Costo bruto de la póliza" valor={form.costo_poliza_total} tono="rojo" />
            <Linea label="(–) Aportación Chevron" valor={form.aportacion_chevron} tono="verde" nota="No nos cuesta" />
            <Linea label="= Costo neto Lumaggs (póliza)" valor={costoNetoPoliza} tono="naranja" />
            <Linea
              label="(+) Costo variable por clientes"
              valor={costoVariable}
              tono="naranja"
              nota={`${clientesActivos} clientes activos × ${money(form.costo_por_cliente)}`}
            />
            <Linea label="= Costo real anual total" valor={costoRealTotal} tono="rojo" destacado />
            <Linea
              label="(–) Recuperación por siniestros"
              valor={form.recuperacion_siniestros}
              tono="verde"
              nota={form.recuperacion_siniestros === 0 ? "Aún sin siniestros cobrados" : undefined}
            />
            <Linea label="= Costo neto final" valor={beneficioNeto} tono="rojo" destacado />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
              Costo vs. cartera protegida {ANIO}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Costo real anual</div>
              <div className="text-2xl font-semibold text-red-600">{money(costoRealTotal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Cartera protegida</div>
              <div className="text-2xl font-semibold text-emerald-600">{money(carteraProtegida)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Peso de la póliza</div>
              <div className="text-2xl font-semibold">{pctCartera.toFixed(2)}%</div>
              <div className="text-xs text-muted-foreground font-light">
                La póliza cuesta {pctCartera.toFixed(2)}% de la cartera que protege.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}