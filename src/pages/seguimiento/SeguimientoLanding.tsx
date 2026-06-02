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
          className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
          onClick={() => navigate("/seguimiento/chevron")}
        >
          <CardContent className="p-8 text-center space-y-2">
            <h2 className="text-2xl font-bold">Chevron</h2>
            <p className="text-muted-foreground">Lumaggs</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
          onClick={() => navigate("/seguimiento/phillips66")}
        >
          <CardContent className="p-8 text-center space-y-2">
            <h2 className="text-2xl font-bold">Phillips 66</h2>
            <p className="text-muted-foreground">Galsa</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}