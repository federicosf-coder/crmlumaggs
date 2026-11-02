import { describe, it, expect } from "vitest";
import { calcularGuia } from "./guiaBatalla";

const f = (empresa_id: string, fecha: string, unidades: number) => ({ empresa_id, cliente: empresa_id, fecha, unidades });

describe("guía de batalla — corte noviembre 2026", () => {
  const data = [
    f("A", "2026-08-10", 30), f("A", "2026-09-10", 30), f("A", "2026-10-05", 60), f("A", "2026-11-02", 10),
    f("B", "2026-03-01", 24), // última compra >91 días
    f("C", "2026-11-01", 5), // solo compró este mes
    f("D", "2026-07-31", 99), // justo fuera de los 90 días
  ];
  const g = calcularGuia(data, "2026-11");

  it("90 días son agosto-octubre y el promedio es /3", () => {
    const a = g.activos.find((x) => x.empresa_id === "A")!;
    expect(a.u90).toBe(120);
    expect(a.promedio).toBe(40);
    expect(a.mesAnterior).toBe(60);
    expect(a.esteMes).toBe(10);
  });

  it("quien compró solo este mes sigue en la lista activa", () => {
    expect(g.activos.map((x) => x.empresa_id).sort()).toEqual(["A", "C"]);
  });

  it("sin compra +91 días: total de 12 meses y promedio /12", () => {
    const b = g.perdidos.find((x) => x.empresa_id === "B")!;
    expect(b.total).toBe(24);
    expect(b.promedio).toBe(2);
    expect(g.perdidos.map((x) => x.empresa_id).sort()).toEqual(["B", "D"]);
  });

  it("cliente que compra cada ~2 meses: fecha estimada y esperado del mes", () => {
    const g2 = calcularGuia([f("E", "2026-05-01", 40), f("E", "2026-07-01", 40), f("E", "2026-08-31", 40)], "2026-11");
    const e = g2.activos.find((x) => x.empresa_id === "E")!;
    expect(e.frecuenciaDias).toBe(61);
    expect(e.proximaCompra).toBe("2026-10-31");
    expect(e.atrasado).toBe(true);
    expect(e.esperadoMes).toBe(40);
  });

  it("si la próxima compra cae el mes siguiente, este mes no se espera venta", () => {
    const g3 = calcularGuia([f("F", "2026-08-01", 30), f("F", "2026-10-20", 30)], "2026-11");
    const x = g3.activos.find((y) => y.empresa_id === "F")!;
    expect(x.proximaCompra).toBe("2027-01-08");
    expect(x.esperadoMes).toBe(0);
  });
});
