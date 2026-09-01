/**
 * Lector mínimo de EXIF para obtener la fecha/hora ORIGINAL de captura de una foto.
 *
 * - Sólo lee JPEG (segmento APP1 / TIFF) — es donde vive el EXIF en la práctica.
 * - Devuelve `null` cuando la imagen no tiene metadatos de fecha/hora.
 * - Nunca lanza: cualquier error se traduce en `null` para no bloquear la subida.
 *
 * Etiquetas usadas (en orden de preferencia):
 *   0x9003 DateTimeOriginal, 0x9004 DateTimeDigitized, 0x0132 DateTime
 */

const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD_POINTER = 0x8769;

/** Convierte "2026:09:01 10:35:12" a Date local. Devuelve null si no es válido. */
function parseExifDateString(raw: string): Date | null {
  const s = raw.replace(/\0/g, "").trim();
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, sec] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(sec || "0"),
  );
  if (isNaN(date.getTime())) return null;
  // Sanidad: fechas absurdas se descartan (no inventamos datos).
  if (date.getFullYear() < 1990 || date.getTime() > Date.now() + 86400000) return null;
  return date;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/** Recorre un IFD y recolecta las etiquetas de fecha y el puntero al Exif IFD. */
function scanIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  little: boolean,
  found: Record<number, string>,
): number | null {
  if (ifdOffset + 2 > view.byteLength) return null;
  const entries = view.getUint16(ifdOffset, little);
  let exifPointer: number | null = null;
  for (let i = 0; i < entries; i++) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const count = view.getUint32(entry + 4, little);

    if (tag === TAG_EXIF_IFD_POINTER) {
      exifPointer = tiffStart + view.getUint32(entry + 8, little);
      continue;
    }
    if (tag !== TAG_DATETIME_ORIGINAL && tag !== TAG_DATETIME_DIGITIZED && tag !== TAG_DATETIME) continue;
    if (type !== 2) continue; // ASCII

    const valueOffset = count > 4 ? tiffStart + view.getUint32(entry + 8, little) : entry + 8;
    if (valueOffset + count > view.byteLength) continue;
    found[tag] = readAscii(view, valueOffset, count);
  }
  return exifPointer;
}

/**
 * Extrae la fecha/hora de captura de un archivo de imagen.
 * Devuelve `null` si no hay metadatos EXIF de fecha/hora.
 */
export async function readExifCapturedAt(file: File): Promise<Date | null> {
  try {
    // El EXIF vive al inicio del archivo; leemos como máximo 256 KB.
    const slice = file.slice(0, Math.min(file.size, 256 * 1024));
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4) return null;
    if (view.getUint16(0, false) !== 0xffd8) return null; // no es JPEG

    let offset = 2;
    let tiffStart = -1;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (marker === 0xda) break; // inicio de datos comprimidos
      const size = view.getUint16(offset + 2, false);
      if (marker === 0xe1) {
        const app1 = offset + 4;
        if (app1 + 6 <= view.byteLength && readAscii(view, app1, 4) === "Exif") {
          tiffStart = app1 + 6;
          break;
        }
      }
      offset += 2 + size;
    }
    if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return null;

    const byteOrder = view.getUint16(tiffStart, false);
    if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
    const little = byteOrder === 0x4949;
    if (view.getUint16(tiffStart + 2, little) !== 42) return null;

    const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
    const found: Record<number, string> = {};
    const exifPointer = scanIfd(view, tiffStart, ifd0, little, found);
    if (exifPointer && exifPointer < view.byteLength) {
      scanIfd(view, tiffStart, exifPointer, little, found);
    }

    const raw =
      found[TAG_DATETIME_ORIGINAL] || found[TAG_DATETIME_DIGITIZED] || found[TAG_DATETIME];
    if (!raw) return null;
    return parseExifDateString(raw);
  } catch {
    return null;
  }
}
