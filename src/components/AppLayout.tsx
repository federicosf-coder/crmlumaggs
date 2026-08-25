import { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { roleLabel } from "@/lib/roles";
import { FeedbackButton } from "@/components/FeedbackButton";
import { usePendingFeedbackCount } from "@/hooks/usePendingFeedbackCount";
import { MessageCircleQuestion } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const { roles, hasRole } = useAuth();
  const pendingFeedback = usePendingFeedbackCount();
  const isAdmin = hasRole("admin");
  const [sp] = useSearchParams();
  const embed = sp.get("embed") === "1";

  if (embed) {
    return <div className="min-h-screen w-full bg-background"><main className="p-4">{children}</main></div>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-card px-4 gap-3">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {hasAnyRole(["admin", "manager", "sales", "customer_service", "accounting"]) && <AlertasBell />}
              {isAdmin && pendingFeedback > 0 && (

                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <MessageCircleQuestion className="h-3 w-3" />
                  {pendingFeedback} reporte{pendingFeedback > 1 ? "s" : ""} nuevo{pendingFeedback > 1 ? "s" : ""}
                </Badge>
              )}
              {roles.map((role) => (
                <Badge key={role} variant="secondary" className="text-xs">
                  {roleLabel(role)}
                </Badge>
              ))}
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
          <FeedbackButton />
        </div>
      </div>
    </SidebarProvider>
  );
}
