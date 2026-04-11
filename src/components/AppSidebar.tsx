import {
  LayoutDashboard, Users, ShoppingCart, FileText, Package, Truck,
  GraduationCap, ArrowLeftRight, FolderKanban, Search, UserCircle,
  Receipt, BarChart3, Droplets, LogOut, Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type AppRole = "admin" | "manager" | "sales" | "delivery" | "warehouse" | "customer_service" | "accounting";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[] | "all";
}

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: "all" },
  { title: "CRM", url: "/crm", icon: ShoppingCart, roles: ["admin", "manager", "sales", "customer_service"] },
  { title: "Quotes", url: "/quotes", icon: FileText, roles: ["admin", "manager", "sales"] },
  { title: "Inventory", url: "/inventory", icon: Package, roles: ["admin", "manager", "warehouse", "delivery"] },
  { title: "Delivery", url: "/delivery", icon: Truck, roles: ["admin", "manager", "delivery"] },
  { title: "Transfers", url: "/transfers", icon: ArrowLeftRight, roles: ["admin", "manager", "warehouse"] },
  { title: "Invoicing", url: "/invoicing", icon: Receipt, roles: ["admin", "manager", "accounting"] },
  { title: "Product Inquiry", url: "/products", icon: Search, roles: ["admin", "manager", "sales", "customer_service"] },
  { title: "Projects & Tasks", url: "/projects", icon: FolderKanban, roles: "all" },
  { title: "Training", url: "/training", icon: GraduationCap, roles: "all" },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["admin", "manager", "accounting"] },
];

const adminItems: NavItem[] = [
  { title: "User Management", url: "/admin/users", icon: Users, roles: ["admin"] },
  { title: "Teams", url: "/admin/teams", icon: Settings, roles: ["admin", "manager"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, roles, signOut, hasAnyRole } = useAuth();

  const canAccess = (item: NavItem) => {
    if (item.roles === "all") return true;
    if (roles.length === 0) return true; // new users with no roles see everything until assigned
    return hasAnyRole(item.roles);
  };

  const visibleMain = mainItems.filter(canAccess);
  const visibleAdmin = adminItems.filter(canAccess);

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
              <span className="text-[10px] text-sidebar-foreground/60">Distribution Platform</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
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
                {!collapsed && <span className="truncate">{profile?.full_name || "Profile"}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {!collapsed && <span>Sign Out</span>}
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
