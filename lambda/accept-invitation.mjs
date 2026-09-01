/**
 * ONE-TIME Lambda: Accept a pending Business Profile Manager invitation.
 *
 * Run this once, then delete it.
 *
 * Environment variables:
 *   GOOGLE_CREDENTIALS – Full service account JSON key
 */

import { createSign } from "crypto";

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/business.manage",
    aud: credentials.token_uri,
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const signatureInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signatureInput);
  const signature = sign.sign(credentials.private_key, "base64url");

  const jwt = `${signatureInput}.${signature}`;

  const res = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${body}`);
  return JSON.parse(body).access_token;
}

export const handler = async () => {
  if (!process.env.GOOGLE_CREDENTIALS) {
    return { statusCode: 500, body: "Missing GOOGLE_CREDENTIALS" };
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const accessToken = await getAccessToken(credentials);

    // Step 1: List accounts to find the service account's own account
    console.log("Step 1: Listing accounts...");
    const acctRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const acctData = await acctRes.json();
    console.log("Accounts:", JSON.stringify(acctData, null, 2));

    const accounts = acctData.accounts || [];
    if (accounts.length === 0) {
      return { statusCode: 404, body: "No accounts found" };
    }

    // Step 2: For each account, list pending invitations
    for (const account of accounts) {
      console.log(`Step 2: Listing invitations for ${account.name}...`);
      const invRes = await fetch(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/invitations`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const invBody = await invRes.text();
      console.log(`Invitations response (${invRes.status}):`, invBody);

      if (!invRes.ok) continue;

      const invData = JSON.parse(invBody);
      const invitations = invData.invitations || [];

      if (invitations.length === 0) {
        console.log("No pending invitations for this account");
        continue;
      }

      // Step 3: Accept each invitation
      for (const inv of invitations) {
        console.log(`Step 3: Accepting invitation ${inv.name}...`);
        const acceptRes = await fetch(
          `https://mybusinessaccountmanagement.googleapis.com/v1/${inv.name}:accept`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        const acceptBody = await acceptRes.text();
        console.log(`Accept response (${acceptRes.status}):`, acceptBody);
      }
    }

    // Step 4: Verify - list accounts again to see if new account appeared
    console.log("Step 4: Verifying - listing accounts again...");
    const verifyRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const verifyData = await verifyRes.json();
    console.log("Accounts after accepting:", JSON.stringify(verifyData, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify(verifyData, null, 2),
    };
  } catch (err) {
    console.error("Error:", err.message, err.stack);
    return { statusCode: 500, body: err.message };
  }
};
