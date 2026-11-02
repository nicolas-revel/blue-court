/**
 * How many proxies sit in front of the API (`TRUST_PROXY_HOPS`, 0 by default). A typo must stop
 * the start: a wrong value would put every visitor under one rate-limit bucket.
 */
export function proxyHops(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 0;
  const hops = Number(value);
  if (!Number.isSafeInteger(hops) || hops < 0) {
    throw new Error(`TRUST_PROXY_HOPS must be a whole number of proxies, got "${value}"`);
  }
  return hops;
}
