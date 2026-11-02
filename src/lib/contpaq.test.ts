import { describe, expect, it } from "vitest";
import { parseContpaq } from "./contpaq";
describe("CONTPAQ", () => {
  it("conserva códigos alfanuméricos de agentes", () => {
    expect(parseContpaq([["C001","CASA MEXICALI","Venta/Cobranza"]],"agentes")[0].codigo).toBe("C001");
  });
  it("separa encabezados, productos y totales sin duplicar cantidades", () => {
    const parsed = parseContpaq([["02/NOV/2026","TIJ",3600,"Facturacion Tijuana",863,"Peso Mexicano",1,270,"Afectado"],[257004428,"CUBETA",2,"CB",1,2,0,0,2],["","",2,"","",2,0,0,2]],"ventas");
    expect(parsed[0].fecha).toBe("2026-11-02");
    expect(parsed[0].lineas).toHaveLength(1);
    expect(parsed[0].lineas[0].cantidad).toBe(2);
  });
  it("mantiene cancelados para actualizar sin contarlos como nueva factura", () => {
    const p = parseContpaq([["02/ENE/2026","ENS",523,"Facturacion Ensenada",378,"Peso Mexicano",1,12,"Cancelado"],[257004428,"CUBETA",2,"CB",1,2,0,0,2]],"ventas");
    expect(p[0].estado).toBe("Cancelado");
  });
});