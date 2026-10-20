import { describe, it, expect } from "vitest";
import { sugerirEjecutivoPorPlaza } from "./ejecutivoPorPlaza";

const MXL = "mexicali", TIJ = "tijuana";

describe("sugerirEjecutivoPorPlaza", () => {
  it("usa el ejecutivo asignado a la empresa en la plaza de la factura", () => {
    expect(
      sugerirEjecutivoPorPlaza(
        { asignados: [{ user_id: "wilber", plaza_id: TIJ }, { user_id: "miguel", plaza_id: MXL }], ultimosDocs: [{ ejecutivo_venta_id: "wilber", plaza_id: MXL }] },
        MXL
      )
    ).toBe("miguel");
  });
  it("si no hay asignado en la plaza, usa el último pedido de esa misma plaza", () => {
    expect(
      sugerirEjecutivoPorPlaza(
        { asignados: [{ user_id: "wilber", plaza_id: TIJ }], ultimosDocs: [{ ejecutivo_venta_id: "wilber", plaza_id: TIJ }, { ejecutivo_venta_id: "miguel", plaza_id: MXL }] },
        MXL
      )
    ).toBe("miguel");
  });
  it("nunca sugiere un ejecutivo de otra plaza", () => {
    expect(
      sugerirEjecutivoPorPlaza({ asignados: [{ user_id: "wilber", plaza_id: TIJ }], ultimosDocs: [{ ejecutivo_venta_id: "erick", plaza_id: TIJ }] }, MXL)
    ).toBeNull();
  });
});
