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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CompanyFormDialog } from "@/components/CompanyFormDialog";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ExternalLink } from "lucide-react";

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
  const [closeDate, setCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

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
        close_date: closeDate || null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast({ title: "Negocio creado", description: `"${title}" agregado al pipeline` });
          onOpenChange(false);
          setTitle(""); setCompanyId(""); setContactId(""); setValue(""); setCloseDate(""); setNotes("");
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo crear el negocio", variant: "destructive" });
        },
      }
    );
  };

  const openInNewTab = (path: string) => window.open(path, "_blank", "noopener,noreferrer");

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
              <Label htmlFor="deal-value">Unidades Eq. Mensuales</Label>
              <Input id="deal-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={companyId}
                  onValueChange={setCompanyId}
                  options={(companies || []).map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Buscar empresa..."
                />
              </div>
              <Button type="button" variant="outline" size="icon" title="Nueva empresa" onClick={() => setCompanyDialogOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" title="Abrir empresa" disabled={!companyId} onClick={() => companyId && openInNewTab(`/directory?tab=companies&select=${companyId}`)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contacto</Label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={contactId}
                  onValueChange={setContactId}
                  options={(contacts || []).map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                  placeholder="Buscar contacto..."
                />
              </div>
              <Button type="button" variant="outline" size="icon" title="Nuevo contacto" onClick={() => setContactDialogOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" title="Abrir contacto" disabled={!contactId} onClick={() => contactId && openInNewTab(`/directory?tab=contacts&select=${contactId}`)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-close-date">Fecha de Cierre</Label>
            <Input id="deal-close-date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
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

      <CompanyFormDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        onCreated={(id) => setCompanyId(id)}
      />
      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={companyId || undefined}
        onCreated={(id) => setContactId(id)}
      />
    </Dialog>
  );
}
