import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { attachmentsExceedLimit, MAX_RECLAMO_ATTACHMENT_BYTES, reclamoSubject, uniqueEmails } from "./ReclamoCorreoDialog";

describe("reglas de correo de reclamos", () => {
  it("permite 35 MB y bloquea cualquier cantidad superior", () => {
    expect(MAX_RECLAMO_ATTACHMENT_BYTES).toBe(35 * 1024 * 1024);
    expect(attachmentsExceedLimit(35 * 1024 * 1024)).toBe(false);
    expect(attachmentsExceedLimit(35 * 1024 * 1024 + 1)).toBe(true);
  });
  it("restituye la referencia cuando fue retirada del asunto", () => {
    expect(reclamoSubject("Aviso modificado", "REC-3F9A2C")).toBe("Aviso modificado [REC-3F9A2C]");
    expect(reclamoSubject("Respuesta [rec-3f9a2c]", "REC-3F9A2C")).toBe("Respuesta [rec-3f9a2c]");
  });
  it("quita duplicados de destinatarios sin distinguir mayúsculas", () => {
    expect(uniqueEmails([" Almacen@lumaggs.com.mx ", "almacen@lumaggs.com.mx", "usuario@lumaggs.com.mx"])).toEqual(["almacen@lumaggs.com.mx", "usuario@lumaggs.com.mx"]);
  });
});