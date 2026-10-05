import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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

function safeCompareTokens(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
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
  if (configuredToken && !safeCompareTokens(providedToken, configuredToken)) {
    return res.status(401).json({
      detail: 'Invalid access token.',
    });
  }

  next();
}

interface WearableTriggerEvent {
  id: string;
  type: 'craving';
  timestamp: number;
  source?: string;
  context?: string;
}

let activeWearableTrigger: WearableTriggerEvent | null = null;

// Bearer or Query token verification (Step 18: smartwatch shortcuts support query or header)
function verifyTokenOrQuery(req: Request, res: Response, next: NextFunction) {
  const configuredToken = (process.env.ACCESS_TOKEN || 'tiens-bon-token').trim();
  const authHeader = req.headers.authorization || '';
  let providedToken = '';

  if (authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.slice(7).trim();
  } else if (typeof req.query.token === 'string') {
    providedToken = req.query.token.trim();
  }

  if (!providedToken) {
    return res.status(401).json({
      detail: 'Missing access token. Provide Authorization: Bearer <token> or ?token=<token>',
    });
  }

  if (configuredToken && !safeCompareTokens(providedToken, configuredToken)) {
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
  if (isProd) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'",
    );
  }
  next();
});

// API Routes
app.get('/api/health', verifyToken, (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'tiens-bon' });
});

app.get('/api/status', verifyToken, async (req: Request, res: Response) => {
  const customUrl = req.headers['x-ollama-url'];
  const ollamaUrl =
    typeof customUrl === 'string' && customUrl.trim()
      ? customUrl.trim()
      : process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const preferredModel = process.env.OLLAMA_MODEL || 'gemma2:2b';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = (await resp.json()) as { models?: Array<{ name?: string }> };
      const models = (data.models || []).map((m) => m.name || '');
      const matchedModel =
        models.find((m) => m === preferredModel || m.startsWith(`${preferredModel}:`)) ||
        models.find((m) => m.startsWith('gemma2') || m.startsWith('gemma3') || m.startsWith('gemma'));

      if (!matchedModel) {
        return res.json({
          ollama: 'model_missing',
          model: preferredModel,
          url: ollamaUrl,
        });
      }
      return res.json({
        ollama: 'ok',
        model: matchedModel,
        url: ollamaUrl,
      });
    }
    return res.json({ ollama: 'unreachable', model: preferredModel, url: ollamaUrl });
  } catch {
    return res.json({ ollama: 'unreachable', model: preferredModel, url: ollamaUrl });
  }
});

