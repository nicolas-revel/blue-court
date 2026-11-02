import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Mailer } from "./mailer.js";

const mail = { to: "coach@club.fr", subject: "Reset", text: "https://example.fr/#secret-token" };

function logged(env: Record<string, string>): string {
  vi.stubEnv("SMTP_URL", "");
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

  it("logs the whole email outside production", () => {
    expect(logged({ NODE_ENV: "development" })).toContain("secret-token");
  });

  it("logs the whole email in production when MAIL_LOG_BODY=1 (local Compose)", () => {
    expect(logged({ NODE_ENV: "production", MAIL_LOG_BODY: "1" })).toContain("secret-token");
  });

  it("never logs the email body in production otherwise, and warns", () => {
    for (const value of ["", "0"]) {
      const output = logged({ NODE_ENV: "production", MAIL_LOG_BODY: value });
      expect(output).not.toContain("secret-token");
      expect(output).toContain("will not be sent");
      expect(output).toContain("coach@club.fr");
      vi.restoreAllMocks();
    }
  });
});
