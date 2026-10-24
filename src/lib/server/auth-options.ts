import { createServerFn } from "@tanstack/react-start";

/**
 * Which sign-in methods actually work here. Google/X go through the auth
 * broker, which only accepts this site when it has its own client
 * (GROK_AUTH_CLIENT_ID); the built-in preview client only works on Grok
 * sandbox hosts. Without either, the buttons would lead to an error, so the
 * login page hides them and offers email instead.
 */
export const getSignInOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  let host = "";
  try {
    const req = getRequest();
    host = req ? new URL(req.url).hostname : "";
  } catch {
    host = "";
  }
  const ownClient = Boolean(process.env.GROK_AUTH_CLIENT_ID?.trim());
  return { oauth: ownClient || host.endsWith(".grok-sandbox.com") };
});