// Step 18: Wearable trigger endpoint (GET /api/trigger/craving)
app.get('/api/trigger/craving', verifyTokenOrQuery, (req: Request, res: Response) => {
  const source = typeof req.query.source === 'string' ? req.query.source.slice(0, 50) : 'wearable';
  const context = typeof req.query.context === 'string' ? req.query.context.slice(0, 100) : undefined;

  activeWearableTrigger = {
    id: `trig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: 'craving',
    timestamp: Date.now(),
    source,
    context,
  };

  res.json({
    status: 'ready',
    session: 'craving',
    timestamp: activeWearableTrigger.timestamp,
    id: activeWearableTrigger.id,
    message: 'Craving flow readied for user.',
  });
});

app.get('/api/trigger/status', verifyTokenOrQuery, (_req: Request, res: Response) => {
  res.json({
    activeTrigger: activeWearableTrigger,
  });
});

app.post('/api/trigger/consume', verifyTokenOrQuery, (_req: Request, res: Response) => {
  activeWearableTrigger = null;
  res.json({ status: 'consumed' });
});

app.post('/api/data/clear', verifyToken, (_req: Request, res: Response) => {
  activeWearableTrigger = null;
  res.json({ status: 'cleared' });
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

  const isCheckin = body.expected_format === 'checkin';
  const isRecap = body.expected_format === 'recap';

  // 1. Local open-source Ollama model (Gemma)
  const customUrl = req.headers['x-ollama-url'];
  const ollamaUrl =
    typeof customUrl === 'string' && customUrl.trim()
      ? customUrl.trim()
      : process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'gemma2:2b';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const ollamaResp = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
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
      let parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed = parsed[0];
      }
      res.setHeader('X-Model-Source', `ollama-${ollamaModel}`);
      console.log(`[Tiens Bon] ✓ Réponse générée en direct par Ollama (${ollamaModel})`);

      if (isCheckin) {
        const validOutcomes = new Set(['resisted', 'smoked', 'unknown']);
        const outcome = validOutcomes.has(parsed.outcome) ? parsed.outcome : 'unknown';
        return res.json({
          trigger: String(parsed.trigger || 'Bilan de soirée').slice(0, 200),
          emotion: String(parsed.emotion || 'Serein').slice(0, 100),
          outcome,
        });
      }

      if (isRecap && parsed.message) {
        return res.json({
          message: String(parsed.message).slice(0, 1000),
        });
      }

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

  res.setHeader('X-Model-Source', 'local-fallback');
  console.log('[Tiens Bon] ℹ IA externe non disponible -> réponse de secours locale utilisée');

  // 3. Robust fallback generator
  if (isCheckin) {
    const norm = prompt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const resistedPatterns = [
      'pas fume',
      'sans fumer',
      'sans clope',
      'pas craque',
      'tenu bon',
      'tenu',
      'resiste',
      'zero cigarette',
      'zero clope',
      'pas touche',
      'reussi a tenir',
      'evite de fumer',
      'surmonte',
      'rien fume',
      'aucune cigarette',
      'aucune clope',
    ];
    const smokedPatterns = [
      'ai fume',
      'ai craque',
      'ai pris une clope',
      'ai allume',
      'fume une',
      'pris une cigarette',
      'fume 1',
      'fume 2',
      'fume 3',
      'fume 4',
      'fume 5',
      'fume plusieurs',
      'fume quelques',
      'rechute',
      'craquage',
      'craque',
      'clope',
      'allume',
      'smoked',
    ];
    const hasResistedPhrase = resistedPatterns.some((p) => norm.includes(p));
    const hasSmokedPhrase =
      smokedPatterns.some((p) => norm.includes(p)) ||
      (norm.includes('fume') && !norm.includes('pas fume') && !norm.includes('sans fumer'));

    let outcome: 'resisted' | 'smoked' | 'unknown' = 'resisted';
    if (hasSmokedPhrase && !hasResistedPhrase) {
      outcome = 'smoked';
    } else if (hasResistedPhrase && !hasSmokedPhrase) {
      outcome = 'resisted';
    } else if (hasResistedPhrase && hasSmokedPhrase) {
      const rIdx = Math.max(...resistedPatterns.map((p) => norm.lastIndexOf(p)));
      const sIdx = Math.max(...smokedPatterns.map((p) => norm.lastIndexOf(p)));
      outcome = sIdx > rIdx ? 'smoked' : 'resisted';
    }

    const emotion =
      norm.includes('stress') || norm.includes('angoisse')
        ? 'Stress'
        : norm.includes('fatig') || norm.includes('epuise')
          ? 'Fatigue'
          : norm.includes('fier') || norm.includes('victoire')
            ? 'Fierté'
            : 'Calme';

    const trigger = norm.includes('cafe')
      ? 'Café du matin'
      : norm.includes('soir') || norm.includes('apero') || norm.includes('amis')
        ? 'Soirée entre amis'
        : norm.includes('repas') || norm.includes('dejeuner')
          ? 'Après le repas'
          : norm.includes('travail') || norm.includes('boulot') || norm.includes('reunion')
            ? 'Journée de travail'
            : 'Bilan de journée';

    return res.json({
      trigger,
      emotion,
      outcome,
    });
  }

  if (isRecap) {
    const isEn = /write in en|in english/i.test(prompt);
    return res.json({
      message: isEn
        ? 'Every resisted craving is a true victory for your health and your wallet. Keep moving forward step by step.'
        : 'Bravo pour chaque envie surmontée cette semaine ! Vos victoires consolident votre liberté et vos économies grandissent chaque jour.',
    });
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
        hmr: false,
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
