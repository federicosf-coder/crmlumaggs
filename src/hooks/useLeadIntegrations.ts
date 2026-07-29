import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeadIntegration = {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  source_id: string | null;
  automation_id: string | null;
  is_active: boolean;
  created_at: string;
  lead_sources?: { nombre: string } | null;
  automations?: { name: string } | null;
};

export type LeadIntegrationPage = {
  id: string;
  integration_id: string;
  page_id: string;
  page_name: string | null;
  tiene_token: boolean;
  subscribed_at: string | null;
  is_active: boolean;
};

export type LeadIntegrationForm = {
  id: string;
  integration_id: string;
  page_id: string;
  form_id: string;
  form_name: string | null;
  field_map: Record<string, string>;
  is_active: boolean;
};

export type LeadIntegrationEvent = {
  id: string;
  integration_id: string | null;
  page_id: string | null;
  form_id: string | null;
  leadgen_id: string | null;
  resultado: string;
  error: string | null;
  lead_id: string | null;
  created_at: string;
};

const db = supabase as any;

export function useLeadIntegrations() {
  return useQuery({
    queryKey: ["lead_integrations"],
    queryFn: async (): Promise<LeadIntegration[]> => {
      const { data, error } = await db
        .from("lead_integrations")
        .select("*, lead_sources(nombre), automations(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadIntegration[];
    },
  });
}

export function useLeadIntegrationPages() {
  return useQuery({
    queryKey: ["lead_integration_pages"],
    queryFn: async (): Promise<LeadIntegrationPage[]> => {
      const { data, error } = await db.rpc("list_lead_integration_pages");
      if (error) throw error;
      return (data ?? []) as LeadIntegrationPage[];
    },
  });
}

export function useLeadIntegrationForms() {
  return useQuery({
    queryKey: ["lead_integration_forms"],
    queryFn: async (): Promise<LeadIntegrationForm[]> => {
      const { data, error } = await db.from("lead_integration_forms").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as LeadIntegrationForm[];
    },
  });
}

export function useLeadIntegrationEvents(integrationId?: string) {
  return useQuery({
    queryKey: ["lead_integration_events", integrationId ?? "all"],
    queryFn: async (): Promise<LeadIntegrationEvent[]> => {
      let q = db.from("lead_integration_events").select("*").order("created_at", { ascending: false }).limit(50);
      if (integrationId) q = q.eq("integration_id", integrationId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadIntegrationEvent[];
    },
    enabled: true,
  });
}

export function useSaveIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<LeadIntegration> & { nombre: string }) => {
      const { id, ...rest } = payload as any;
      delete rest.lead_sources;
      delete rest.automations;
      delete rest.created_at;
      if (id) {
        const { error } = await db.from("lead_integrations").update(rest).eq("id", id);
        if (error) throw error;
        return id as string;
      }
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await db
        .from("lead_integrations")
        .insert({ ...rest, created_by: userRes?.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_integrations"] }),
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("lead_integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead_integrations"] });
      qc.invalidateQueries({ queryKey: ["lead_integration_pages"] });
      qc.invalidateQueries({ queryKey: ["lead_integration_forms"] });
    },
  });
}

export function useSaveIntegrationForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<LeadIntegrationForm> & { integration_id: string; page_id: string; form_id: string }) => {
      const { error } = await db.from("lead_integration_forms").upsert(row, { onConflict: "page_id,form_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_integration_forms"] }),
  });
}

export function useDeleteIntegrationForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("lead_integration_forms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_integration_forms"] }),
  });
}

/** Llama a la función de servidor que encapsula la Graph API de Meta. */
export async function fbAdmin<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("facebook-graph-admin", {
    body: { action, ...params },
  });
  if (error) {
    const detail = (error as any)?.context ? await (error as any).context.text() : error.message;
    throw new Error(detail || error.message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}