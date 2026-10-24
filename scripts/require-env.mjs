#!/usr/bin/env node
/**
 * Production start guard (used by `npm start`, i.e. Railway).
 *
 * Without DATABASE_URL the app silently falls back to an in-memory database
 * and every redeploy wipes all accounts and games; without BETTER_AUTH_SECRET
 * every restart signs everyone out. Fail the deploy loudly instead.
 *
 * Set ALLOW_EPHEMERAL_DB=1 to run a built copy locally without a database.
 */
const missing = ["DATABASE_URL", "BETTER_AUTH_SECRET"].filter((k) => !process.env[k]?.trim());

if (missing.length && process.env.ALLOW_EPHEMERAL_DB !== "1") {
  console.error(
    `[start] Missing required environment variable(s): ${missing.join(", ")}.\n` +
      "        Set them in your host's variables (see railway.toml), or set\n" +
      "        ALLOW_EPHEMERAL_DB=1 to run with a throwaway in-memory database.",
  );
  process.exit(1);
}
