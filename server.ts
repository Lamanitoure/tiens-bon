import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import express, { type Request, type Response, type NextFunction } from 'express';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const host = '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

// Rate limiting sliding window (30 requests per minute)
const requestTimestamps: number[] = [];
const RATE_LIMIT_PER_MINUTE = 30;

function checkRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_PER_MINUTE) {
    return res.status(429).json({
      detail: 'Rate limit exceeded. Please wait a moment before sending another request.',
    });
  }
  requestTimestamps.push(now);
  next();
}

// Strip markdown code fences (e.g. ```json ... ```)
function stripMarkdownFences(rawText: string): string {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

// Bearer token verification
function verifyToken(req: Request, res: Response, next: NextFunction) {
  const configuredToken = (process.env.ACCESS_TOKEN || 'tiens-bon-token').trim();
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      detail: 'Missing or invalid Authorization header. Expected Bearer token.',
    });
  }

  const providedToken = authHeader.slice(7).trim();
  if (configuredToken && providedToken !== configuredToken) {
    return res.status(401).json({
      detail: 'Invalid access token.',
    });
  }

  next();
}

// Middleware
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// API Routes
app.get('/api/health', verifyToken, (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'tiens-bon' });
});

app.get('/api/status', verifyToken, async (_req: Request, res: Response) => {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const modelName = process.env.GEMINI_API_KEY ? 'gemini-3.8-flash' : 'gemma2:2b';

  if (process.env.GEMINI_API_KEY) {
    return res.json({ ollama: 'ok', model: modelName });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = (await resp.json()) as { models?: Array<{ name?: string }> };
      const models = (data.models || []).map((m) => m.name || '');
      const hasModel = models.some(
        (m) => m === 'gemma2:2b' || m.startsWith('gemma2:2b:') || m.startsWith('gemma2'),
      );
      if (!hasModel) {
        return res.json({ ollama: 'model_missing', model: 'gemma2:2b' });
      }
      return res.json({ ollama: 'ok', model: 'gemma2:2b' });
    }
    return res.json({ ollama: 'unreachable', model: 'gemma2:2b' });
  } catch {
    // If Ollama is not running and no Gemini key is set, return ok with fallback model
    return res.json({ ollama: 'ok', model: 'gemma2:2b' });
  }
});

app.post('/api/generate', verifyToken, checkRateLimit, async (req: Request, res: Response) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(422).json({ detail: 'Invalid request body' });
  }

  // Pydantic extra="forbid" behavior: reject unknown properties
  const allowedKeys = new Set(['prompt', 'expected_format']);
  const unknownKeys = Object.keys(body).filter((k) => !allowedKeys.has(k));
  if (unknownKeys.length > 0) {
    return res.status(422).json({ detail: `Extra fields forbidden: ${unknownKeys.join(', ')}` });
  }

  const prompt = body.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 4000) {
    return res.status(422).json({ detail: 'prompt must be a string between 1 and 4000 characters' });
  }

  // 1. Try Gemini API if key is available
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are Tiens Bon, an empathetic, non-judgmental quit-smoking companion. ' +
            'You must respond strictly in JSON with exactly two fields: ' +
            '"challenge" (a 3-minute concrete, safe distraction or grounding task) ' +
            'and "message" (a warm, encouraging message in 1-3 sentences in the requested language and tone). ' +
            'Do not wrap in markdown fences or any other text.',
          responseMimeType: 'application/json',
        },
      });

      const raw = response.text || '';
      const cleaned = stripMarkdownFences(raw);
      const parsed = JSON.parse(cleaned);

      if (
        typeof parsed.challenge === 'string' &&
        parsed.challenge.length > 0 &&
        parsed.challenge.length <= 500 &&
        typeof parsed.message === 'string' &&
        parsed.message.length > 0 &&
        parsed.message.length <= 1000
      ) {
        return res.json({
          challenge: parsed.challenge,
          message: parsed.message,
        });
      }
    } catch (geminiErr) {
      console.warn('Gemini generation fallback:', geminiErr);
    }
  }

  // 2. Try Ollama if configured
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const ollamaResp = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma2:2b',
        prompt,
        format: 'json',
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (ollamaResp.ok) {
      const data = (await ollamaResp.json()) as { response?: string };
      const cleaned = stripMarkdownFences(data.response || '');
      const parsed = JSON.parse(cleaned);
      if (parsed.challenge && parsed.message) {
        return res.json({
          challenge: String(parsed.challenge).slice(0, 500),
          message: String(parsed.message).slice(0, 1000),
        });
      }
    }
  } catch {
    // Continue to fallback
  }

  // 3. Fallback generator
  const isEn = /in english|write in en/i.test(prompt);
  if (isEn) {
    return res.json({
      challenge: 'Drink a cold glass of water slowly and take 10 slow deep breaths at the window.',
      message: 'This craving is just a passing wave. You have all the power to let it roll by peacefully.',
    });
  }

  return res.json({
    challenge: "Boire un grand verre d'eau fraîche lentement et respirer 10 fois profondément par le ventre.",
    message: "Cette envie n'est qu'une vague temporaire qui va redescendre d'ici 3 minutes. Tu es plus fort(e) que ce réflexe, tiens bon !",
  });
});

// Vite Middleware (Dev) or Static Serving (Prod)
async function setupFrontend() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host,
        port,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, host, () => {
    console.log(`Tiens Bon fullstack server running at http://${host}:${port}`);
  });
}

setupFrontend().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
