import type { ExistingButton } from "./existingButtonsCatalog";

// Carga el código fuente de todas las páginas y componentes relevantes en build-time.
const sources = import.meta.glob("/src/{pages,components}/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function pathToLocation(filePath: string): string {
  const rel = filePath.replace(/^\/src\//, "").replace(/\.tsx$/, "");
  const parts = rel.split("/");
  const file = parts.pop() || "";
  const folder = parts.join(" › ");
  const pretty = file.replace(/([a-z])([A-Z])/g, "$1 $2");
  return folder ? `${folder} › ${pretty}` : pretty;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function extractButtons(src: string): string[] {
  const labels = new Set<string>();
  // Captura el contenido textual interno de <Button ...> ... </Button>
  const re = /<Button\b[^>]*>([\s\S]*?)<\/Button>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const inner = m[1];
    // Quita JSX hijos (<Icon />, {expr}, comentarios) y deja solo texto.
    const text = inner
      .replace(/<[^>]+>/g, " ")
      .replace(/\{[^}]*\}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text && text.length >= 3 && text.length <= 60 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(text)) {
      labels.add(text);
    }
  }
  return [...labels];
}

export function detectButtonsFromSource(): ExistingButton[] {
  const found: ExistingButton[] = [];
  const seen = new Set<string>();
  for (const [path, src] of Object.entries(sources)) {
    if (typeof src !== "string") continue;
    const labels = extractButtons(src);
    if (labels.length === 0) continue;
    const location = pathToLocation(path);
    for (const label of labels) {
      const id = `auto.${slug(path)}.${slug(label)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      found.push({
        id,
        name: label,
        description: "Detectado automáticamente del código fuente.",
        location,
        path: "",
      });
    }
  }
  return found;
}

export function mergeButtons(
  base: ExistingButton[],
  detected: ExistingButton[],
): ExistingButton[] {
  const byKey = new Map<string, ExistingButton>();
  // El catálogo manual tiene prioridad.
  base.forEach((b) => byKey.set(slug(b.name) + "|" + slug(b.location), b));
  detected.forEach((b) => {
    const key = slug(b.name) + "|" + slug(b.location);
    if (!byKey.has(key)) byKey.set(key, b);
  });
  return [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );
}