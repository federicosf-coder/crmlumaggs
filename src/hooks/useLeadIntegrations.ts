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

export function useSaveIntegrationPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      integration_id: string;
      page_id: string;
      page_name?: string | null;
      page_access_token?: string | null;
      is_active?: boolean;
    }) => {
      const payload: Record<string, unknown> = {
        integration_id: row.integration_id,
        page_id: row.page_id,
        page_name: row.page_name ?? null,
        is_active: row.is_active ?? true,
      };
      if (row.page_access_token) payload.page_access_token = row.page_access_token;
      const { error } = await db
        .from("lead_integration_pages")
        .upsert(payload, { onConflict: "integration_id,page_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_integration_pages"] }),
  });
}

export function useDeleteIntegrationPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("lead_integration_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_integration_pages"] }),
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
    },
  });
}