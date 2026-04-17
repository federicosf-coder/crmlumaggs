/** Parser CSV simple: detecta delimitador (`;` o `,`), respeta comillas, ignora BOM. */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  // Detectar delim por la primera línea
  const headerLine = lines[0];
  const delim = (headerLine.match(/;/g)?.length || 0) > (headerLine.match(/,/g)?.length || 0) ? ";" : ",";

  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
        } else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === delim) { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headers = splitRow(headerLine);
  return lines.slice(1).map((line) => {
    const vals = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}
