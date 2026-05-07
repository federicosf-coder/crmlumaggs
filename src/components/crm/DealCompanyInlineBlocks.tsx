import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Users, Tag } from "lucide-react";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { INDUSTRIAS_OPTIONS, TIPO_CLIENTE_OPTIONS } from "@/components/CompanyFormDialog";
import { X } from "lucide-react";

interface Props { companyId: string }

export function DealCompanyInlineBlocks({ companyId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["deal-inline-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, industrias, tipo_cliente_comercial")
        .eq("id", companyId)
        .maybeSingle();
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["deal-inline-contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, job_title, email, phone, mobile")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
  });

  const updateCompany = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-inline-company", companyId] });
      toast({ title: "Empresa actualizada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const industrias: string[] = company?.industrias || [];

  const removeIndustria = (val: string) => {
    updateCompany.mutate({ industrias: industrias.filter((i) => i !== val) });
  };
  const addIndustria = (val: string) => {
    if (!val || industrias.includes(val)) return;
    updateCompany.mutate({ industrias: [...industrias, val] });
  };

  return (
    <div className="space-y-3">
      {/* Contactos */}
      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Users className="h-3.5 w-3.5" /> Contactos
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setContactDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Agregar
          </Button>
        </div>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin contactos.</p>
        ) : (
          <div className="space-y-1">
            {contacts.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {c.first_name} {c.last_name}
                    {c.job_title && <span className="text-muted-foreground font-normal"> — {c.job_title}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.email || "—"} · {c.phone || c.mobile || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Industrias */}
      <Card className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Briefcase className="h-3.5 w-3.5" /> Industrias
        </div>
        <div className="flex flex-wrap gap-1">
          {industrias.length === 0 && <span className="text-xs text-muted-foreground">Sin industrias.</span>}
          {industrias.map((i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1">
              {i}
              <button type="button" onClick={() => removeIndustria(i)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Select value="" onValueChange={addIndustria}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Agregar industria..." /></SelectTrigger>
          <SelectContent>
            {INDUSTRIAS_OPTIONS.filter((o) => !industrias.includes(o)).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Clasificación Comercial */}
      <Card className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Tag className="h-3.5 w-3.5" /> Clasificación Comercial
        </div>
        <Select
          value={company?.tipo_cliente_comercial || ""}
          onValueChange={(v) => updateCompany.mutate({ tipo_cliente_comercial: v || null })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
          <SelectContent>
            {TIPO_CLIENTE_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <ContactFormDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        defaultCompanyId={companyId}
        onCreated={() => qc.invalidateQueries({ queryKey: ["deal-inline-contacts", companyId] })}
      />
    </div>
  );
}