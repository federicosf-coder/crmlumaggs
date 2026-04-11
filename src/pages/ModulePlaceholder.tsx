import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface Props {
  title: string;
  description: string;
}

export default function ModulePlaceholder({ title, description }: Props) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Construction className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">Próximamente</h2>
          <p className="text-sm text-muted-foreground/70 mt-2 max-w-md">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
