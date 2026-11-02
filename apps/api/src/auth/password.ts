import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from "node:crypto";

/**
 * One of OWASP's equivalent scrypt settings (N = 2^14, r = 8, p = 5): it uses 16 MiB per hash
 * instead of 128 MiB for N = 2^17, which suits a small server signing several people in at once.
 */
const COST = { N: 2 ** 14, r: 8, p: 5, maxmem: 64 * 1024 * 1024 } satisfies ScryptOptions;
const KEY_LENGTH = 32;

const derive = (password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

/** Hashes a password as `scrypt$N$r$p$salt$key`, so the cost can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join(
    "$",
  );
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = hash.split("$");
  if (scheme !== "scrypt" || salt === undefined || key === undefined) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: COST.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hashed once, so that signing in with an unknown email takes as long as with a wrong password. */
export const decoyHash: Promise<string> = hashPassword(randomBytes(16).toString("hex"));
