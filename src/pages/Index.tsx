import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShoppingCart, FileText, Package, Truck, BookOpen,
  ArrowLeftRight, FolderKanban, Search, GraduationCap, Receipt, BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const modules = [
  { title: "Directory", description: "Companies & contacts", icon: BookOpen, url: "/directory", color: "bg-primary" },
  { title: "CRM Chevron", description: "Chevron lubricant sales", icon: ShoppingCart, url: "/crm/chevron", color: "bg-primary" },
  { title: "CRM Phillips 66", description: "Phillips 66 lubricant sales", icon: ShoppingCart, url: "/crm/phillips66", color: "bg-primary" },
  { title: "Quotes", description: "Create & send quotes", icon: FileText, url: "/quotes", color: "bg-primary" },
  { title: "Inventory", description: "Product catalog & stock", icon: Package, url: "/inventory", color: "bg-primary" },
  { title: "Delivery", description: "Track deliveries", icon: Truck, url: "/delivery", color: "bg-primary" },
  { title: "Transfers", description: "Inventory transfers", icon: ArrowLeftRight, url: "/transfers", color: "bg-primary" },
  { title: "Invoicing", description: "Billing & invoices", icon: Receipt, url: "/invoicing", color: "bg-primary" },
  { title: "Products", description: "Product inquiry", icon: Search, url: "/products", color: "bg-primary" },
  { title: "Projects", description: "Projects & tasks", icon: FolderKanban, url: "/projects", color: "bg-primary" },
  { title: "Training", description: "Team training", icon: GraduationCap, url: "/training", color: "bg-primary" },
  { title: "Reports", description: "Analytics & reports", icon: BarChart3, url: "/reports", color: "bg-primary" },
];

export default function Index() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {profile?.full_name || "User"}</h1>
        <p className="text-muted-foreground mt-1">Chevron & Phillips 66 Lubricant Distribution Platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod) => (
          <Card
            key={mod.url}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(mod.url)}
          >
            <CardHeader className="pb-2 flex flex-row items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${mod.color} flex items-center justify-center`}>
                <mod.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">{mod.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{mod.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
