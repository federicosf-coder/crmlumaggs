import { describe, expect, it } from "vitest";
import { cantidadPendiente, validarCapturaEntrega } from "./entregaCorporativaCantidades";

describe("Entrega corporativa parcial", () => {
  const linea = { id: "a", cantidad: 100, cantidad_entregada: 40 };
  it("conserva las 60 unidades pendientes de la misma entrega sin alterar las 100 solicitadas", () => {
    expect(cantidadPendiente(linea)).toBe(60);
    expect(linea.cantidad).toBe(100);
    expect(cantidadPendiente({ ...linea, cantidad_entregada: 100 })).toBe(0);
  });
  it("permite registrar parte o todo lo pendiente sin excederlo", () => {
    expect(validarCapturaEntrega([linea], { a: "20" })).toBeNull();
    expect(validarCapturaEntrega([linea], { a: "60" })).toBeNull();
    expect(validarCapturaEntrega([linea], { a: "61" })).not.toBeNull();
    expect(validarCapturaEntrega([linea], { a: "-1" })).not.toBeNull();
    expect(validarCapturaEntrega([linea], { a: "NaN" })).not.toBeNull();
    expect(validarCapturaEntrega([linea], { a: "0" })).not.toBeNull();
  });
});