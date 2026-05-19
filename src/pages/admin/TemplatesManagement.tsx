import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageBanner } from "@/components/PageBanner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Power, Search, FileText, MessageCircle, Paperclip, Eye, FileSignature } from "lucide-react";
import { CATEGORY_LABELS, Template, TemplateCategory, TemplateType } from "@/lib/templates";
import { TemplateFormDialog } from "@/components/templates/TemplateFormDialog";
import { TemplatePreviewDialog } from "@/components/templates/TemplatePreviewDialog";
import CreditoFormatosEditor from "@/pages/credito/CreditoFormatosEditor";

export default function TemplatesManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"all" | TemplateType | "credito">("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TemplateCategory>("all");
  const [editing, setEditing] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("templates")
        .select("*, template_attachments(id)")
        .order("type").order("category").order("name");
      if (error) throw error;
      return (data || []) as (Template & { template_attachments?: { id: string }[] })[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (templates || []).filter(t =>
      (tab === "all" || t.type === tab) &&
      (categoryFilter === "all" || t.category === categoryFilter) &&
      (!s || t.name.toLowerCase().includes(s) || t.body.toLowerCase().includes(s) || (t.subject || "").toLowerCase().includes(s))
    );
  }, [templates, tab, categoryFilter, search]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: Template) => { setEditing(t); setDialogOpen(true); };

  const duplicate = async (t: Template) => {
    if (!user) return;
    const { error } = await (supabase as any).from("templates").insert({
      name: `Copia de ${t.name}`,
      type: t.type,
      category: t.category,
      subject: t.subject,
      body: t.body,
      description: t.description,
      to_emails: (t as any).to_emails ?? null,
      cc_emails: (t as any).cc_emails ?? null,
      bcc_emails: (t as any).bcc_emails ?? null,
      reply_to: (t as any).reply_to ?? null,
      is_active: t.is_active,
      created_by: user.id,
      updated_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Plantilla duplicada correctamente");
    refetch();
  };

  const toggleActive = async (t: Template) => {
    const { error } = await (supabase as any).from("templates")
      .update({ is_active: !t.is_active, updated_by: user?.id }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t.is_active ? "Plantilla desactivada" : "Plantilla activada");
    refetch();
  };

  const remove = async (t: Template) => {
    const { count } = await (supabase as any)
      .from("crm_activities").select("*", { count: "exact", head: true }).eq("template_id", t.id);
    if ((count || 0) > 0) {
      toast.error("No se puede eliminar: la plantilla está en uso. Desactívala en su lugar.");
      return;
    }
    if (!confirm(`¿Eliminar "${t.name}"?`)) return;
    const { error } = await (supabase as any).from("templates").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Plantilla eliminada");
    refetch();
  };

  return (
    <>
      <PageBanner title="Plantillas" description="Centraliza plantillas de email y WhatsApp para reutilizar en cotizaciones, cobranza, recompra y más." />

      <div className="space-y-4 px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="email"><FileText className="h-3.5 w-3.5 mr-1" /> Email</TabsTrigger>
              <TabsTrigger value="whatsapp"><MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp (locales)</TabsTrigger>
              <TabsTrigger value="credito"><FileSignature className="h-3.5 w-3.5 mr-1" /> Formatos de crédito</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab !== "credito" && (
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nueva plantilla</Button>
          )}
        </div>

        {tab === "credito" ? (
          <CreditoFormatosEditor />
        ) : (
        <>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, asunto o mensaje" className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead>Adjuntos</TableHead>
                <TableHead>Última actualización</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin plantillas. Crea la primera con el botón "Nueva plantilla".</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {t.subject && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{t.subject}</div>}
                  </TableCell>
                  <TableCell>
                    {t.type === "email"
                      ? <Badge variant="outline"><FileText className="h-3 w-3 mr-1" /> Email</Badge>
                      : <Badge variant="outline"><MessageCircle className="h-3 w-3 mr-1" /> WhatsApp (locales)</Badge>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{CATEGORY_LABELS[t.category]}</Badge></TableCell>
                  <TableCell>{t.is_active ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}</TableCell>
                  <TableCell>
                    {((t as any).template_attachments?.length ?? 0) > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <Paperclip className="h-3 w-3" /> {(t as any).template_attachments.length}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setPreviewing(t); setPreviewOpen(true); }} title="Previsualizar"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => duplicate(t)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(t)} title={t.is_active ? "Desactivar" : "Activar"}><Power className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        </>
        )}
      </div>

      <TemplateFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={refetch} />
      <TemplatePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} template={previewing} />
    </>
  );
}