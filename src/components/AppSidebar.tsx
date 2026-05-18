import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, Package, Truck,
  GraduationCap, ArrowLeftRight, FolderKanban, Search, UserCircle,
  Receipt, BarChart3, Droplets, LogOut, Settings, BookOpen, Shield, Database, MapPin, Wallet, Upload,
  MessageCircle, Megaphone, FileBadge, Bot, FileStack,
  Briefcase, Zap, FolderOpen,
  FileCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useModuleAccess } from "@/hooks/useModuleAccess";

type AppRole = "admin" | "manager" | "sales" | "delivery" | "warehouse" | "customer_service" | "accounting";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[] | "all";
}

const mainItems: NavItem[] = [
  { title: "Inicio", url: "/", icon: LayoutDashboard, roles: "all" },
  { title: "Portal del Vendedor", url: "/seller-portal", icon: Briefcase, roles: ["admin", "manager", "sales"] },
  { title: "Directorio", url: "/directory", icon: BookOpen, roles: "all" },
  { title: "CRM", url: "/crm", icon: ShoppingCart, roles: ["admin", "manager", "sales", "customer_service"] },
  { title: "Documentos", url: "/documents", icon: FileText, roles: ["admin", "manager", "sales"] },
  { title: "Cobranza", url: "/cobranza", icon: Wallet, roles: ["admin", "manager", "accounting"] },
  { title: "Tareas y Actividades", url: "/activities", icon: FolderKanban, roles: "all" },
  { title: "Biblioteca", url: "/biblioteca", icon: FolderOpen, roles: "all" },
  { title: "Solicitudes de Crédito", url: "/credito", icon: FileCheck, roles: ["admin", "manager", "sales", "customer_service", "accounting"] },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle, roles: "all" },
  { title: "Catálogo de Productos", url: "/inventory", icon: Package, roles: ["admin", "manager", "warehouse", "delivery"] },
  { title: "Entregas", url: "/delivery", icon: Truck, roles: ["admin", "manager", "delivery"] },
  { title: "Transferencias", url: "/transfers", icon: ArrowLeftRight, roles: ["admin", "manager", "warehouse"] },
  { title: "Capacitación", url: "/training", icon: GraduationCap, roles: "all" },
  { title: "Reportes", url: "/reports", icon: BarChart3, roles: ["admin", "manager", "accounting"] },
  { title: "Automatizaciones", url: "/automations", icon: Zap, roles: ["admin", "manager"] },
];

const adminItems: NavItem[] = [
  { title: "Gestión de Usuarios", url: "/admin/users", icon: Users, roles: ["admin"] },
  { title: "Permisos", url: "/admin/permissions", icon: Shield, roles: ["admin"] },
  { title: "Equipos", url: "/admin/teams", icon: Settings, roles: ["admin", "manager"] },
  { title: "Catálogos", url: "/admin/catalogs", icon: Database, roles: ["admin", "manager"] },
  { title: "Plantillas", url: "/admin/templates", icon: FileStack, roles: ["admin", "manager", "sales"] },
  { title: "Importar Noloco", url: "/admin/import-noloco", icon: Upload, roles: ["admin"] },
  { title: "WhatsApp · Campañas", url: "/whatsapp/campaigns", icon: Megaphone, roles: ["admin", "manager"] },
  { title: "WhatsApp · Plantillas", url: "/whatsapp/templates", icon: FileBadge, roles: ["admin", "manager"] },
  { title: "WhatsApp · Bot", url: "/whatsapp/rules", icon: Bot, roles: ["admin", "manager"] },
  { title: "WhatsApp · Configuración", url: "/whatsapp/settings", icon: Settings, roles: ["admin", "manager"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, roles, signOut, hasAnyRole, hasRole } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadWhatsApp, setUnreadWhatsApp] = useState(0);
  const whatsappAccess = useModuleAccess("whatsapp");

  useEffect(() => {
    if (!hasRole("admin")) return;
    let cancelled = false;
    const load = async () => {
      const { count } = await (supabase as any)
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pendiente");
      if (!cancelled) setPendingCount(count || 0);
    };
    load();
    const channel = supabase
      .channel(`profiles-pending-count-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [hasRole]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase as any)
        .from("whatsapp_conversations")
        .select("unread_count")
        .gt("unread_count", 0);
      const total = (data ?? []).reduce((sum: number, row: any) => sum + (row.unread_count || 0), 0);
      if (!cancelled) setUnreadWhatsApp(total);
    };
    load();
    const channel = supabase
      .channel(`wa-unread-sidebar-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const canAccess = (item: NavItem) => {
    if (item.roles === "all") return true;
    if (roles.length === 0) return true;
    return hasAnyRole(item.roles);
  };

  const visibleMain = mainItems.filter(canAccess).filter((item) => {
    if (item.url === "/whatsapp") return whatsappAccess.canView;
    return true;
  });
  const visibleAdmin = adminItems.filter(canAccess).filter((item) => {
    if (item.url.startsWith("/whatsapp")) return whatsappAccess.canView;
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-sidebar-primary flex items-center justify-center shrink-0">
            <Droplets className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-sm text-sidebar-foreground">LubriManager</span>
              <span className="text-[10px] text-sidebar-foreground/60">Plataforma de Distribución</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => {
                const showBadge = item.url === "/whatsapp" && unreadWhatsApp > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {showBadge && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                            {unreadWhatsApp}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => {
                  const showBadge = item.url === "/admin/users" && pendingCount > 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {showBadge && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px]">
                              {pendingCount}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Separator className="mb-3 bg-sidebar-border" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/profile" className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                <UserCircle className="mr-2 h-4 w-4" />
                {!collapsed && <span className="truncate">{profile?.full_name || "Perfil"}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {!collapsed && <span>Cerrar Sesión</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
