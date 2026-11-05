import { describe, it, expect } from "vitest";
import { puedeEditarCostos, validarCosto, prepararCargaCostos, type ProductoCosto } from "./contabilidadCostos";
const p: ProductoCosto = { id: "p1", codigo: "001", nombre_producto: "Producto", marca_id: "m1", marca: "Chevron", clasificacion: "General", costo_actual: 100, fecha_registro: "2026-11-01", precios: {} };
describe("Lista de Costos", () => {
  it("no habilita edición sin consentimiento explícito", () => expect(puedeEditarCostos(["accounting"], false)).toBe(false));
  it("habilita edición para contabilidad con consentimiento", () => expect(puedeEditarCostos(["accounting"], true)).toBe(true));
  it("habilita edición para master con consentimiento", () => expect(puedeEditarCostos(["master"], true)).toBe(true));
  it("no concede edición a admin ni ventas", () => expect(puedeEditarCostos(["admin", "sales"], true)).toBe(false));
  it("rechaza costos vacíos y negativos", () => { expect(() => validarCosto("")).toThrow(); expect(() => validarCosto(-1)).toThrow(); });
  it("conserva costo cero y centavos", () => { expect(validarCosto(0)).toBe(0); expect(validarCosto("12.35")).toBe(12.35); });
  it("rechaza códigos duplicados en una carga", () => expect(() => prepararCargaCostos([{ Codigo: "001", Costo: 150 }, { Codigo: "001", Costo: 180 }], [p])).toThrow(/repetido/));
  it("no aplica códigos de otra empresa", () => expect(() => prepararCargaCostos([{ Codigo: "002", Costo: 150 }], [p])).toThrow(/no identificado/));
  it("conserva el costo anterior para impedir sobrescritura concurrente", () => expect(prepararCargaCostos([{ Codigo: "001", Costo: 125 }], [p])[0]).toEqual({ id: "p1", codigo: "001", nombre: "Producto", costo: 125, costo_anterior: 100 }));
});