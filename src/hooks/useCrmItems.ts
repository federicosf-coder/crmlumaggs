import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CrmItemKind = "tarea" | "actividad";
export type CrmItemStatus = "pendiente" | "en_progreso" | "completada" | "cancelada" | "vencida";
export type CrmItemPriority = "baja" | "media" | "alta" | "urgente";
export type CrmItemType =
  | "call" | "email" | "meeting" | "note" | "field_visit"
  | "whatsapp" | "follow_up" | "task" | "visita" | "otro";

export const CRM_ITEM_TYPE_CONFIG: Record<string, { emoji: string; label: string }> = {
  call: { emoji: "📞", label: "Llamada" },
  email: { emoji: "📧", label: "Correo" },
  meeting: { emoji: "📅", label: "Reunión" },
  note: { emoji: "📝", label: "Nota" },
  field_visit: { emoji: "🏢", label: "Visita de Campo" },
  visita: { emoji: "🏢", label: "Visita" },
  whatsapp: { emoji: "💬", label: "WhatsApp" },
  follow_up: { emoji: "🔄", label: "Seguimiento" },
  task: { emoji: "✅", label: "Tarea" },
  otro: { emoji: "📌", label: "Otro" },
};

export interface CrmItemUnified {
  id: string;
  kind: CrmItemKind;
  type: string;
  status: CrmItemStatus;
  priority: string;
  title: string;
  description: string | null;
  resultado: string | null;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  pipeline_id: string | null;
  created_by: string;
  assigned_to: string | null;
  completed_by: string | null;
  fecha_creacion: string;
  fecha_programada: string | null;
  fecha_vencimiento: string | null;
  fecha_terminacion: string | null;
  fecha_actividad: string | null;
  marca: string | null;
  origen: string | null;
  canal: string | null;
  source_table: "crm_items" | "crm_tasks" | "crm_activities";
  // Joined info (resolved client side)
  company_name?: string | null;
  contact_name?: string | null;
  deal_title?: string | null;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
}

export type CrmItemTab =
  | "hoy" | "pendientes" | "vencidas" | "completadas" | "creadas" | "todas";

export interface CrmItemsFilters {
  tab?: CrmItemTab;
  kind?: CrmItemKind | "todos";
  type?: string;
  marca?: string;
  userId?: string;       // assigned_to / created_by filter
  companyId?: string;
  dealId?: string;
  search?: string;
  page?: number;
  pageSize?: number | "all";
  showAll?: boolean;
}

export function useCrmItems(filters: CrmItemsFilters = {}) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["crm_items_unified", filters, userId],
    enabled: !!userId,
    queryFn: async () => {
      // RLS hace el filtrado de visibilidad. Aquí filtramos por tab/atributos.
      let q = supabase.from("crm_items_unified" as any).select("*");

      if (filters.kind && filters.kind !== "todos") q = q.eq("kind", filters.kind);
      if (filters.type) q = q.eq("type", filters.type);
      if (filters.marca) q = q.eq("marca", filters.marca);
      if (filters.companyId) q = q.eq("company_id", filters.companyId);
      if (filters.dealId) q = q.eq("deal_id", filters.dealId);

      const nowIso = new Date().toISOString();
      const startOfTodayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const endOfTodayIso = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

      switch (filters.tab) {
        case "hoy":
          q = q.gte("fecha_vencimiento", startOfTodayIso).lte("fecha_vencimiento", endOfTodayIso);
          break;
        case "pendientes":
          q = q.in("status", ["pendiente", "en_progreso"]);
          break;
        case "vencidas":
          q = q.eq("status", "pendiente").lt("fecha_vencimiento", nowIso);
          break;
        case "completadas":
          q = q.eq("status", "completada");
          break;
        case "creadas":
          if (userId) q = q.eq("created_by", userId);
          break;
        case "todas":
        default:
          break;
      }

      if (filters.userId) {
        q = q.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
      }

      if (filters.search) {
        q = q.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Order: pending by due date asc; otherwise by creation desc
      if (filters.tab === "completadas") {
        q = q.order("fecha_terminacion", { ascending: false, nullsFirst: false });
      } else if (filters.tab === "vencidas" || filters.tab === "hoy" || filters.tab === "pendientes") {
        q = q.order("fecha_vencimiento", { ascending: true, nullsFirst: false });
      } else {
        q = q.order("fecha_creacion", { ascending: false });
      }

      // Pagination
      const pageSize = filters.pageSize === "all" || filters.showAll ? null : (filters.pageSize ?? 10);
      const page = filters.page ?? 1;
      if (pageSize) {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        q = q.range(from, to);
      } else {
        q = q.limit(5000);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data || []) as CrmItemUnified[], count: count ?? null };
    },
  });
}

