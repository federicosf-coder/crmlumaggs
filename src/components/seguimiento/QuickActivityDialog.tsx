import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ExternalLink, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabasePagination";
import { useAuth } from "@/contexts/AuthContext";
import { TASK_TYPES, TASK_TYPE_LABEL, TaskTypeKey } from "@/lib/taskTypes";
import { cn } from "@/lib/utils";
import { DictadoButton } from "@/components/DictadoButton";
import { format } from "date-fns";

interface QuickActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBrand: "lumaggs_chevron" | "galsa_phillips66";
  onSaved?: () => void;
  editActivity?: { id: string; company_id: string; type: string; description: string | null } | null;
}

export function QuickActivityDialog({ open, onOpenChange, onSaved, editActivity }: QuickActivityDialogProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState<string>("");
  const [type, setType] = useState<TaskTypeKey>("call");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);

  useEffect(() => {
    if (open && editActivity) {
      setCompanyId(editActivity.company_id);
      setType((editActivity.type as TaskTypeKey) || "call");
      setDescription(editActivity.description || "");
    }
  }, [open, editActivity]);

  const { data: companies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () =>
      await fetchAllRows<any>((from, to) =>
        supabase.from("companies").select("id, name, razon_social").eq("is_active", true).order("name").range(from, to)
      ),
  });

  const reset = () => {
    setCompanyId("");
    setType("call");
    setDescription("");
  };

  const handleSave = async () => {
    if (!companyId) {
      toast.error("Selecciona una empresa");
      return;
    }
    if (!session?.user?.id) {
      toast.error("Sesión no válida");
      return;
    }
    setSaving(true);
    if (editActivity) {
      const { error } = await supabase
        .from("crm_activities")
        .update({
          company_id: companyId,
          type,
          title: TASK_TYPE_LABEL[type],
          description: description || null,
        })
        .eq("id", editActivity.id);
      setSaving(false);
      if (error) {
        toast.error("No se pudo guardar la actividad: " + error.message);
        return;
      }
      toast.success("Actividad actualizada");
    } else {
      const { error } = await supabase.from("crm_activities").insert({
        company_id: companyId,
        user_id: session.user.id,
        type,
        title: TASK_TYPE_LABEL[type],
        description: description || null,
        activity_date: new Date().toISOString(),
      });
      setSaving(false);
      if (error) {
        toast.error("No se pudo registrar la actividad: " + error.message);
        return;
      }
      toast.success("Actividad registrada");
    }
    reset();
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editActivity ? "Editar actividad" : "Registrar actividad"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Empresa *</Label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setCompanyDialogOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Nueva
                </Button>
                {companyId && (
                  <a
                    href={`/directory?tab=companies&select=${companyId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 h-6"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver
                  </a>
                )}
              </div>
            </div>
            <SearchableSelect
              value={companyId}
              onValueChange={setCompanyId}
              options={(companies || []).map((c: any) => companyOption(c))}
              placeholder="Buscar empresa..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo *</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {TASK_TYPES.filter((t) => t.key !== "cobranza").map(({ key, label, Icon, soft, active }) => {
                const selected = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    title={label}
                    aria-pressed={selected}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-md border p-1.5 transition-all",
                      selected ? active : soft
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-medium leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</Label>
              <DictadoButton onResult={(texto) => setDescription((prev) => (prev ? prev + " " : "") + texto)} />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué se hizo?"
              rows={3}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">Hoy, {format(new Date(), "HH:mm")}</p>

          <div className="space-y-2">
            <Button className="w-full" size="lg" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editActivity ? "Guardar cambios" : "Guardar"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {companyDialogOpen && (
      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        onCreated={(newId) => {
          queryClient.invalidateQueries({ queryKey: ["companies-picker"] });
          setCompanyId(newId);
        }}
      />
    )}
    </>
  );
}
