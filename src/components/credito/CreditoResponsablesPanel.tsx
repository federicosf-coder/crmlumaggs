import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Users, UserPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

function initials(name?: string | null) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function CreditoResponsablesPanel({ creditId }: { creditId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: responsables = [], isLoading } = useQuery({
    queryKey: ["credit_responsables", creditId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("credit_request_responsables")
        .select("id, user_id, created_at")
        .eq("credit_request_id", creditId);
      if (error) throw error;
      const ids = (rows || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [] as any[];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      const byId = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return (rows || []).map((r: any) => ({
        ...r,
        profile: byId.get(r.user_id) || null,
      }));
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["profiles_active_for_credito"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data || []).filter((p: any) => p.user_id);
    },
  });

  const assignedIds = useMemo(
    () => new Set((responsables as any[]).map((r) => r.user_id)),
    [responsables]
  );

  const options = useMemo(
    () =>
      (allUsers as any[])
        .filter((u) => !assignedIds.has(u.user_id))
        .map((u) => ({
          value: u.user_id,
          label: u.full_name || u.email || u.user_id,
          searchText: `${u.full_name || ""} ${u.email || ""}`,
        })),
    [allUsers, assignedIds]
  );

  const handleAdd = async (userId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("credit_request_responsables")
      .insert({ credit_request_id: creditId, user_id: userId, assigned_by: user?.id });
    if (error) {
      toast.error("No se pudo asignar: " + error.message);
      return;
    }
    toast.success("Responsable agregado");
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["credit_responsables", creditId] });
  };

  const handleRemove = async (id: string) => {
    if ((responsables as any[]).length <= 1) {
      toast.error("Debe haber al menos un responsable");
      return;
    }
    setPendingId(id);
    const { error } = await supabase
      .from("credit_request_responsables")
      .delete()
      .eq("id", id);
    setPendingId(null);
    if (error) {
      toast.error("No se pudo quitar: " + error.message);
      return;
    }
    toast.success("Responsable removido");
    qc.invalidateQueries({ queryKey: ["credit_responsables", creditId] });
  };

  return (
    <div className="pt-4 border-t border-violet-200/60 mt-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-violet-700" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-900">
            Responsables
          </p>
          <span className="text-[10px] text-muted-foreground">
            ({(responsables as any[]).length})
          </span>
        </div>
        {!adding ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            className="h-7 text-[10px] gap-1 border-violet-300 text-violet-700 hover:bg-violet-100"
          >
            <UserPlus className="h-3 w-3" />
            Agregar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAdding(false)}
            className="h-7 text-[10px]"
          >
            Cancelar
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-2">
          <SearchableSelect
            value=""
            onValueChange={handleAdd}
            options={options}
            placeholder="Buscar usuario..."
            className="h-8 text-xs bg-white"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
        )}
        {!isLoading && (responsables as any[]).length === 0 && (
          <span className="text-[11px] text-muted-foreground italic">
            Sin responsables asignados
          </span>
        )}
        {(responsables as any[]).map((r: any) => {
          const name =
            r.profile?.full_name || r.profile?.email || "Usuario sin perfil";
          return (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-1 py-0.5 rounded-full bg-white border border-violet-300 text-violet-800 text-[11px] shadow-sm"
            >
              <span className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white text-[9px] font-semibold flex items-center justify-center">
                {initials(name)}
              </span>
              <span className="font-medium pr-1">{name}</span>
              <button
                type="button"
                onClick={() => handleRemove(r.id)}
                disabled={pendingId === r.id}
                className="h-4 w-4 rounded-full hover:bg-violet-100 flex items-center justify-center text-violet-500 hover:text-violet-800 transition-colors disabled:opacity-40"
                title="Quitar responsable"
              >
                {pendingId === r.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}