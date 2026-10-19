import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RegistrarEntregaCorporativaDialog } from "./RegistrarEntregaCorporativaDialog";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), evidence: true }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) },
  from: (table: string) => {
    const result = table === "entregas_corporativas_lineas"
      ? { data: [{ id: "line-1", codigo_producto: "A", nombre_producto: "Producto", cantidad: 100, cantidad_entregada: 40 }], error: null }
      : { data: mocks.evidence ? [{ id: "evidence" }] : [], error: null };
    const query = { select: () => query, eq: () => query, order: () => Promise.resolve(result), limit: () => Promise.resolve(result) };
    return query;
  }, rpc: mocks.rpc,
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.evidence = true; });

const entrega = { id: "delivery", cliente: "Cliente", numero_pedido: "P-1", ubicacion_id: "place", evidencia_firmada_path: null, factura_referencia: null };
describe("Registro de entrega sin correo obligatorio", () => {
  it("guarda las cantidades parciales y solicita recargar el listado solo después de confirmar", async () => {
    mocks.rpc.mockResolvedValue({ data: "entregada_parcial", error: null });
    const saved = vi.fn(), close = vi.fn();
    render(<RegistrarEntregaCorporativaDialog entrega={entrega} initialMode="parcial" onSaved={saved} onClose={close} onDetalle={vi.fn()} />);
    const input = await screen.findByLabelText("Entregado ahora");
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("0"));
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar entrega" }));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("registrar_entrega_corporativa", { p_entrega_id: "delivery", p_factura: "", p_lineas: [{ id: "line-1", cantidad: 20, previa: 40 }] });
    expect(close).toHaveBeenCalledOnce();
  });
  it("no registra sin evidencia y conserva la captura si falla el guardado", async () => {
    mocks.evidence = false;
    const saved = vi.fn();
    render(<RegistrarEntregaCorporativaDialog entrega={entrega} initialMode="total" onSaved={saved} onClose={vi.fn()} onDetalle={vi.fn()} />);
    await waitFor(() => expect((screen.getByLabelText("Entregado ahora") as HTMLInputElement).value).toBe("60"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar entrega" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Adjunta una evidencia");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });
  it("no cierra ni recarga si la operación falla", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Otro usuario actualizó esta entrega" } });
    const saved = vi.fn(), close = vi.fn();
    render(<RegistrarEntregaCorporativaDialog entrega={entrega} initialMode="total" onSaved={saved} onClose={close} onDetalle={vi.fn()} />);
    await waitFor(() => expect((screen.getByLabelText("Entregado ahora") as HTMLInputElement).value).toBe("60"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar entrega" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Otro usuario");
    expect(saved).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
});