import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowLeft, Search, FileText, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Categoria = "Comparativo" | "Guía de Venta" | "Buscador";
type Guia = {
  id: string;
  titulo: string;
  resumen: string;
  categoria: Categoria;
  file: string; // ruta pública dentro de /public/guias
};

const GUIAS: Guia[] = [
  {
    id: "motor-comp",
    titulo: "Aceites de Motor Chevron — Cuadro Comparativo",
    resumen: "Comparativo de líneas Delo, Havoline y Ursa para uso automotriz y pesado.",
    categoria: "Comparativo",
    file: "/guias/lumaggs_motor_comparacion.html",
  },
  {
    id: "motor-guia",
    titulo: "Guía de Ventas — Aceites de Motor Chevron",
    resumen: "Argumentos de venta, beneficios clave y manejo de objeciones para motores.",
    categoria: "Guía de Venta",
    file: "/guias/lumaggs_motor_guia_ventas.html",
  },
  {
    id: "hidra-comp",
    titulo: "Aceites Hidráulicos Chevron — Cuadro Comparativo",
    resumen: "Líneas Rando y Clarity comparadas por viscosidad, aditivos y aplicación.",
    categoria: "Comparativo",
    file: "/guias/lumaggs_hidraulicos_comparacion.html",
  },
  {
    id: "hidra-guia",
    titulo: "Guía de Ventas — Aceites Hidráulicos Chevron",
    resumen: "Cómo recomendar hidráulicos según equipo, ambiente y normas OEM.",
    categoria: "Guía de Venta",
    file: "/guias/lumaggs_hidraulicos_guia_ventas.html",
  },
  {
    id: "trans-comp",
    titulo: "Lubricantes de Transmisión Chevron — Comparativo",
    resumen: "ATF, MTF y diferenciales: especificaciones y equivalencias.",
    categoria: "Comparativo",
    file: "/guias/lumaggs_transmisiones_comparacion.html",
  },
  {
    id: "trans-guia",
    titulo: "Guía de Ventas — Transmisiones Chevron",
    resumen: "Argumentos y casos de uso para venta de lubricantes de transmisión.",
    categoria: "Guía de Venta",
    file: "/guias/lumaggs_transmisiones_guia_ventas.html",
  },
  {
    id: "motor-chev",
    titulo: "Cuadro Comparativo Aceites de Motor Chevron (extendido)",
    resumen: "Vista detallada con especificaciones API, ACEA y OEM por producto.",
    categoria: "Comparativo",
    file: "/guias/lumaggs_chevron_motor_oils.html",
  },
  {
    id: "buscador",
    titulo: "Buscador de Aceite por Equipo",
    resumen: "Herramienta para localizar el aceite recomendado según marca/modelo de equipo.",
    categoria: "Buscador",
    file: "/guias/lumaggs_buscador_por_equipo.html",
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
        <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-3 border-b bg-gradient-to-r from-violet-50 to-blue-50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-base">{selected?.titulo}</DialogTitle>
                {selected && (
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                    {selected.categoria}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {selected && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={selected.file} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir en pestaña
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-white">
            {selected && (
              <iframe
                src={selected.file}
                title={selected.titulo}
                className="w-full h-full border-0"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}