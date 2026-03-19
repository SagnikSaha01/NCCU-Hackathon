import fetch from 'node-fetch';

const BASE_URL = process.env.SERVER_INSTANCE?.trim();
const API_KEY  = process.env.IBM_KEY?.trim();

const TOKEN_URL = 'https://iam.platform.saas.ibm.com/siusermgr/api/1.0/apikeys/token';

// Appended to every agent prompt so the ReAct reasoning is visible in the response
const REASONING_INSTRUCTION = `

Before your JSON response, show your reasoning in exactly this format (do not skip any step):
THOUGHT: [your initial analysis of the inputs]
ACTION: [the specific check or analysis you are performing]
OBSERVATION: [what you found from that check]
ANSWER: [your conclusion in one sentence]

Then provide the JSON.`;

let cachedToken    = null;
let tokenExpiresAt = 0;

async function getJWT() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify({ apikey: API_KEY }),
  });

  if (!res.ok) throw new Error(`JWT exchange failed ${res.status}: ${await res.text()}`);

  const data      = await res.json();
  cachedToken     = data.token ?? data.access_token ?? data.jwt ?? data.id_token;
  const expiresIn = data.expires_in ?? data.expiration ?? 3600;
  tokenExpiresAt  = Date.now() + expiresIn * 1000;

  if (!cachedToken) throw new Error(`JWT exchange: no token field — ${JSON.stringify(data)}`);
  console.log('[orchestrateClient] JWT token refreshed');
  return cachedToken;
}

/**
 * Extract THOUGHT / ACTION / OBSERVATION / ANSWER from a ReAct-style response.
 */
function extractTrace(text) {
  const get = (label, next) => {
    const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=${next}:|\\{|\`\`\`|$)`, 'i');
    return text.match(pattern)?.[1]?.trim() ?? null;
  };
  return {
    thought:     get('THOUGHT',     'ACTION'),
    action:      get('ACTION',      'OBSERVATION'),
    observation: get('OBSERVATION', 'ANSWER'),
    answer:      get('ANSWER',      'THOUGHT|\\{|\`\`\`'),
  };
}

/**
 * Send a message to a deployed watsonx Orchestrate agent.
 * Returns { content: string, trace: { thought, action, observation, answer } }
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
      messages: [{ role: 'user', content: userMsg + REASONING_INSTRUCTION }],
      stream: false
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Orchestrate API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content
    ?? data?.output?.text
    ?? data?.response
    ?? JSON.stringify(data);

  const trace = extractTrace(content);
  return { content, trace };
}

/**
 * Try to extract a JSON object from a free-text LLM response.
 */
export function extractJSON(text) {
  try { return JSON.parse(text); } catch {}

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1]); } catch {} }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch {} }

  return { raw: text };
}
