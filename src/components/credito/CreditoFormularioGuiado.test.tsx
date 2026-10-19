import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreditoFormularioGuiado } from "./CreditoFormularioGuiado";

afterEach(cleanup);
describe("Guardado del formulario guiado", () => {
  it("avanza solo cuando se confirma el guardado", async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const change = vi.fn();
    render(<CreditoFormularioGuiado value="empresa" onValueChange={change} personaMoral saving={false} onSave={save}><input defaultValue="Borrador" /></CreditoFormularioGuiado>);
    fireEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar y continuar" }));
    await waitFor(() => expect(change).toHaveBeenCalledWith("domicilios"));
  });
  it("guardar avance no cambia de paso", async () => {
    const change = vi.fn();
    const save = vi.fn().mockResolvedValue(true);
    render(<CreditoFormularioGuiado value="bancos" onValueChange={change} personaMoral={false} saving={false} onSave={save}><input defaultValue="001234" /></CreditoFormularioGuiado>);
    fireEvent.click(screen.getByRole("button", { name: "Guardar avance" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(change).not.toHaveBeenCalled();
  });
});