/** Count helper for tabs (small queries, head-only) */
export function useCrmItemsCount(tab: CrmItemTab) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  return useQuery({
    queryKey: ["crm_items_count", tab, userId],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase.from("crm_items_unified" as any).select("id", { count: "exact", head: true });
      const nowIso = new Date().toISOString();
      const startOfTodayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const endOfTodayIso = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
      switch (tab) {
        case "hoy":
          q = q.gte("fecha_vencimiento", startOfTodayIso).lte("fecha_vencimiento", endOfTodayIso);
          break;
        case "pendientes": q = q.in("status", ["pendiente", "en_progreso"]); break;
        case "vencidas": q = q.eq("status", "pendiente").lt("fecha_vencimiento", nowIso); break;
        case "completadas": q = q.eq("status", "completada"); break;
        case "creadas": if (userId) q = q.eq("created_by", userId); break;
        default: break;
      }
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useCreateCrmItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      kind: CrmItemKind;
      type: CrmItemType;
      title: string;
      description?: string | null;
      priority?: CrmItemPriority;
      company_id?: string | null;
      contact_id?: string | null;
      deal_id?: string | null;
      pipeline_id?: string | null;
      assigned_to?: string | null;
      fecha_programada?: string | null;
      fecha_vencimiento?: string | null;
      fecha_actividad?: string | null;
      marca?: string | null;
      origen?: string | null;
      canal?: string | null;
      created_by: string;
      status?: CrmItemStatus;
    }) => {
      const { data, error } = await supabase
        .from("crm_items")
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_items_unified"] });
      qc.invalidateQueries({ queryKey: ["crm_items_count"] });
    },
  });
}

export function useFinalizeCrmItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      source_table,
      resultado,
    }: { id: string; source_table: "crm_items" | "crm_tasks" | "crm_activities"; resultado?: string }) => {
      if (source_table === "crm_items") {
        const { error } = await supabase
          .from("crm_items")
          .update({
            status: "completada",
            resultado: resultado ?? null,
            fecha_terminacion: new Date().toISOString(),
          } as any)
          .eq("id", id);
        if (error) throw error;
      } else if (source_table === "crm_tasks") {
        const { error } = await supabase
          .from("crm_tasks")
          .update({ completed: true } as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        // actividades legacy ya están "completadas" por definición
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_items_unified"] });
      qc.invalidateQueries({ queryKey: ["crm_items_count"] });
    },
  });
}

export function useReopenCrmItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, source_table }: { id: string; source_table: string }) => {
      if (source_table === "crm_items") {
        const { error } = await supabase.from("crm_items").update({ status: "pendiente" } as any).eq("id", id);
        if (error) throw error;
      } else if (source_table === "crm_tasks") {
        const { error } = await supabase.from("crm_tasks").update({ completed: false } as any).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_items_unified"] });
      qc.invalidateQueries({ queryKey: ["crm_items_count"] });
    },
  });
}

export function useDeleteCrmItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, source_table }: { id: string; source_table: string }) => {
      const table = source_table === "crm_tasks" ? "crm_tasks"
        : source_table === "crm_activities" ? "crm_activities" : "crm_items";
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_items_unified"] });
      qc.invalidateQueries({ queryKey: ["crm_items_count"] });
    },
  });
}