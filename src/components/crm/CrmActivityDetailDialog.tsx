import { useState, useEffect } from "react";
import { CrmActivity, useUpdateCrmActivity, useDeleteCrmActivity, ACTIVITY_TYPE_CONFIG, CrmActivityType } from "@/hooks/useCrmActivities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Pencil, X, Save, Trash2, Calendar, LinkIcon, Building2, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  activity: CrmActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrmActivityDetailDialog({ activity, open, onOpenChange }: Props) {
  const updateActivity = useUpdateCrmActivity();
  const deleteActivity = useDeleteCrmActivity();
  const { toast } = useToast();

  const { data: companies } = useQuery({
    queryKey: ["companies-picker-act"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .order("name")
        .limit(5000);
      return data || [];
    },
    enabled: open,
  });
  const { data: contacts } = useQuery({
    queryKey: ["contacts-picker-act"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name")
        .limit(5000);
      return data || [];
    },
    enabled: open,
  });
  const { data: deals } = useQuery({
    queryKey: ["crm-deals-picker-act"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_deals")
        .select("id, title, company_id, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      return data || [];
    },
    enabled: open,
  });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<CrmActivityType>("note");
  const [editCompanyId, setEditCompanyId] = useState("none");
  const [editDealId, setEditDealId] = useState("none");
  const [editContactId, setEditContactId] = useState("none");

  useEffect(() => {
    if (activity && editing) {
      setEditTitle(activity.title);
      setEditDescription(activity.description || "");
      setEditType(activity.type);
      // Empresa: usar la del activity, o derivar de la del negocio si no existe
      const dealMatch = (deals || []).find((d: any) => d.id === activity.deal_id);
      setEditCompanyId(activity.company_id || dealMatch?.company_id || "none");
      setEditDealId(activity.deal_id || "none");
      setEditContactId(activity.contact_id || "none");
    }
  }, [activity, editing, deals]);

  // Negocios filtrados por empresa seleccionada
  const filteredDeals = (deals || []).filter((d: any) =>
    editCompanyId !== "none" ? d.company_id === editCompanyId : true
  );

  // Cuando cambia la empresa, si el negocio actual no pertenece a esa empresa,
  // selecciona automáticamente el último negocio activo de la empresa.
  useEffect(() => {
    if (!editing || editCompanyId === "none") return;
    const current = (deals || []).find((d: any) => d.id === editDealId);
    if (current && current.company_id === editCompanyId) return;
    const latest = (deals || []).find((d: any) => d.company_id === editCompanyId);
    setEditDealId(latest ? latest.id : "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCompanyId, editing, deals]);

  if (!activity) return null;
  const config = ACTIVITY_TYPE_CONFIG[activity.type] || ACTIVITY_TYPE_CONFIG.note;

  const handleSave = () => {
    const finalTitle = editType === "call" ? (editTitle?.trim() || "Llamada") : editTitle;
    updateActivity.mutate(
      {
        id: activity.id,
        title: finalTitle,
        description: editDescription || null,
        type: editType,
        company_id: editCompanyId !== "none" ? editCompanyId : null,
        deal_id: editDealId !== "none" ? editDealId : null,
        contact_id: editContactId !== "none" ? editContactId : null,
      } as any,
      {
        onSuccess: () => { toast({ title: "Actividad actualizada" }); setEditing(false); onOpenChange(false); },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    deleteActivity.mutate(activity.id, {
      onSuccess: () => { toast({ title: "Actividad eliminada" }); onOpenChange(false); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(false); onOpenChange(o); }}>
      <DialogContent
        className="sm:max-w-md p-0 max-h-[90vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
          <DialogTitle className="text-lg font-semibold truncate">{activity.title}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)}>
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-4 overflow-y-auto flex-1">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editType} onValueChange={(v) => setEditType(v as CrmActivityType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_TYPE_CONFIG).filter(([k]) => k !== "task").map(([k, c]) => (
                      <SelectItem key={k} value={k}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editType !== "call" && (
                <div className="space-y-2"><Label>Título</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required /></div>
              )}
              <div className="space-y-2"><Label>Descripción</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} /></div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Select value={editCompanyId} onValueChange={setEditCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna</SelectItem>
                    {companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Negocio</Label>
                <Select value={editDealId} onValueChange={setEditDealId}>
                  <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {filteredDeals.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Select value={editContactId} onValueChange={setEditContactId}>
                  <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateActivity.isPending}><Save className="h-4 w-4 mr-1" /> Guardar</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="outline">{config.emoji} {config.label}</Badge>
              {activity.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activity.description}</p>}
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{format(parseISO(activity.activity_date || activity.created_at), "d MMM yyyy h:mm a", { locale: es })}</span>
                </div>
                {activity.companies && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Empresa:</span>
                    <span>{activity.companies.name}</span>
                  </div>
                )}
                {activity.crm_deals && (
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Negocio:</span>
                    <span>{activity.crm_deals.title}</span>
                  </div>
                )}
                {activity.contacts && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Contacto:</span>
                    <span>{activity.contacts.first_name} {activity.contacts.last_name}</span>
                  </div>
                )}
              </div>
              <Separator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Eliminar</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
                    <AlertDialogDescription>Se eliminará permanentemente esta actividad.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}