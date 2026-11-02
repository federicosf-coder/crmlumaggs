import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export type TipoContpaq = "clientes" | "agentes" | "ventas";
const codigo = (v: unknown) => String(v ?? "").trim();
const meses = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
export function parseContpaq(rows: unknown[][], tipo: TipoContpaq) {
  const registros: Record<string, any>[] = [];
  let actual: Record<string, any> | undefined;
  for (const r of rows) {
    if (tipo !== "ventas") {
      if (r[2] !== "Venta/Cobranza" && tipo === "agentes") continue;
      if (tipo === "clientes" && (!codigo(r[0]) || !codigo(r[1]) || !codigo(r[5]).includes("Peso") && !codigo(r[5]).includes("Dólar"))) continue;
      registros.push({ codigo: codigo(r[0]), nombre: codigo(r[1]), rfc: tipo === "clientes" ? codigo(r[2]) : undefined });
      continue;
    }
    const match = codigo(r[0]).match(/^(\d{2})\/([A-Z]{3})\/(\d{4})$/);
    if (match) {
      const mes = meses.indexOf(match[2]);
      if (mes < 0) throw new Error("Fecha inválida");
      actual = { fecha: `${match[3]}-${String(mes + 1).padStart(2, "0")}-${match[1]}`, serie: codigo(r[1]), folio: codigo(r[2]), concepto: codigo(r[3]), cliente: codigo(r[4]), moneda: codigo(r[5]), tc: Number(r[6]), agente: codigo(r[7]), estado: codigo(r[8]), lineas: [] };
      registros.push(actual);
    } else if (actual && codigo(r[0]) && codigo(r[1]) && typeof r[2] === "number") {
      actual.lineas.push({ codigo_producto: codigo(r[0]), producto: codigo(r[1]), cantidad: r[2], unidad: codigo(r[3]), neto: Number(r[5]), total: Number(r[8]) });
    }
  }
  if (!registros.length) throw new Error("No se encontraron registros del tipo seleccionado");
  if (tipo === "ventas" && registros.some(r => !r.lineas.length)) throw new Error("Hay documentos sin partidas");
  return registros;
}

export async function cargarContpaq(file: File, marca: string, tipo: TipoContpaq) {
  const bytes = await file.arrayBuffer();
  const book = XLSX.read(bytes);
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error("Archivo vacío");
  const filas = parseContpaq(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }), tipo);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(n => n.toString(16).padStart(2, "0")).join("");
  const ruta = `${marca}/${tipo}/${hash}.xls`;
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 8192) bin += String.fromCharCode(...arr.subarray(i, i + 8192));
  const { error: originalError } = await supabase.rpc("contpaq_guardar_original", { _hash: hash, _nombre: file.name, _contenido: btoa(bin) });
  if (originalError) throw originalError;
  const { data, error } = await supabase.rpc("contpaq_importar", { _marca: marca, _tipo: tipo, _archivo: file.name, _ruta: ruta, _hash: hash, _filas: filas });
  if (error) throw error;
  return data as { filas: number; repetido: boolean };
}