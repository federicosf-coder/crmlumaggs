import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), roles: [] as string[], accessLevel: "propio" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ roles: mocks.roles, loading: false }) }));
vi.mock("@/hooks/useModuleAccess", () => ({ useModuleAccess: () => ({ canView: true, isLoading: false, accessLevel: mocks.accessLevel }) }));
import CobranzaPanel from "./CobranzaPanel";

describe("puente del panel de cobranza", () => {
  beforeEach(() => { mocks.roles = []; mocks.accessLevel = "propio"; mocks.rpc.mockReset().mockImplementation((name: string) => Promise.resolve({ data: name === "cobranza_estado_carga" ? [{ corte: "2026-10-28" }] : [{ folio: "123" }], error: null })); mocks.invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null }); });
  afterEach(cleanup);
  function setup() {
    const { container } = render(<CobranzaPanel />);
    const frame = container.querySelector("iframe");
    const source = frame?.contentWindow;
    if (!source) throw new Error("Sin iframe");
    const post = vi.spyOn(source, "postMessage");
    const send = (data: unknown, origin = window.location.origin, sender: Window = source) => fireEvent(window, new MessageEvent("message", { data, origin, source: sender }));
    return { post, send };
  }
  it.each(["admin", "master", "accounting"])("permite carga y envío a %s", async (role) => {
    mocks.roles = [role]; const { send, post } = setup(); send({ type: "cobranza-listo", marca: "lumaggs" });
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: "cobranza-datos", puedeSubir: true, puedeEnviar: true, estado: { corte: "2026-10-28" } }), window.location.origin));
  });
  it("permite operar al acceso todos sin un rol elevado", async () => {
    mocks.accessLevel = "todos"; const { send, post } = setup(); send({ type: "cobranza-listo", marca: "lumaggs" });
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ puedeSubir: true, puedeEnviar: true }), window.location.origin));
  });
  it("mantiene lectura sin permitir operaciones al acceso propio", async () => {
    const { send, post } = setup(); send({ type: "cobranza-listo", marca: "lumaggs" });
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ puedeSubir: false, puedeEnviar: false }), window.location.origin));
    send({ type: "cobranza-guardar", marca: "lumaggs", reqId: "r1", corte: "2026-10-28", rows: [] });
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ reqId: "r1", ok: false }), window.location.origin));
    expect(mocks.rpc).not.toHaveBeenCalledWith("cobranza_guardar_facturas", expect.anything());
  });
  it("ignora otro origen u otra ventana", () => {
    const { send } = setup(); send({ type: "cobranza-listo", marca: "lumaggs" }, "https://otro.example.com"); send({ type: "cobranza-listo", marca: "lumaggs" }, window.location.origin, window);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("guarda y responde con el reqId sin mezclar marcas", async () => {
    mocks.roles = ["admin"]; const { send, post } = setup();
    send({ type: "cobranza-guardar", marca: "lumaggs", reqId: "r1", corte: "2026-10-28", rows: [{ folio: "123" }] });
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("cobranza_guardar_facturas", { _marca: "lumaggs", _corte: "2026-10-28", _rows: [{ folio: "123" }] }));
    await waitFor(() => expect(post).toHaveBeenCalledWith({ type: "cobranza-guardar-res", reqId: "r1", ok: true }, window.location.origin));
  });
  it("entrega el mismo cuerpo al envío y confirma el resultado", async () => {
    mocks.roles = ["accounting"]; const { send, post } = setup(); const body = { type: "cobranza-enviar", marca: "lumaggs", reqId: "r2", user_id: "u1", pdf: "base64" }; send(body);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("cobranza-enviar", { body }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: "cobranza-enviar-res", reqId: "r2", ok: true }), window.location.origin));
  });
});