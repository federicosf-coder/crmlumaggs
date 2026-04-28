import { useMemo, useState } from "react";
import type { CrmDeal } from "@/hooks/useCrmDeals";
import type { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Props {
  stages: CrmPipelineStage[];
  deals: CrmDeal[];
  ejecutivos: { user_id: string; full_name: string }[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectMany: (ids: string[], checked: boolean) => void;
  onOpenDeal: (deal: CrmDeal) => void;
}

export function CrmDealsListView({
  stages, deals, ejecutivos, selectedIds, onToggleSelect, onToggleSelectMany, onOpenDeal,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const ejecMap = useMemo(() => {
    const m: Record<string, string> = {};
    ejecutivos.forEach((e) => { m[e.user_id] = e.full_name; });
    return m;
  }, [ejecutivos]);

  const groups = useMemo(() => {
    return stages.map((s) => {
      const list = deals.filter((d) => d.stage_id === s.id);
      const totalUnits = list.reduce((acc, d: any) => acc + Number(d.potencial_unidades || 0), 0);
      const totalValue = list.reduce((acc, d) => acc + Number(d.value || 0), 0);
      return { stage: s, list, totalUnits, totalValue };
    });
  }, [stages, deals]);

  const toggleGroup = (sid: string) => {
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(sid) ? n.delete(sid) : n.add(sid);
      return n;
    });
  };

  const fmtMoney = (v?: number | null) =>
    v ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v)) : "—";
  const fmtDate = (v?: string | null) => {
    if (!v) return "—";
    try { return format(new Date(v), "dd/MM/yyyy"); } catch { return v; }
  };

  return (
    <div className="space-y-3">
      {groups.map(({ stage, list, totalUnits, totalValue }) => {
        const isCollapsed = collapsed.has(stage.id);
        const visibleIds = list.map((d) => d.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
        const someSelected = visibleIds.some((id) => selectedIds.has(id));
        return (
          <div key={stage.id} className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleGroup(stage.id)}>
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="font-semibold text-sm">{stage.name}</span>
                <Badge variant="secondary" className="ml-1">{list.length}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {totalUnits > 0 && <span>{totalUnits.toLocaleString("es-MX")} u.</span>}
                {totalValue > 0 && <span>{fmtMoney(totalValue)}</span>}
              </div>
            </div>
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left w-8">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) => onToggleSelectMany(visibleIds, !!v)}
                          aria-label="Seleccionar todos del grupo"
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Negocio</th>
                      <th className="px-3 py-2 text-left">Empresa</th>
                      <th className="px-3 py-2 text-left">Contacto</th>
                      <th className="px-3 py-2 text-left">Ejecutivo</th>
                      <th className="px-3 py-2 text-left">Cierre</th>
                      <th className="px-3 py-2 text-right">Unidades</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                      <th className="px-3 py-2 text-right w-20">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr><td colSpan={9} className="px-3 py-4 text-center text-muted-foreground text-xs">Sin negocios</td></tr>
                    ) : list.map((d: any) => (
                      <tr key={d.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selectedIds.has(d.id)}
                            onCheckedChange={() => onToggleSelect(d.id)}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium">{d.title}</td>
                        <td className="px-3 py-2">{d.companies?.name || "—"}</td>
                        <td className="px-3 py-2">
                          {d.contacts ? `${d.contacts.first_name ?? ""} ${d.contacts.last_name ?? ""}`.trim() : "—"}
                        </td>
                        <td className="px-3 py-2">{d.owner_id ? (ejecMap[d.owner_id] || "—") : "—"}</td>
                        <td className="px-3 py-2">{fmtDate(d.close_date)}</td>
                        <td className="px-3 py-2 text-right">{d.potencial_unidades ? Number(d.potencial_unidades).toLocaleString("es-MX") : "—"}</td>
                        <td className="px-3 py-2 text-right">{fmtMoney(d.value)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenDeal(d)} title="Abrir / Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}