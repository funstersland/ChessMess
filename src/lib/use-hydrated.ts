import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Use it to show
 * per-browser settings (from localStorage) only once the server-rendered HTML
 * has been adopted, so the first client render matches the server exactly.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
