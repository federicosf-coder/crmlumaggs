import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRepurchaseDashboard, type EstatusRecompra, type RepurchaseCompany } from "@/hooks/useRepurchase";
import { formatCurrency } from "@/lib/formatters";
import { BackButton } from "@/components/BackButton";

const STATUS_LABEL: Record<EstatusRecompra, string> = {
  al_dia: "Al día",
  proximo: "Próximo",
  vencido: "Vencido",
  en_riesgo: "En riesgo",
  dormido: "Dormido",
  sin_historial: "Sin historial",
};

const STATUS_VARIANT: Record<EstatusRecompra, "default" | "secondary" | "destructive" | "outline"> = {
  al_dia: "secondary",
  proximo: "default",
  vencido: "destructive",
  en_riesgo: "destructive",
  dormido: "outline",
  sin_historial: "outline",
};

function BrandView({ marca }: { marca: "chevron" | "phillips66" }) {
  const { data = [], isLoading } = useRepurchaseDashboard(marca);

  const counts = data.reduce<Record<EstatusRecompra, number>>(
    (acc, c) => {
      acc[c.estatus] = (acc[c.estatus] ?? 0) + 1;
      return acc;
    },
    { al_dia: 0, proximo: 0, vencido: 0, en_riesgo: 0, dormido: 0, sin_historial: 0 }
  );

  const sections: { key: EstatusRecompra; title: string }[] = [
    { key: "proximo", title: "Próximas recompras" },
    { key: "vencido", title: "Recompras vencidas" },
    { key: "en_riesgo", title: "Clientes en riesgo" },
    { key: "dormido", title: "Clientes dormidos" },
    { key: "al_dia", title: "Clientes al día" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {sections.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{STATUS_LABEL[s.key]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts[s.key] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        sections.map((s) => {
          const rows = data.filter((c) => c.estatus === s.key);
          if (rows.length === 0) return null;
          return (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="text-base">
                  {s.title} <span className="text-muted-foreground font-normal">({rows.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Estatus</TableHead>
                      <TableHead>Última compra</TableHead>
                      <TableHead>Frecuencia</TableHead>
                      <TableHead>Próxima recompra</TableHead>
                      <TableHead className="text-right">Ticket prom.</TableHead>
                      <TableHead className="text-right">Facturas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((c: RepurchaseCompany) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.estatus]}>{STATUS_LABEL[c.estatus]}</Badge>
                        </TableCell>
                        <TableCell>{c.fecha_ultima_compra ?? "—"}</TableCell>
                        <TableCell>{c.frecuencia_dias ? `${c.frecuencia_dias} días` : "—"}</TableCell>
                        <TableCell>{c.proxima_recompra ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {c.ticket_promedio ? formatCurrency(c.ticket_promedio) : "—"}
                        </TableCell>
                        <TableCell className="text-right">{c.total_facturas}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

export default function CrmRepurchase() {
  const [tab, setTab] = useState<"chevron" | "phillips66">("chevron");
  return (
    <div className="space-y-6">
      <BackButton />
      <div>
        <h1 className="text-3xl font-bold">Recompra</h1>
        <p className="text-muted-foreground mt-1">
          Detección automática de ciclos de recompra por empresa vendedora
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "chevron" | "phillips66")}>
        <TabsList>
          <TabsTrigger value="chevron">Chevron (Lumaggs)</TabsTrigger>
          <TabsTrigger value="phillips66">Phillips 66 (Galsa)</TabsTrigger>
        </TabsList>
        <TabsContent value="chevron" className="mt-6">
          <BrandView marca="chevron" />
        </TabsContent>
        <TabsContent value="phillips66" className="mt-6">
          <BrandView marca="phillips66" />
        </TabsContent>
      </Tabs>
    </div>
  );
}