import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Mailer } from "./mailer.js";

const mail = { to: "coach@club.fr", subject: "Reset", text: "https://example.fr/#secret-token" };

function logged(env: Record<string, string>): string {
  vi.stubEnv("SMTP_URL", "");
  vi.stubEnv("WEB_ORIGIN", "http://localhost:3000");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const lines: string[] = [];
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
      lines.push(String(message));
    });
  }
  const mailer = new Mailer();
  void mailer.send(mail);
  return lines.join("\n");
}

describe("Mailer without SMTP_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs the whole email with MAIL_LOG_BODY=1 (local use)", () => {
    expect(logged({ NODE_ENV: "production", MAIL_LOG_BODY: "1" })).toContain("secret-token");
  });

  it("never logs the email body otherwise, whatever NODE_ENV says, and warns", () => {
    for (const [nodeEnv, value] of [
      ["production", ""],
      ["production", "0"],
      ["development", ""],
      ["", "true"],
    ]) {
      const output = logged({ NODE_ENV: nodeEnv ?? "", MAIL_LOG_BODY: value ?? "" });
      expect(output).not.toContain("secret-token");
      expect(output).toContain("will not be sent");
      expect(output).toContain("coach@club.fr");
      vi.restoreAllMocks();
    }
  });

  it("ignores MAIL_LOG_BODY=1 on a site served over HTTPS, and says so", () => {
    const output = logged({ MAIL_LOG_BODY: "1", WEB_ORIGIN: "https://tournois.example.fr" });
    expect(output).not.toContain("secret-token");
    expect(output).toContain("MAIL_LOG_BODY=1 is ignored");
  });
});
