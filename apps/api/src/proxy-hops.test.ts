import { describe, expect, it } from "vitest";
import { proxyHops } from "./proxy-hops.js";

describe("proxy hops setting", () => {
  it("defaults to no proxy and reads a whole number", () => {
    expect(proxyHops(undefined)).toBe(0);
    expect(proxyHops("")).toBe(0);
    expect(proxyHops("1")).toBe(1);
  });

  it("refuses anything else", () => {
    for (const value of ["one", "-1", "1.5", "true"]) expect(() => proxyHops(value)).toThrow();
  });
});
