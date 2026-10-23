import { describe, expect, it } from "vitest";
import { confirmacionFacturacion } from "./reclamoFacturacion";

describe("confirmación de facturación por producto", () => {
  it("conserva autorización y rechazo independientemente para cada producto", () => {
    expect(["Sí", "No"].map(confirmacionFacturacion)).toEqual(["si", "no"]);
  });
  it("no autoriza productos sin una respuesta explícita", () => {
    expect([null, undefined, "", "pendiente"].map(confirmacionFacturacion)).toEqual([null, null, null, null]);
  });
});