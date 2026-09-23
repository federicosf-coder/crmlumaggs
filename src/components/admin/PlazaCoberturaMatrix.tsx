import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, UserPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PUESTOS = [
  { role: "customer_service", label: "Atención a Clientes y Facturación" },
  { role: "warehouse", label: "Almacén" },
  { role: "delivery", label: "Reparto" },
  { role: "manager", label: "Responsable Plaza" },
] as const;
type PuestoRole = (typeof PUESTOS)[number]["role"];

export function PlazaCoberturaMatrix() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ plazaId: string; plazaNombre: string; role: PuestoRole; label: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plaza_cobertura"],
    queryFn: async () => {
      const [pl, pr, ro] = await Promise.all([
        supabase.from("plazas").select("id, nombre").eq("is_active", true).order("nombre"),
        supabase.from("profiles").select("user_id, full_name, email, plaza_id, is_active, approval_status").eq("is_active", true),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pl.error) throw pl.error;
      if (pr.error) throw pr.error;
      if (ro.error) throw ro.error;
      return { plazas: pl.data || [], profiles: (pr.data || []).filter((p: any) => p.user_id && p.approval_status === "aprobado"), roles: ro.data || [] };
    },
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (data?.roles || []).forEach((r: any) => {
      if (!m.has(r.user_id)) m.set(r.user_id, new Set());
      m.get(r.user_id)!.add(r.role);
    });
    return m;
  }, [data]);

  const usersFor = (plazaId: string, role: string) =>
    (data?.profiles || []).filter((p: any) => p.plaza_id === plazaId && rolesByUser.get(p.user_id)?.has(role));

  const refresh = () => qc.invalidateQueries({ queryKey: ["plaza_cobertura"] });

  const assign = async (userId: string) => {
    if (!target || !userId) return;
    const prof = data?.profiles.find((p: any) => p.user_id === userId) as any;
    if (prof && prof.plaza_id && prof.plaza_id !== target.plazaId) {
      if (!confirm(`${prof.full_name || prof.email} está asignado a otra plaza. ¿Moverlo a ${target.plazaNombre}?`)) return;
    }
    if (!prof || prof.plaza_id !== target.plazaId) {
      const { error } = await supabase.from("profiles").update({ plaza_id: target.plazaId }).eq("user_id", userId);
      if (error) return toast.error("No se pudo asignar plaza: " + error.message);
    }
    if (!rolesByUser.get(userId)?.has(target.role)) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: target.role } as any);
      if (error) return toast.error("No se pudo asignar puesto: " + error.message);
    }
    toast.success("Usuario asignado");
    setTarget(null);
    refresh();
  };

  const remove = async (userId: string, role: string) => {
    if (!confirm("¿Quitar este puesto al usuario? (Conserva su plaza y demás roles)")) return;
    setBusy(userId + role);
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Puesto removido");
    refresh();
  };

  const options = useMemo(() => {
    if (!target) return [];
    return (data?.profiles || [])
      .filter((p: any) => !(p.plaza_id === target.plazaId && rolesByUser.get(p.user_id)?.has(target.role)))
      .map((p: any) => {
        const plaza = data?.plazas.find((x: any) => x.id === p.plaza_id)?.nombre;
        return {
          value: p.user_id,
          label: `${p.full_name || p.email}${plaza ? ` — ${plaza}` : ""}`,
          searchText: `${p.full_name || ""} ${p.email || ""} ${plaza || ""}`,
        };
      });
  }, [target, data, rolesByUser]);

  const totalVacantes = (data?.plazas || []).reduce(
    (acc: number, pl: any) => acc + PUESTOS.filter((p) => usersFor(pl.id, p.role).length === 0).length, 0);

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Cobertura de puestos por plaza</CardTitle>
        {!isLoading && (
          <span className={`text-xs font-medium ${totalVacantes ? "text-destructive" : "text-emerald-600"}`}>
            {totalVacantes ? `${totalVacantes} vacante(s)` : "Cobertura completa"}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Cargando...</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data?.plazas || []).map((pl: any) => {
              const vac = PUESTOS.filter((p) => usersFor(pl.id, p.role).length === 0).length;
              return (
                <div key={pl.id} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 rounded-t-lg">
                    <span className="font-semibold tracking-tight">{pl.nombre}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] ${vac ? "text-destructive" : "text-emerald-600"}`}>
                      <span className={`h-2 w-2 rounded-full ${vac ? "bg-red-500" : "bg-green-500"}`} />
                      {vac ? `${vac} vacante(s)` : "Completa"}
                    </span>
                  </div>
                  <div className="divide-y">
                    {PUESTOS.map((pu) => {
                      const us = usersFor(pl.id, pu.role);
                      return (
                        <div key={pu.role} className="px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <span className={`h-2 w-2 rounded-full ${us.length ? "bg-green-500" : "bg-red-500"}`} />
                              {pu.label}
                            </span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" title="Asignar usuario"
                              onClick={() => setTarget({ plazaId: pl.id, plazaNombre: pl.nombre, role: pu.role, label: pu.label })}>
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {us.length === 0 && <span className="text-xs italic text-destructive">Sin asignar</span>}
                            {us.map((u: any) => (
                              <span key={u.user_id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-light">
                                {u.full_name || u.email}
                                <button type="button" onClick={() => remove(u.user_id, pu.role)} disabled={busy === u.user_id + pu.role}
                                  className="text-muted-foreground hover:text-destructive" title="Quitar puesto">
                                  {busy === u.user_id + pu.role ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <Dialog open={!!target} onOpenChange={(v) => { if (!v) setTarget(null); }}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <DialogHeader className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 px-5 py-4 border-b">
            <DialogTitle className="text-lg font-semibold tracking-tight">Asignar {target?.label}</DialogTitle>
            <DialogDescription className="text-xs font-light">Plaza {target?.plazaNombre}. Se asigna la plaza al usuario y se le agrega el puesto.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-5">
            <SearchableSelect value="" onValueChange={assign} options={options} placeholder="Buscar usuario..." />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
