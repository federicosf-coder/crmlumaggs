import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Activity, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Ambito = "con_venta" | "sin_venta";
type Familia = "riesgo" | "avance" | "gestion";
type Unidad = "multiplo_ciclo" | "porcentaje" | "dias";

type Row = {
  id: string;
  ambito: Ambito;
  familia: Familia;
  nombre: string;
  color: string;
  unidad: Unidad;
  umbral_min: number | string;
  umbral_max: number | string | null;
  es_urgente: boolean;
  orden: number;
  activo: boolean;
};

const UNIDAD_BY_FAMILIA: Record<Familia, Unidad> = {
  riesgo: "multiplo_ciclo",
  avance: "porcentaje",
  gestion: "dias",
};

const UNIDAD_LABEL: Record<Unidad, string> = {
  multiplo_ciclo: "× ciclo",
  porcentaje: "%",
  dias: "días",
};

const FAMILIA_INFO: Record<Familia, { titulo: string; descripcion: string; ejemplo: string }> = {
  riesgo: {
    titulo: "Riesgo (recencia)",
    descripcion: "El umbral es un múltiplo del ciclo de compra del cliente.",
    ejemplo: "Ej. 0 a 1 = al día · 1 a 1.5 = por contactar · 1.5 a 2.5 = en riesgo · 2.5+ = dormido.",
  },
  avance: {
    titulo: "Avance (volumen del mes)",
    descripcion: "El umbral es el porcentaje de avance contra la meta mensual prorrateada.",
    ejemplo: "Ej. 0 a 25, 25 a 50, 50 a 75, 75 a 100, 100+.",
  },
  gestion: {
    titulo: "Gestión",
    descripcion: "El umbral son días desde la última actividad registrada.",
    ejemplo: "Ej. 0 a 14, 14 a 45, 45 a 90, 90+.",
  },
};

const DEFAULT_COLORS = [
  "#10b981", "#84cc16", "#f59e0b", "#f97316",
  "#ef4444", "#6366f1", "#8b5cf6", "#ec4899",
];

function StatusBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border"
      style={{ borderColor: color, color, backgroundColor: `${color}14` }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 rounded border cursor-pointer bg-transparent"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-xs w-28" />
      <div className="flex flex-wrap gap-1">
        {DEFAULT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="h-5 w-5 rounded-full border"
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

function RowEditor({
  row, onChange,
}: { row: Row; onChange: (patch: Partial<Row>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Nombre</Label>
        <Input value={row.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
      </div>
      <div>
        <Label>Color</Label>
        <ColorPicker value={row.color} onChange={(v) => onChange({ color: v })} />
        <div className="mt-2">
          <StatusBadge color={row.color || "#888"} label={row.nombre || "Vista previa"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Umbral mínimo ({UNIDAD_LABEL[row.unidad]})</Label>
          <Input
            type="number" step="any"
            value={row.umbral_min as any}
            onChange={(e) => onChange({ umbral_min: e.target.value })}
          />
        </div>
        <div>
          <Label>Umbral máximo ({UNIDAD_LABEL[row.unidad]})</Label>
          <Input
            type="number" step="any"
            placeholder="Vacío = sin tope"
            value={(row.umbral_max ?? "") as any}
            onChange={(e) => onChange({ umbral_max: e.target.value === "" ? null : e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Orden</Label>
          <Input
            type="number"
            value={row.orden}
            onChange={(e) => onChange({ orden: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-end gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={row.es_urgente} onCheckedChange={(v) => onChange({ es_urgente: v })} />
            <Label className="!m-0">Urgente</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={row.activo} onCheckedChange={(v) => onChange({ activo: v })} />
            <Label className="!m-0">Activo</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

function FamiliaBlock({
  ambito, familia, rows, onEdit, onDelete,
}: {
  ambito: Ambito;
  familia: Familia;
  rows: Row[];
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  const info = FAMILIA_INFO[familia];
  const items = rows
    .filter((r) => r.ambito === ambito && r.familia === familia)
    .sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">{info.titulo}</h3>
        <p className="text-xs text-muted-foreground">{info.descripcion}</p>
        <p className="text-xs text-muted-foreground italic">{info.ejemplo}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Orden</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead>Mín</TableHead>
            <TableHead>Máx</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead>Urgente</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead className="text-right w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.orden}</TableCell>
              <TableCell><StatusBadge color={r.color} label={r.nombre} /></TableCell>
              <TableCell>{r.umbral_min as any}</TableCell>
              <TableCell>{r.umbral_max === null || r.umbral_max === undefined ? "∞" : (r.umbral_max as any)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{UNIDAD_LABEL[r.unidad]}</TableCell>
              <TableCell>{r.es_urgente ? <Badge variant="destructive">Sí</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell><Badge variant={r.activo ? "default" : "secondary"}>{r.activo ? "Sí" : "No"}</Badge></TableCell>
              <TableCell className="text-right">
                <div className="inline-flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar "{r.nombre}"</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(r)}>Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">Sin estatus</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function SeguimientoEstatusTab() {
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "manager"]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["seguimiento_estatus_catalogo_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seguimiento_estatus_catalogo")
        .select("*")
        .order("ambito").order("familia").order("orden");
      if (error) throw error;
      return data as Row[];
    },
  });

  // Add dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addAmbito, setAddAmbito] = useState<Ambito>("con_venta");
  const [addFamilia, setAddFamilia] = useState<Familia>("riesgo");
  const [draft, setDraft] = useState<Row>({
    id: "", ambito: "con_venta", familia: "riesgo", nombre: "",
    color: DEFAULT_COLORS[0], unidad: "multiplo_ciclo",
    umbral_min: 0, umbral_max: null, es_urgente: false, orden: 1, activo: true,
  });

  const openAdd = () => {
    setAddAmbito("con_venta");
    setAddFamilia("riesgo");
    setDraft({
      id: "", ambito: "con_venta", familia: "riesgo", nombre: "",
      color: DEFAULT_COLORS[0], unidad: "multiplo_ciclo",
      umbral_min: 0, umbral_max: null, es_urgente: false, orden: 1, activo: true,
    });
    setAddOpen(true);
  };

  const onAddAmbitoChange = (a: Ambito) => {
    setAddAmbito(a);
    if (a === "sin_venta") {
      setAddFamilia("gestion");
      setDraft((d) => ({ ...d, ambito: a, familia: "gestion", unidad: UNIDAD_BY_FAMILIA.gestion }));
    } else {
      setAddFamilia("riesgo");
      setDraft((d) => ({ ...d, ambito: a, familia: "riesgo", unidad: UNIDAD_BY_FAMILIA.riesgo }));
    }
  };

  const onAddFamiliaChange = (f: Familia) => {
    setAddFamilia(f);
    setDraft((d) => ({ ...d, familia: f, unidad: UNIDAD_BY_FAMILIA[f] }));
  };

  const add = useMutation({
    mutationFn: async () => {
      const payload = {
        ambito: draft.ambito,
        familia: draft.familia,
        unidad: UNIDAD_BY_FAMILIA[draft.familia],
        nombre: draft.nombre,
        color: draft.color,
        umbral_min: Number(draft.umbral_min),
        umbral_max: draft.umbral_max === null || draft.umbral_max === "" ? null : Number(draft.umbral_max),
        es_urgente: draft.es_urgente,
        orden: draft.orden,
        activo: draft.activo,
      };
      const { error } = await supabase.from("seguimiento_estatus_catalogo").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seguimiento_estatus_catalogo_all"] });
      qc.invalidateQueries({ queryKey: ["seguimiento_estatus_catalogo"] });
      setAddOpen(false);
      toast.success("Estatus creado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Edit dialog
  const [editing, setEditing] = useState<Row | null>(null);
  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload = {
        nombre: editing.nombre,
        color: editing.color,
        umbral_min: Number(editing.umbral_min),
        umbral_max: editing.umbral_max === null || editing.umbral_max === "" ? null : Number(editing.umbral_max),
        es_urgente: editing.es_urgente,
        orden: editing.orden,
        activo: editing.activo,
      };
      const { error } = await supabase.from("seguimiento_estatus_catalogo").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seguimiento_estatus_catalogo_all"] });
      qc.invalidateQueries({ queryKey: ["seguimiento_estatus_catalogo"] });
      setEditing(null);
      toast.success("Estatus actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await supabase.from("seguimiento_estatus_catalogo").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seguimiento_estatus_catalogo_all"] });
      qc.invalidateQueries({ queryKey: ["seguimiento_estatus_catalogo"] });
      toast.success("Estatus eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recompute = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("recompute_all_seguimiento_ventas");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
      toast.success("Recalculado para todos los clientes");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Solo administradores o gerentes pueden editar este catálogo.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Estatus de Seguimiento a Ventas</CardTitle>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            <span className="font-medium">umbral_min</span> es inclusivo y <span className="font-medium">umbral_max</span> es exclusivo;
            deja umbral_max vacío para "sin tope superior". Los rangos deben ser continuos para no dejar huecos.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => recompute.mutate()} disabled={recompute.isPending}>
              <RefreshCw className={`mr-1 h-4 w-4 ${recompute.isPending ? "animate-spin" : ""}`} />
              Recalcular ahora
            </Button>
            <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" /> Nuevo</Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-right max-w-[260px]">
            Aplica de inmediato los cambios de rangos a todos los clientes.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {isLoading ? (
          <p className="text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold">Clientes con Venta</h2>
              <FamiliaBlock ambito="con_venta" familia="riesgo" rows={rows} onEdit={setEditing} onDelete={(r) => del.mutate(r)} />
              <FamiliaBlock ambito="con_venta" familia="avance" rows={rows} onEdit={setEditing} onDelete={(r) => del.mutate(r)} />
            </section>
            <section className="space-y-4">
              <h2 className="text-base font-semibold">Clientes sin Venta</h2>
              <FamiliaBlock ambito="sin_venta" familia="gestion" rows={rows} onEdit={setEditing} onDelete={(r) => del.mutate(r)} />
            </section>
          </>
        )}
      </CardContent>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo Estatus</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Ámbito</Label>
                <Select value={addAmbito} onValueChange={(v) => onAddAmbitoChange(v as Ambito)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="con_venta">Clientes con Venta</SelectItem>
                    <SelectItem value="sin_venta">Clientes sin Venta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Familia</Label>
                <Select value={addFamilia} onValueChange={(v) => onAddFamiliaChange(v as Familia)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {addAmbito === "con_venta" ? (
                      <>
                        <SelectItem value="riesgo">Riesgo (recencia)</SelectItem>
                        <SelectItem value="avance">Avance (volumen)</SelectItem>
                      </>
                    ) : (
                      <SelectItem value="gestion">Gestión (días)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Unidad asignada automáticamente: <span className="font-medium">{UNIDAD_LABEL[UNIDAD_BY_FAMILIA[addFamilia]]}</span>
            </p>
            <RowEditor row={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => add.mutate()} disabled={!draft.nombre || add.isPending}>
              {add.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Estatus</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Ámbito: <span className="font-medium">{editing.ambito === "con_venta" ? "Con Venta" : "Sin Venta"}</span>
                {" · "}Familia: <span className="font-medium">{editing.familia}</span>
                {" · "}Unidad: <span className="font-medium">{UNIDAD_LABEL[editing.unidad]}</span>
              </p>
              <RowEditor row={editing} onChange={(p) => setEditing((e) => (e ? { ...e, ...p } : e))} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => update.mutate()} disabled={!editing?.nombre || update.isPending}>
              {update.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}