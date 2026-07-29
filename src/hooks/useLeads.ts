import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type LeadEstatus =
  | "nuevo"
  | "pendiente_atencion"
  | "alerta"
  | "frio"
  | "recuperacion"
  | "atendido"
  | "descartado";

export interface Lead {
  id: string;
  source_id: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  empresa_nombre: string | null;
  mensaje: string | null;
  interes: string | null;
  ciudad: string | null;
  estado_region: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  page_url: string | null;
  contact_id: string | null;
  company_id: string | null;
  crm_task_id: string | null;
  estatus: LeadEstatus;
  responsable_id: string | null;
  tomado_at: string | null;
  primer_contacto_at: string | null;
  descartado_motivo: string | null;
  created_at: string;
  lead_sources?: { nombre: string } | null;
}

export interface LeadSource {
  id: string;
  nombre: string;
  descripcion: string | null;
  dominio_permitido: string | null;
  api_key_prefix: string;
  plaza_id: string | null;
  marca: string | null;
  notificar_whatsapp: string | null;
  is_active: boolean;
  created_at: string;
}

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("*, lead_sources(nombre)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
    refetchInterval: 60000,
  });
}

export function usePendingLeadsCount() {
  return useQuery({
    queryKey: ["leads-pending-count"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("estatus", ["nuevo", "pendiente_atencion", "alerta", "frio", "recuperacion"]);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });
}

export function useLeadSources() {
  return useQuery({
    queryKey: ["lead-sources"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_sources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadSource[];
    },
  });
}

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const body = Array.from(bytes).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 40);
  return `lmg_${body}`;
}

export function useTomarLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (lead: Lead) => {
      if (!user) throw new Error("Sin sesión");
      const now = new Date().toISOString();
      const { data: task, error: taskErr } = await (supabase as any)
        .from("crm_tasks")
        .insert({
          user_id: user.id,
          title: `Primer contacto: ${lead.nombre}`,
          description: [
            lead.empresa_nombre ? `Empresa: ${lead.empresa_nombre}` : null,
            lead.telefono ? `Teléfono: ${lead.telefono}` : null,
            lead.email ? `Correo: ${lead.email}` : null,
            lead.interes ? `Interés: ${lead.interes}` : null,
            lead.mensaje ? `Mensaje: ${lead.mensaje}` : null,
            lead.lead_sources?.nombre ? `Origen: ${lead.lead_sources.nombre}` : null,
          ].filter(Boolean).join("\n"),
          due_date: now,
          contact_id: lead.contact_id,
          company_id: lead.company_id,
          priority: "high",
          task_type: "call",
        })
        .select("id")
        .single();
      if (taskErr) throw taskErr;

      const { error } = await (supabase as any)
        .from("leads")
        .update({
          estatus: "atendido",
          responsable_id: user.id,
          tomado_at: now,
          primer_contacto_at: now,
          crm_task_id: task.id,
        })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-pending-count"] });
      toast.success("Prospecto tomado y tarea de seguimiento creada");
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo tomar el prospecto"),
  });
}

export function useDescartarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await (supabase as any)
        .from("leads")
        .update({ estatus: "descartado", descartado_motivo: motivo, primer_contacto_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["leads-pending-count"] });
      toast.success("Prospecto descartado");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al descartar"),
  });
}
