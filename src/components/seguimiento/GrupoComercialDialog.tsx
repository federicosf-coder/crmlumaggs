import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Users2, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  companyId: string | null;
  companyName?: string | null;
  currentGrupoId?: string | null;
  onOpenChange: (open: boolean) => void;
}

export function GrupoComercialDialog({ open, companyId, companyName, currentGrupoId, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [grupoId, setGrupoId] = useState<string>("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setGrupoId(currentGrupoId || "");
      setNuevoNombre("");
    }
  }, [open, currentGrupoId]);

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos_comerciales"],
    enabled: open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("grupos_comerciales")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");
      return (data || []) as { id: string; nombre: string }[];
    },
    staleTime: 60_000,
  });

  const guardar = async (valor: string | null) => {
    if (!companyId) return;
    setSaving(true);
    try {
      let finalId = valor;
      if (valor === "__nuevo__") {
        const nombre = nuevoNombre.trim();
        if (!nombre) {
          toast({ title: "Escribe el nombre del grupo", variant: "destructive" });
          setSaving(false);
          return;
        }
        const { data, error } = await (supabase as any)
          .from("grupos_comerciales")
          .insert({ nombre })
          .select("id")
          .single();
        if (error) throw error;
        finalId = data.id;
      }
      const { error: upErr } = await (supabase as any)
        .from("companies")
        .update({ grupo_comercial_id: finalId })
        .eq("id", companyId);
      if (upErr) throw upErr;

      toast({
        title: finalId ? "Grupo asignado" : "Grupo quitado",
        description: finalId
          ? "El seguimiento ya considera las compras de todo el grupo."
          : "Este cliente vuelve a evaluarse por separado.",
      });
      qc.invalidateQueries({ queryKey: ["grupos_comerciales"] });
      qc.invalidateQueries({ queryKey: ["seguimiento_ventas"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "No se pudo guardar", description: e?.message || "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users2 className="h-4 w-4" /> Grupo comercial
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs font-light text-muted-foreground">
            Une varias razones sociales que en realidad son el mismo cliente
            {companyName ? <> (por ejemplo, <span className="font-medium">{companyName}</span>)</> : null}. El
            seguimiento tomará la compra más reciente de todo el grupo.
          </p>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Grupo</p>
            <SearchableSelect
              value={grupoId}
              onValueChange={setGrupoId}
              options={[
                { value: "", label: "Sin grupo" },
                ...grupos.map((g) => ({ value: g.id, label: g.nombre })),
                { value: "__nuevo__", label: "＋ Crear grupo nuevo…" },
              ]}
              placeholder="Selecciona un grupo…"
            />
          </div>
          {grupoId === "__nuevo__" && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Nombre del grupo nuevo
              </p>
              <Input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej. Grupo Altisa"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => guardar(grupoId === "" ? null : grupoId)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
