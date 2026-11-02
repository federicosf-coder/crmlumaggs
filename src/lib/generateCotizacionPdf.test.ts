import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
const toast = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };

vi.mock("sonner", () => ({ toast }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

import { downloadCotizacionPdf } from "./generateCotizacionPdf";

const respond = (guardado: string) =>
  invoke.mockResolvedValue({
    data: new Blob(["%PDF-"]),
    error: null,
    response: new Response(null, { headers: { "x-pdf-guardado": guardado } }),
  });

describe("downloadCotizacionPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
  });

  it("solo reporta éxito cuando el PDF quedó guardado en el documento", async () => {
    respond("ok");
    await downloadCotizacionPdf("doc-1");
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("no reporta éxito si el guardado sigue pendiente", async () => {
    respond("pendiente");
    await downloadCotizacionPdf("doc-1");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("avisa error si el guardado falló aunque se descargue el PDF", async () => {
    respond("error");
    await downloadCotizacionPdf("doc-1");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
