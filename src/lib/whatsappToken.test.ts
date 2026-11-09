import { describe, expect, it } from "vitest";
import { whatsappTokenFor } from "../../supabase/functions/_shared/whatsapp-token";

const env = (vars: Record<string, string>) => (name: string) => vars[name];
const both = env({ WHATSAPP_ACCESS_TOKEN: "general", WHATSAPP_ACCESS_TOKEN_MARKETING: "marketing" });

describe("WhatsApp access token per line", () => {
  it("uses the Marketing token for the Marketing phone number", () => {
    expect(whatsappTokenFor({ phoneId: "1476909262169059" }, both)).toBe("marketing");
  });
  it("uses the Marketing token for the Marketing account templates", () => {
    expect(whatsappTokenFor({ wabaId: "1127465449904495" }, both)).toBe("marketing");
  });
  it("keeps the general token for Mexicali, Tijuana and Galsa", () => {
    expect(whatsappTokenFor({ phoneId: "1128863556971458" }, both)).toBe("general");
    expect(whatsappTokenFor({ phoneId: "498690943338066" }, both)).toBe("general");
    expect(whatsappTokenFor({ phoneId: "318296624690022", wabaId: "282327838294623" }, both)).toBe("general");
  });
  it("falls back to the general token if the Marketing token is missing", () => {
    expect(whatsappTokenFor({ phoneId: "1476909262169059" }, env({ WHATSAPP_ACCESS_TOKEN: "general" }))).toBe("general");
  });
});
