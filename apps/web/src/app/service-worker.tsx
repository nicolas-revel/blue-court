"use client";

import { useEffect } from "react";

/** Registers the service worker that makes the app installable and usable offline. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}
