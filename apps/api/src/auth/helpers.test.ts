import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./auth.service.js";
import { hashPassword, verifyPassword } from "./password.js";
import { readSessionToken, SESSION_COOKIE } from "./session-cookie.js";

describe("password hashing", () => {
  // scrypt is slow on purpose, so few runs.
  it("accepts the hashed password and refuses any other", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 50 }), fc.string({ maxLength: 50 }), async (a, b) => {
        const hash = await hashPassword(a);
        expect(await verifyPassword(a, hash)).toBe(true);
        expect(await verifyPassword(b, hash)).toBe(a.normalize("NFKC") === b.normalize("NFKC"));
      }),
      { numRuns: 10 },
    );
  }, 30_000);

  it("treats Unicode-equivalent spellings as the same password", async () => {
    const composed = "café-volley-2026";
    const decomposed = composed.normalize("NFD");
    expect(decomposed).not.toBe(composed);
    expect(await verifyPassword(decomposed, await hashPassword(composed))).toBe(true);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("refuses a hash it cannot read", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (hash) => {
        fc.pre(!hash.startsWith("scrypt$"));
        expect(await verifyPassword("password", hash)).toBe(false);
      }),
    );
  });
});

describe("email normalization", () => {
  const email = fc.emailAddress({ size: "small" });

  it("ignores case and surrounding spaces", () => {
    fc.assert(
      fc.property(email, fc.string({ unit: fc.constantFrom(" ", "\t") }), (address, pad) => {
        expect(normalizeEmail(`${pad}${address.toUpperCase()}${pad}`)).toBe(
          normalizeEmail(address),
        );
      }),
    );
  });

  it("is idempotent, and only keeps strings with an @", () => {
    fc.assert(
      fc.property(fc.oneof(email, fc.string(), fc.anything()), (value) => {
        const normalized = normalizeEmail(value);
        if (normalized === undefined) return;
        expect(normalizeEmail(normalized)).toBe(normalized);
        expect(normalized).toContain("@");
      }),
    );
  });
});

describe("session cookie", () => {
  const token = fc.base64String({ minLength: 4 }).map((value) => value.replaceAll("=", ""));
  const otherCookie = fc
    .tuple(fc.stringMatching(/^[a-z_]{1,10}$/), fc.stringMatching(/^[\w=-]{0,10}$/))
    .filter(([name]) => name !== SESSION_COOKIE)
    .map(([name, value]) => `${name}=${value}`);

  it("finds the session token wherever it sits in the header", () => {
    fc.assert(
      fc.property(fc.array(otherCookie), fc.array(otherCookie), token, (before, after, value) => {
        const header = [...before, `${SESSION_COOKIE}=${value}`, ...after].join("; ");
        expect(readSessionToken(header)).toBe(value);
      }),
    );
  });

  it("never throws, and finds nothing without the cookie", () => {
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: undefined }), (header) => {
        const found = readSessionToken(header);
        if (!header?.includes(SESSION_COOKIE)) expect(found).toBeUndefined();
      }),
    );
  });
});
