import fetch from 'node-fetch';

const BASE_URL = process.env.SERVER_INSTANCE?.trim();
const API_KEY  = process.env.IBM_KEY?.trim();

const TOKEN_URL = 'https://iam.platform.saas.ibm.com/siusermgr/api/1.0/apikeys/token';

// Cache the JWT so we don't re-exchange on every agent call
let cachedToken     = null;
let tokenExpiresAt  = 0;

async function getJWT() {
  // Reuse if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify({ apikey: API_KEY }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`JWT exchange failed ${res.status}: ${err}`);
  }

  const data = await res.json();

  // The response contains the token — field name varies, try common ones
  cachedToken    = data.token ?? data.access_token ?? data.jwt ?? data.id_token;
  // Default expiry 3600s if not provided
  const expiresIn = data.expires_in ?? data.expiration ?? 3600;
  tokenExpiresAt  = Date.now() + expiresIn * 1000;

  if (!cachedToken) {
    throw new Error(`JWT exchange: no token field in response — ${JSON.stringify(data)}`);
  }

  console.log('[orchestrateClient] JWT token refreshed');
  return cachedToken;
}

/**
 * Send a message to a deployed watsonx Orchestrate agent.
 *
 * @param {string} agentId  - The agent's UUID from .env
 * @param {string} userMsg  - The prompt text to send
 * @returns {string}        - The agent's plain-text response
 */
export async function invokeAgent(agentId, userMsg) {
  if (!BASE_URL || !API_KEY) throw new Error('Missing SERVER_INSTANCE or IBM_KEY in .env');
  if (!agentId)              throw new Error('Missing agent ID — add it to .env');

  const jwt = await getJWT();
  const url = `${BASE_URL}/v1/orchestrate/${agentId}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: userMsg }],
      stream: false
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Orchestrate API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Handle standard OpenAI-compatible response or IBM-specific shapes
  const content = data?.choices?.[0]?.message?.content
    ?? data?.output?.text
    ?? data?.response
    ?? JSON.stringify(data);

  return content;
}

/**
 * Try to extract a JSON object from a free-text LLM response.
 * Falls back to returning the raw text wrapped in an object.
 */
export function extractJSON(text) {
  try { return JSON.parse(text); } catch {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1]); } catch {} }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch {} }

  return { raw: text };
}
