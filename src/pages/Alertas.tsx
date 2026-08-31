import { Link } from "react-router-dom";
import { Receipt, Truck, BadgeDollarSign, RefreshCw, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAlertasPendientes } from "@/hooks/useAlertasPendientes";
import { formatDate, formatCurrency } from "@/lib/formatters";

function Vacio() {
  return <p className="text-sm text-muted-foreground py-4">Nada pendiente aquí 🎉</p>;
}

export default function Alertas() {
  const {
    comprobantes,
    entregas,
    autorizaciones,
    rvsPersonas,
    totalCount,
    isLoading,
    verTodo,
    refetchAll,
  } = useAlertasPendientes();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alertas y Pendientes</h1>
          <p className="text-muted-foreground">Todo lo que necesita revisión, agrupado por tipo</p>
          <p className="text-xs text-muted-foreground mt-1">
            {verTodo
              ? "Mostrando alertas de todas las plazas (rol administrativo)"
              : "Mostrando solo alertas de tu plaza"}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchAll()} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" /> Comprobantes de pago por clasificar
            <Badge variant="secondary">{comprobantes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comprobantes.length === 0 ? (
            <Vacio />
          ) : (
            <div className="divide-y">
              {comprobantes.map((c) => (
                <Link
                  key={c.id}
                  to="/cobranza/chevron"
                  className="flex items-center gap-3 py-2 text-sm hover:bg-blue-50/40 px-2 -mx-2 rounded"
                >
                  <span className="text-muted-foreground w-24 shrink-0">{formatDate(c.created_at)}</span>
                  {c.canal && <Badge variant="outline" className="shrink-0">{c.canal}</Badge>}
                  <span className="flex-1 truncate">{c.nombre_detectado || "Sin nombre detectado"}</span>
                  <span className="font-medium shrink-0">
                    {c.monto_extraido != null ? formatCurrency(Number(c.monto_extraido)) : "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" /> Correos de Chevron por clasificar
            <Badge variant="secondary">{entregas.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entregas.length === 0 ? (
            <Vacio />
          ) : (
            <div className="divide-y">
              {entregas.map((e) => (
                <Link
                  key={e.id}
                  to="/entregas-corporativas"
                  className="flex items-center gap-3 py-2 text-sm hover:bg-blue-50/40 px-2 -mx-2 rounded"
                >
                  <span className="text-muted-foreground w-24 shrink-0">{formatDate(e.created_at)}</span>
                  <span className="flex-1 truncate">{e.cliente_detectado || "Cliente no detectado"}</span>
                  <span className="text-muted-foreground truncate max-w-[40%]">
                    {e.lugar_entrega_detectado || "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeDollarSign className="h-4 w-4" /> Pedidos por autorizar precio
            <Badge variant="secondary">{autorizaciones.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {autorizaciones.length === 0 ? (
            <Vacio />
          ) : (
            <div className="divide-y">
              {autorizaciones.map((a) => (
                <Link
                  key={a.id}
                  to="/autorizacion-precios"
                  className="flex items-center gap-3 py-2 text-sm hover:bg-blue-50/40 px-2 -mx-2 rounded"
                >
                  <span className="text-muted-foreground w-24 shrink-0">{formatDate(a.created_at)}</span>
                  <span className="font-medium shrink-0">{a.documentos?.numero_pedido || "—"}</span>
                  <span className="flex-1 truncate">{a.documentos?.companies?.name || "—"}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalCount === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No tienes pendientes por revisar.</p>
      )}
    </div>
  );
}
