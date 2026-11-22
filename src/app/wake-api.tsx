"use client";

import { useEffect } from "react";

/**
 * Wakes the sleeping API from the browser when the console opens. The host wakes a free service for a browser request but
 * not always for this server's own requests (on 22 November it answered them with 429 and the API stayed asleep).
 */
export function WakeApi({ url }: { url: string | null }) {
  useEffect(() => {
    if (!url) return;
    void fetch(url, { mode: "no-cors", cache: "no-store", credentials: "omit" }).catch(() => undefined);
  }, [url]);
  return null;
}
