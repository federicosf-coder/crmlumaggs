import { useCallback, useEffect, useState } from "react";
import { supabase as _supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase: any = _supabaseTyped;
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Ban, Plus, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";

export type NumeroBloqueado = {
  id: string;
  wa_phone: string;
  motivo: string;
  detalle: string | null;
  error_code: number | null;
  activo: boolean;
  detectado_at: string;
};

const MOTIVOS: Record<string, string> = {
  no_existe: "El número no existe en WhatsApp",
  bloqueado: "Nos bloqueó / no quiere recibir",
  manual: "Excluido manualmente",
};

export function NumerosBloqueadosDialog({
  open, onOpenChange, onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<NumeroBloqueado[]>([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [motivo, setMotivo] = useState("manual");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_numeros_bloqueados")
      .select("id,wa_phone,motivo,detalle,error_code,activo,detectado_at")
      .order("detectado_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as NumeroBloqueado[]);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const agregar = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Escribe un número válido (10 dígitos o más)"); return; }
    const { error } = await supabase
      .from("whatsapp_numeros_bloqueados")
      .upsert({ wa_phone: digits, motivo, activo: true, detectado_at: new Date().toISOString() }, { onConflict: "wa_phone" });
    if (error) { toast.error(error.message); return; }
    toast.success("Número agregado a la lista");
    setPhone("");
    load();
    onChanged?.();
  };

  const toggleActivo = async (r: NumeroBloqueado) => {
    const { error } = await supabase
      .from("whatsapp_numeros_bloqueados")
      .update({ activo: !r.activo })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    load();
    onChanged?.();
  };

  const eliminar = async (r: NumeroBloqueado) => {
    const { error } = await supabase.from("whatsapp_numeros_bloqueados").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" /> Números que no reciben mensajes
          </DialogTitle>
          <DialogDescription>
            Estos números se saltan automáticamente en las campañas. Se agregan solos cuando WhatsApp
            reporta que el número no existe o no puede recibir el mensaje.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3 bg-muted/30">
          <div className="flex-1 min-w-48">
            <Label className="text-xs">Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5216861234567" />
          </div>
          <div className="min-w-48">
            <Label className="text-xs">Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MOTIVOS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={agregar}><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teléfono</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Detectado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin números en la lista.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.wa_phone}</TableCell>
                <TableCell className="text-sm">
                  {MOTIVOS[r.motivo] ?? r.motivo}
                  {r.detalle && <div className="text-xs text-muted-foreground truncate max-w-64">{r.detalle}</div>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(r.detectado_at), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  {r.activo
                    ? <Badge variant="destructive">Se omite</Badge>
                    : <Badge variant="outline">Permitido</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title={r.activo ? "Permitir de nuevo" : "Volver a omitir"} onClick={() => toggleActivo(r)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Eliminar" onClick={() => eliminar(r)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
