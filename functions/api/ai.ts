type Env = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

const DEFAULT_MODEL = 'gpt-4.1-mini';
const ALLOWED_MODELS = new Set(['gpt-4.1-mini', 'gpt-4.1']);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function sanitizeModel(input: unknown, envDefault: string | undefined): string {
  const model = typeof input === 'string' ? input.trim() : '';
  if (ALLOWED_MODELS.has(model)) return model;
  const fallback = (envDefault ?? '').trim();
  if (ALLOWED_MODELS.has(fallback)) return fallback;
  return DEFAULT_MODEL;
}

function sanitizeTools(input: unknown): Array<{ type: 'web_search_preview' }> {
  if (!Array.isArray(input)) return [];
  const hasWebSearch = input.some((entry) => {
    const tool = entry as { type?: unknown } | null;
    return tool?.type === 'web_search_preview';
  });
  return hasWebSearch ? [{ type: 'web_search_preview' }] : [];
}

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { error?: { message?: unknown } };
  const message = typeof record.error?.message === 'string' ? record.error.message.trim() : '';
  return message || null;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const apiKey = (context.env.OPENAI_API_KEY ?? '').trim();
  if (!apiKey) {
    return jsonResponse(
      {
        error: {
          message:
            'AI backend non configurato: manca OPENAI_API_KEY nelle variabili ambiente di Cloudflare.'
        }
      },
      500
    );
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: { message: 'Payload JSON non valido.' } }, 400);
  }

  const payload = body as {
    model?: unknown;
    instructions?: unknown;
    input?: unknown;
    tools?: unknown;
    tool_choice?: unknown;
  };

  if (typeof payload.instructions !== 'string' || !Array.isArray(payload.input)) {
    return jsonResponse({ error: { message: 'Payload incompleto: instructions/input richiesti.' } }, 400);
  }

  const model = sanitizeModel(payload.model, context.env.OPENAI_MODEL);
  const tools = sanitizeTools(payload.tools);
  const toolChoice = payload.tool_choice === 'auto' ? 'auto' : 'auto';

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      instructions: payload.instructions,
      input: payload.input,
      tools,
      tool_choice: toolChoice
    })
  });

  const rawText = await upstream.text();
  let upstreamJson: unknown = null;
  try {
    upstreamJson = rawText ? JSON.parse(rawText) : null;
  } catch {
    upstreamJson = null;
  }

  if (!upstream.ok) {
    const message =
      readErrorMessage(upstreamJson) ??
      (rawText ? rawText.slice(0, 240) : `OpenAI error (${upstream.status})`);
    return jsonResponse(
      {
        error: {
          message: `Richiesta AI fallita (${upstream.status}). ${message}`
        }
      },
      upstream.status
    );
  }

  return jsonResponse(upstreamJson ?? {}, 200);
}

