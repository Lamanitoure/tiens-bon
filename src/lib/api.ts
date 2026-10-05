import { type CravingOutput, CravingOutputSchema } from '../schemas/model.ts';

export interface ModelStatus {
  ollama: 'ok' | 'unreachable' | 'model_missing' | 'unauthorized';
  model: string;
  error?: string;
}

export function getStoredToken(): string {
  try {
    return localStorage.getItem('tb_api_token') || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem('tb_api_token', token.trim());
  } catch {
    // ignore
  }
}

export function getStoredOllamaUrl(): string {
  try {
    return localStorage.getItem('tb_ollama_url') || '';
  } catch {
    return '';
  }
}

export function setStoredOllamaUrl(url: string): void {
  try {
    localStorage.setItem('tb_ollama_url', url.trim());
  } catch {
    // ignore
  }
}

export async function checkModelStatus(): Promise<ModelStatus> {
  const token = getStoredToken();
  if (!token) {
    return {
      ollama: 'unauthorized',
      model: 'gemma2:2b',
      error: 'Token not set in app settings.',
    };
  }

  const customUrl = getStoredOllamaUrl();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (customUrl) {
    headers['X-Ollama-Url'] = customUrl;
  }

  try {
    const res = await fetch('/api/status', {
      headers,
    });

    if (res.status === 401) {
      return {
        ollama: 'unauthorized',
        model: 'gemma2:2b',
        error: 'Invalid access token (401). Check .env and app settings.',
      };
    }

    if (!res.ok) {
      return {
        ollama: 'unreachable',
        model: 'gemma2:2b',
        error: `Server returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      ollama: data.ollama,
      model: data.model || 'gemma2:2b',
    };
  } catch (_err) {
    return {
      ollama: 'unreachable',
      model: 'gemma2:2b',
      error: 'Network connection failed.',
    };
  }
}

export async function generateMotivation(prompt: string): Promise<CravingOutput> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Missing access token. Please enter your ACCESS_TOKEN in settings.');
  }

  const customUrl = getStoredOllamaUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (customUrl) {
    headers['X-Ollama-Url'] = customUrl;
  }

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      expected_format: 'craving',
    }),
  });

  if (res.status === 401) {
    throw new Error('401 Unauthorized: Invalid access token.');
  }

  if (res.status === 429) {
    throw new Error('429 Rate limit exceeded. Please wait a moment.');
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) detail = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(`Generation failed: ${detail}`);
  }

  const rawJson = await res.json();
  const parsed = CravingOutputSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error(
      `Model output schema error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  return parsed.data;
}
