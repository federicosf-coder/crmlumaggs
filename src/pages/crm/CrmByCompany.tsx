import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Search, Briefcase, Activity as ActivityIcon } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { fetchAllRows } from "@/lib/supabasePagination";

export default function CrmByCompany() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: companies, isLoading } = useQuery({
    queryKey: ["crm-by-company-list"],
    queryFn: async () => {
      const rows = await fetchAllRows<any>((from, to) =>
        supabase
          .from("companies")
          .select("id, name, industry, city, state")
          .eq("is_active", true)
          .order("name")
          .range(from, to)
      );
      return rows;
    },
  });

  const { data: deals } = useQuery({
    queryKey: ["crm-by-company-deals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_deals")
        .select("id, company_id, pipeline_type, stage_id, value, crm_pipelines(marca)");
      return data || [];
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["crm-by-company-activities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_activities")
        .select("id, company_id, type, activity_date")
        .order("activity_date", { ascending: false })
        .limit(2000);
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const map = new Map<string, { primera: number; recompra: number; chevron: number; phillips66: number; activities: number; lastActivity: string | null; }>();
    deals?.forEach((d: any) => {
      if (!d.company_id) return;
      const cur = map.get(d.company_id) || { primera: 0, recompra: 0, chevron: 0, phillips66: 0, activities: 0, lastActivity: null };
      if (d.pipeline_type === "primera_compra") cur.primera += 1;
      if (d.pipeline_type === "recompra") cur.recompra += 1;
      const marca = d.crm_pipelines?.marca;
      if (marca === "chevron") cur.chevron += 1;
      if (marca === "phillips66") cur.phillips66 += 1;
      map.set(d.company_id, cur);
    });
    activities?.forEach((a: any) => {
      if (!a.company_id) return;
      const cur = map.get(a.company_id) || { primera: 0, recompra: 0, chevron: 0, phillips66: 0, activities: 0, lastActivity: null };
      cur.activities += 1;
      if (!cur.lastActivity || (a.activity_date && a.activity_date > cur.lastActivity)) cur.lastActivity = a.activity_date;
      map.set(a.company_id, cur);
    });
    return map;
  }, [deals, activities]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = companies || [];
    if (!q) return list;
    return list.filter((c: any) =>
      [c.name, c.industry, c.city, c.state].filter(Boolean).some((v: string) => v.toLowerCase().includes(q))
    );
  }, [companies, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BackButton fallback="/crm" label="Volver al CRM" />
      </div>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7" /> CRM por Empresa
        </h1>
        <p className="text-muted-foreground mt-1">Resumen de negocios y actividad por cliente</p>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa, industria, ciudad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 opacity-40 mb-3" />
          <p>Sin empresas que coincidan</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => {
            const s = stats.get(c.id) || { primera: 0, recompra: 0, chevron: 0, phillips66: 0, activities: 0, lastActivity: null };
            const total = s.primera + s.recompra;
            return (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => window.open(`/directory?company=${c.id}`, "_blank")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base truncate">{c.name}</CardTitle>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.industry, c.city, c.state].filter(Boolean).join(" · ") || "Sin clasificación"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{total} negocio{total === 1 ? "" : "s"}</span>
                    {s.primera > 0 && <Badge variant="secondary">1ra: {s.primera}</Badge>}
                    {s.recompra > 0 && <Badge variant="secondary">Recompra: {s.recompra}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{s.activities} actividad{s.activities === 1 ? "" : "es"}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {s.chevron > 0 && <Badge variant="outline">Chevron</Badge>}
                    {s.phillips66 > 0 && <Badge variant="outline">Phillips 66</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}