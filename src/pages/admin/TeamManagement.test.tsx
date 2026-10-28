import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ roles: ["admin"] as string[], from: vi.fn(), rpc: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ hasRole: (role: string) => mocks.roles.includes(role), hasAnyRole: (roles: string[]) => roles.some((role) => mocks.roles.includes(role)) }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
import TeamManagement from "./TeamManagement";

describe("gerentes de equipos", () => {
  beforeEach(() => {
    mocks.roles = ["admin"]; mocks.upsert.mockReset().mockResolvedValue({ error: null }); mocks.remove.mockReset().mockResolvedValue({ error: null }); mocks.rpc.mockResolvedValue({ data: ["manager"], error: null });
    mocks.from.mockImplementation((table: string) => ({
      select: () => {
        const data = table === "teams" ? [{ id: "t1", name: "Equipo uno", is_active: true }, { id: "t2", name: "Equipo dos", is_active: true }]
          : table === "profiles" ? [{ user_id: "m1", full_name: "Gerente uno" }, { user_id: "m2", full_name: "Gerente dos" }, { user_id: "sales", full_name: "Vendedor" }]
          : table === "user_roles" ? [{ user_id: "m1", role: "manager" }, { user_id: "m2", role: "admin" }] : [];
        return { then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve), in: () => Promise.resolve({ data, error: null }) };
      },
      upsert: mocks.upsert,
      delete: () => ({ eq: (column: string, value: string) => ({ eq: (nextColumn: string, nextValue: string) => mocks.remove({ [column]: value, [nextColumn]: nextValue }) }) }),
    }));
  });
  afterEach(cleanup);
  it("permite varios gerentes por equipo y el mismo gerente en dos equipos", async () => {
    render(<TeamManagement />);
    const first = await screen.findByRole("button", { name: "Gerentes del equipo Equipo uno" });
    fireEvent.click(first);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Gerente uno" }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith({ team_id: "t1", user_id: "m1" }, { onConflict: "team_id,user_id", ignoreDuplicates: true }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Gerente dos" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("checkbox", { name: "Gerente dos" }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith({ team_id: "t1", user_id: "m2" }, expect.anything()));
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Gerente dos" }), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Gerentes del equipo Equipo dos" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Gerente uno" }));
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith({ team_id: "t2", user_id: "m1" }, expect.anything()));
    expect(screen.queryByRole("checkbox", { name: "Vendedor" })).toBeNull();
  });
  it.each(["manager", "accounting", "sales"])("impide editar a %s", async (role) => {
    mocks.roles = [role]; render(<TeamManagement />);
    expect(await screen.findByRole("button", { name: "Gerentes del equipo Equipo uno" })).toBeDisabled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("permite editar a master usando los roles existentes", async () => {
    mocks.roles = ["master"]; render(<TeamManagement />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerentes del equipo Equipo uno" })).toBeEnabled());
    expect(mocks.rpc).toHaveBeenCalledWith("get_user_roles", { _user_id: "m1" });
  });
});