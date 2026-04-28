// Supabase Edge Function: proxy-gemini
// Server-side proxy for Google Gemini API (text + multimodal image generation).
// Validates user JWT, uses GEMINI_API_KEY from env, logs usage.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface RequestBody {
  action: 'chat' | 'image_edit';
  model: string;                      // e.g. 'gemini-2.5-flash-image' | 'gemini-3-flash-preview'
  payload: Record<string, unknown>;   // Full Gemini generateContent body (contents, config, etc.)
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1. Validate JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Missing Authorization header' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Invalid or expired token' }, 401);

  // 2. Parse body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const { action, model, payload, metadata } = body;
  if (!action || !model || !payload) return json({ error: 'Missing action, model, or payload' }, 400);

  // 3. Get secret
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY not configured on server' }, 500);

  // 4. Call Gemini REST API directly
  const upstreamUrl = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[proxy-gemini] Network error:', e);
    return json({ error: 'Failed to reach Gemini' }, 502);
  }

  const responseText = await upstreamRes.text();
  if (!upstreamRes.ok) {
    console.error('[proxy-gemini] Upstream error:', upstreamRes.status, responseText.slice(0, 300));
    return json({ error: `Gemini error (${upstreamRes.status}): ${responseText.slice(0, 500)}` }, upstreamRes.status);
  }

  // 5. Log usage (best-effort)
  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    let unitsIn = 0;
    let unitsOut = 0;
    let costEstimate = 0;

    const parsed = JSON.parse(responseText);
    const um = parsed?.usageMetadata;
    if (um) {
      unitsIn = um.promptTokenCount || 0;
      unitsOut = um.candidatesTokenCount || 0;
    }

    if (action === 'image_edit') {
      // gemini-2.5-flash-image: ~$30/1M output tokens, image ≈ 1290 tokens
      costEstimate = (unitsOut / 1_000_000) * 30 + (unitsIn / 1_000_000) * 0.30;
    } else {
      // text models: rough average
      costEstimate = (unitsIn / 1_000_000) * 0.30 + (unitsOut / 1_000_000) * 2.50;
    }

    await adminClient.from('usage_log').insert({
      user_id: user.id,
      user_email: user.email || '',
      provider: 'gemini',
      action,
      units_in: unitsIn,
      units_out: unitsOut,
      estimated_cost_usd: costEstimate,
      metadata: { model, ...(metadata || {}) },
    });
  } catch (logErr) {
    console.warn('[proxy-gemini] usage_log insert failed (non-fatal):', logErr);
  }

  return new Response(responseText, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
