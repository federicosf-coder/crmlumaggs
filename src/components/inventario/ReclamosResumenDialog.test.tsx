import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), getUser: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke }, auth: { getUser: mocks.getUser } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "remitente@example.com" } }) }));
import { ReclamosResumenDialog } from "./ReclamosResumenDialog";

describe("envío del resumen de reclamos", () => {
  beforeEach(() => {
    mocks.invoke.mockReset().mockResolvedValue({ data: { success: true, id: "envio-resumen" }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "usuario", email: "remitente@example.com" } }, error: null });
    URL.createObjectURL = vi.fn(() => "blob:resumen"); URL.revokeObjectURL = vi.fn();
  });
  it("adjunta el PDF del listado, confirma envío y bloquea el reenvío", async () => {
    render(<ReclamosResumenDialog open onOpenChange={vi.fn()} reclamos={[{ inv_pedidos: { numero_po_interno: "DAGAL_NAL_MXL_26065" }, estatus: "borrador" }]} empaques={{}} estatus={{ borrador: "Borrador" }} filtros="Todos los estatus" />);
    const recipient = screen.getByLabelText("Agregar a Para");
    fireEvent.change(recipient, { target: { value: "destinatario@example.com" } });
    fireEvent.blur(recipient);
    fireEvent.click(screen.getByRole("button", { name: "Enviar resumen" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    const [functionName, { body }] = mocks.invoke.mock.calls[0];
    expect(functionName).toBe("send-email");
    expect(body.to).toEqual(["destinatario@example.com"]);
    expect(body.attachments).toHaveLength(1);
    expect(atob(body.attachments[0].content).startsWith("%PDF-")).toBe(true);
    expect(body.subject).toBe("Resumen de reclamos de pedidos");
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviado" })).toBeDisabled());
  });
});