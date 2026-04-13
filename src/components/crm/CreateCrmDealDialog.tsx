import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCrmDeal } from "@/hooks/useCrmDeals";
import { CrmPipelineStage } from "@/hooks/useCrmPipelines";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateCrmDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: CrmPipelineStage[];
  defaultStageId?: string;
}

export function CreateCrmDealDialog({ open, onOpenChange, pipelineId, stages, defaultStageId }: CreateCrmDealDialogProps) {
  const { session } = useAuth();
  const createDeal = useCreateCrmDeal();
  const { toast } = useToast();

  const { data: companies } = useQuery({
    queryKey: ["companies-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name").eq("is_active", true).order("first_name");
      return data || [];
    },
  });

  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState(defaultStageId || stages[0]?.id || "");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("50");
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user || !title || !stageId) return;

    createDeal.mutate(
      {
        title,
        pipeline_id: pipelineId,
        stage_id: stageId,
        owner_id: session.user.id,
        created_by: session.user.id,
        company_id: companyId || null,
        contact_id: contactId || null,
        value: parseFloat(value) || 0,
        probability: parseInt(probability) || 50,
        close_date: closeDate || null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast({ title: "Negocio creado", description: `"${title}" agregado al pipeline` });
          onOpenChange(false);
          setTitle(""); setCompanyId(""); setContactId(""); setValue(""); setProbability("50"); setCloseDate(""); setNotes("");
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo crear el negocio", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Negocio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deal-title">Título del Negocio *</Label>
            <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Venta lubricantes industriales" required maxLength={200} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-value">Valor ($)</Label>
              <Input id="deal-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {contacts?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deal-probability">Probabilidad (%)</Label>
              <Input id="deal-probability" type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-close-date">Fecha de Cierre</Label>
              <Input id="deal-close-date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-notes">Notas</Label>
            <Textarea id="deal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles adicionales..." rows={3} maxLength={2000} />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Negocio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
