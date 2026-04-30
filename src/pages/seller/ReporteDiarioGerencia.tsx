import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Download, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_TYPE_CONFIG } from "@/hooks/useCrmActivities";

type Row = {
  id: string;
  fecha: Date | null;
  empresa: string;
  actividad: string;
};

interface Props {
  tasksCompletadas: any[];
  actividades: any[];
  companyMap: Record<string, string>;
}

const fmtFechaCorta = (d: Date | null) => (d ? format(d, "dd/MM/yy") : "—");

export function ReporteDiarioGerencia({ tasksCompletadas, actividades, companyMap }: Props) {
  const rows: Row[] = useMemo(() => {
    const empresaOf = (id?: string | null) =>
      (id && companyMap[id]) || "Sin empresa";
    const t: Row[] = (tasksCompletadas || []).map((x: any) => ({
      id: `t-${x.id}`,
      fecha: x.updated_at ? new Date(x.updated_at) : x.due_date ? new Date(x.due_date) : null,
      empresa: empresaOf(x.company_id),
      actividad: x.title || "Tarea",
    }));
    const a: Row[] = (actividades || []).map((x: any) => {
      const cfg = ACTIVITY_TYPE_CONFIG[x.type as keyof typeof ACTIVITY_TYPE_CONFIG];
      return {
        id: `a-${x.id}`,
        fecha: x.activity_date ? new Date(x.activity_date) : x.created_at ? new Date(x.created_at) : null,
        empresa: empresaOf(x.company_id),
        actividad: cfg?.label || x.type || "Actividad",
      };
    });
    return [...t, ...a].sort((p, q) => (q.fecha?.getTime() || 0) - (p.fecha?.getTime() || 0));
  }, [tasksCompletadas, actividades, companyMap]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const buildLines = (rs: Row[]) =>
    rs.map((r) => `${fmtFechaCorta(r.fecha)} | ${r.empresa} | ${r.actividad}`);

  const handleCopiar = async () => {
    if (selected.size === 0) {
      toast.warning("Selecciona al menos una actividad para copiar");
      return;
    }
    const sel = rows.filter((r) => selected.has(r.id));
    const text = buildLines(sel).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Reporte copiado (${sel.length} ${sel.length === 1 ? "línea" : "líneas"})`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleExportar = () => {
    const sel = selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows;
    if (sel.length === 0) {
      toast.warning("No hay actividades para exportar");
      return;
    }
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Fecha", "Empresa", "Actividad/Tarea"].map(esc).join(","),
      ...sel.map((r) => [fmtFechaCorta(r.fecha), r.empresa, r.actividad].map(esc).join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-actividades-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportadas ${sel.length} actividades`);
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Reporte diario para Gerencia ({rows.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{selected.size} seleccionadas</span>
          <Button size="sm" variant="outline" onClick={handleCopiar}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar reporte
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportar}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todas"
                  />
                </TableHead>
                <TableHead className="w-24">Fecha</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Actividad / Tarea</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Sin actividades ni tareas completadas en el periodo
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label="Seleccionar fila"
                    />
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmtFechaCorta(r.fecha)}</TableCell>
                  <TableCell className="text-sm font-medium">{r.empresa}</TableCell>
                  <TableCell className="text-sm">{r.actividad}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
