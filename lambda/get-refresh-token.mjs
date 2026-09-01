/**
 * ONE-TIME local script: obtain a Google OAuth refresh token for the
 * Business Profile API using YOUR Google account (Manager on the profile).
 *
 * Setup (Google Cloud Console, project def-cutz-muskoka):
 *   1. APIs & Services > OAuth consent screen:
 *      - User type: External, fill in app name + your email
 *      - Publishing status must be "In production" (click "Publish app"),
 *        otherwise the refresh token expires after 7 days
 *   2. APIs & Services > Credentials > Create Credentials > OAuth client ID:
 *      - Application type: "Desktop app"
 *      - Copy the Client ID and Client Secret
 *
 * Run locally (Node 18+):
 *   node get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * A browser URL is printed, open it, sign in with the Google account that
 * is a Manager on the Business Profile, and approve. (If Google shows an
 * "unverified app" warning, click Advanced > Continue, it's your own app.)
 * The refresh token is printed to the terminal when done.
 */

import { createServer } from "http";
import { randomBytes } from "crypto";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("Usage: node get-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const PORT = 53682;
const REDIRECT_URI = `http://127.0.0.1:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/business.manage";
const state = randomBytes(16).toString("hex");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");

  if (!code || url.searchParams.get("state") !== state) {
    res.writeHead(400).end("Missing or invalid authorization code.");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h2>Done, you can close this tab and return to the terminal.</h2>");
  server.close();

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.refresh_token) {
    console.error("Token exchange failed:", JSON.stringify(tokens, null, 2));
    process.exit(1);
  }

  console.log("\n=== SUCCESS ===");
  console.log("Store these as SecureString parameters, then the Lambda reads them:\n");
  // The client id and secret are not echoed back: you already have them, and
  // reprinting a secret puts it in the terminal scrollback for no reason.
  console.log("  /<prefix>/google-oauth-client-id      (the client id you passed in)");
  console.log("  /<prefix>/google-oauth-client-secret  (the client secret you passed in)");
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  console.log("Keep the refresh token secret, it grants access to the Business Profile.");
});

server.listen(PORT, () => {
  console.log("Open this URL in your browser and approve access:\n");
  console.log(authUrl + "\n");
  console.log("Waiting for Google to redirect back...");
});
