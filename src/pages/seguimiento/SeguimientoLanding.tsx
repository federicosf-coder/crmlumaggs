import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PageBanner } from "@/components/PageBanner";
import { TrendingUp } from "lucide-react";

export default function SeguimientoLanding() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageBanner
        title="Seguimiento a Ventas"
        description="Selecciona la marca para dar seguimiento a tus clientes"
        avatar={
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer hover:shadow-lg transition-all border-2 border-blue-200 hover:border-blue-400 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/60"
          onClick={() => navigate("/seguimiento/chevron")}
        >
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">C</span>
            </div>
            <h2 className="text-2xl font-bold text-blue-900">Chevron</h2>
            <p className="text-blue-600/80 font-medium">Lumaggs</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-lg transition-all border-2 border-red-200 hover:border-red-400 bg-gradient-to-br from-red-50/80 via-white to-rose-50/60"
          onClick={() => navigate("/seguimiento/phillips66")}
        >
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 font-bold text-xl">P66</span>
            </div>
            <h2 className="text-2xl font-bold text-red-900">Phillips 66</h2>
            <p className="text-red-600/80 font-medium">Galsa</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}