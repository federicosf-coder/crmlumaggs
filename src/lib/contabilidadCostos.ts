import * as XLSX from "xlsx";

export const COSTOS_ROLES = ["master", "accounting"];
export const puedeEditarCostos = (roles: readonly string[], habilitada: boolean) => habilitada && roles.some(r => COSTOS_ROLES.includes(r));
export function validarCosto(value: string | number): number {
  if (String(value).trim() === "") throw new Error("Captura un costo");
  const costo = Number(value);
  if (!Number.isFinite(costo) || costo < 0) throw new Error("El costo debe ser un número mayor o igual a cero");
  if (Math.abs(costo * 100 - Math.round(costo * 100)) > 0.00001) throw new Error("El costo admite hasta dos decimales");
  return costo;
}
export type ProductoCosto = { id: string; codigo: string; nombre_producto: string; marca_id: string | null; marca: string; clasificacion: string; costo_actual: number; fecha_registro: string; precios: Record<string, number> };
export type CambioCosto = { id: string; costo: number; costo_anterior: number; codigo: string; nombre: string };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export function prepararCargaCostos(rows: Record<string, unknown>[], productos: ProductoCosto[]): CambioCosto[] {
  if (!rows.length) throw new Error("El archivo no contiene registros");
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const normalized = Object.fromEntries(Object.entries(row).map(([k, v]) => [norm(k), v]));
    const codigo = String(normalized.codigo ?? "").trim();
    if (!codigo || seen.has(codigo)) throw new Error(`Fila ${i + 2}: código vacío o repetido (${codigo})`);
    seen.add(codigo);
    const matches = productos.filter(p => p.codigo === codigo);
    if (matches.length !== 1) throw new Error(`Fila ${i + 2}: código no identificado en esta empresa (${codigo})`);
    const p = matches[0];
    const costo = validarCosto(String(normalized.costo ?? normalized["costo del producto"] ?? ""));
    return { id: p.id, codigo, nombre: p.nombre_producto, costo, costo_anterior: p.costo_actual };
  });
}
export async function leerArchivoCostos(file: File, productos: ProductoCosto[]) {
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("El archivo no tiene hojas");
  return prepararCargaCostos(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "" }), productos);
}
export function descargarPlantillaCostos() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Codigo", "Costo"]]), "Costos");
  XLSX.writeFile(book, "Plantilla_costos.xlsx");
}