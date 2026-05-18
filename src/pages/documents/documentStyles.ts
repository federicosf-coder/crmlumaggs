// Shared capsule color tokens for Documents module (list filters + form pickers)

export const EMPRESA_STYLES: Record<string, { active: string; idle: string; dot: string; label: string }> = {
  lumaggs_chevron: {
    active: "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
    idle: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    dot: "bg-blue-600",
    label: "Lumaggs Chevron",
  },
  galsa_phillips66: {
    active: "bg-red-600 text-white border-red-600 hover:bg-red-700",
    idle: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
    dot: "bg-red-600",
    label: "Galsa Phillips 66",
  },
};

export const TIPO_DOC_STYLES: Record<string, { active: string; idle: string; pill: string; label: string }> = {
  cotizacion: {
    active: "bg-blue-600 text-white border-blue-600 hover:bg-blue-700",
    idle: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    pill: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Cotización",
  },
  pedido: {
    active: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
    idle: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Pedido",
  },
  factura: {
    active: "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
    idle: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Factura",
  },
  entrega_corporativa: {
    active: "bg-purple-600 text-white border-purple-600 hover:bg-purple-700",
    idle: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    pill: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Entrega Corporativa",
  },
};

// Plaza color palette — 8 distinct hues (no near-duplicates)
export const PLAZA_PALETTE = [
  { active: "bg-cyan-600 text-white border-cyan-600 hover:bg-cyan-700",         idle: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",         pill: "bg-cyan-50 text-cyan-700 border-cyan-200",         dot: "bg-cyan-500" },
  { active: "bg-fuchsia-600 text-white border-fuchsia-600 hover:bg-fuchsia-700", idle: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100", pill: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", dot: "bg-fuchsia-500" },
  { active: "bg-orange-600 text-white border-orange-600 hover:bg-orange-700",   idle: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",   pill: "bg-orange-50 text-orange-700 border-orange-200",   dot: "bg-orange-500" },
  { active: "bg-violet-600 text-white border-violet-600 hover:bg-violet-700",   idle: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",   pill: "bg-violet-50 text-violet-700 border-violet-200",   dot: "bg-violet-500" },
  { active: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",         idle: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",         pill: "bg-rose-50 text-rose-700 border-rose-200",         dot: "bg-rose-500" },
  { active: "bg-lime-600 text-white border-lime-600 hover:bg-lime-700",         idle: "bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100",         pill: "bg-lime-50 text-lime-700 border-lime-200",         dot: "bg-lime-500" },
  { active: "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700",   idle: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",   pill: "bg-indigo-50 text-indigo-700 border-indigo-200",   dot: "bg-indigo-500" },
  { active: "bg-pink-600 text-white border-pink-600 hover:bg-pink-700",         idle: "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100",         pill: "bg-pink-50 text-pink-700 border-pink-200",         dot: "bg-pink-500" },
];

export function plazaColor(id: string | null | undefined) {
  if (!id) return PLAZA_PALETTE[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PLAZA_PALETTE[h % PLAZA_PALETTE.length];
}