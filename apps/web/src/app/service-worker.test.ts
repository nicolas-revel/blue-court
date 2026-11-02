import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: Record<string, unknown>) => void;

/** Runs `public/sw.js` with a fake worker scope and cache storage. */
function loadWorker(cacheNames: string[]) {
  const listeners: Record<string, Listener> = {};
  const deleted: string[] = [];
  const scope = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
  };
  const caches = {
    keys: async () => cacheNames,
    delete: async (name: string) => {
      deleted.push(name);
      return true;
    },
    open: async () => ({ put: async () => {} }),
    match: async () => undefined,
  };
  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  new Function("self", "caches", "fetch", source)(scope, caches, async () => new Response("ok"));
  return { listeners, deleted, scope };
}

const navigation = (path: string) => {
  const respondWith = vi.fn();
  return {
    respondWith,
    request: { method: "GET", mode: "navigate", url: `https://tournois.example.fr${path}` },
  };
};

describe("service worker", () => {
  it("drops the caches of older versions when it activates", async () => {
    const { listeners, deleted, scope } = loadWorker(["blue-court-v1", "blue-court-v0", "other"]);
    let done: Promise<unknown> = Promise.resolve();
    listeners.activate?.({ waitUntil: (promise: Promise<unknown>) => (done = promise) });
    await done;
    expect(deleted).toEqual(["blue-court-v0", "other"]);
    expect(scope.clients.claim).toHaveBeenCalled();
  });

  it("never handles the organizer area, so its pages are never cached", () => {
    const { listeners } = loadWorker([]);
    for (const path of ["/organizer", "/organizer/login", "/organizer/t1/schedule"]) {
      const event = navigation(path);
      listeners.fetch?.(event);
      expect(event.respondWith).not.toHaveBeenCalled();
    }
  });

  it("keeps public pages available offline", () => {
    const { listeners } = loadWorker([]);
    for (const path of ["/", "/organizers-guide"]) {
      const event = navigation(path);
      listeners.fetch?.(event);
      expect(event.respondWith).toHaveBeenCalled();
    }
  });
});
