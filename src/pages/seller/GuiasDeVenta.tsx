import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowLeft, Search, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Guia = {
  id: string;
  titulo: string;
  resumen: string;
  categoria: "Comparativo" | "Guía de Venta" | "Ficha Técnica";
  html: string;
};

// Placeholder content — el usuario subirá los HTML reales después.
const GUIAS: Guia[] = [
  {
    id: "demo-1",
    titulo: "Ejemplo: Comparativo de Aceites de Motor",
    resumen: "Comparación entre líneas Chevron y Phillips 66 para uso automotriz.",
    categoria: "Comparativo",
    html: `<div style="font-family: system-ui; padding: 1rem;">
      <h2>Comparativo de Aceites de Motor</h2>
      <p>Aquí irá el contenido HTML real que subas. Este es un ejemplo de cómo se visualizará.</p>
      <ul><li>Chevron Delo</li><li>Phillips 66 Guardol</li></ul>
    </div>`,
  },
  {
    id: "demo-2",
    titulo: "Ejemplo: Guía del Vendedor — Aceites Hidráulicos",
    resumen: "Argumentos de venta, objeciones comunes y casos de éxito.",
    categoria: "Guía de Venta",
    html: `<div style="font-family: system-ui; padding: 1rem;">
      <h2>Guía del Vendedor — Aceites Hidráulicos</h2>
      <p>Reemplaza este contenido con tu HTML real.</p>
    </div>`,
  },
];

export default function GuiasDeVenta() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Guia | null>(null);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GUIAS;
    return GUIAS.filter(
      (g) =>
        g.titulo.toLowerCase().includes(q) ||
        g.resumen.toLowerCase().includes(q) ||
        g.categoria.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/seller-portal">
              <ArrowLeft className="h-3.5 w-3.5" /> Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-indigo-600" />
              Guías de Venta
            </h1>
            <p className="text-sm text-muted-foreground">
              Comparativos por tipo de aceite y guías de venta para consulta del ejecutivo.
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar guía…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filtradas.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelected(g)}
            className="text-left"
          >
            <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-indigo-200 cursor-pointer">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {g.categoria}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold leading-snug line-clamp-2">
                  {g.titulo}
                </h3>
                <p className="text-[11px] text-muted-foreground line-clamp-3">
                  {g.resumen}
                </p>
              </CardContent>
            </Card>
          </button>
        ))}
        {filtradas.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground text-center py-10">
            No se encontraron guías con ese criterio.
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-blue-50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-lg">{selected?.titulo}</DialogTitle>
                {selected && (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
                    {selected.categoria}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-white">
            {selected && (
              <div
                className="prose prose-sm max-w-none p-6"
                dangerouslySetInnerHTML={{ __html: selected.html }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}