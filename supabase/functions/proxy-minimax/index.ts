// Supabase Edge Function: proxy-minimax
// Server-side proxy for MiniMax API calls.
// Validates user JWT, uses MINIMAX_API_KEY/MINIMAX_GROUP_ID from env, logs usage.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const MINIMAX_BASE = 'https://api.minimaxi.chat/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });

interface RequestBody {
  action: 'chat' | 'image' | 'image_edit' | 'tts';
  payload: Record<string, unknown>;
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
  const { action, payload, metadata } = body;
  if (!action || !payload) return json({ error: 'Missing action or payload' }, 400);

  // 3. Get secrets
  const apiKey = Deno.env.get('MINIMAX_API_KEY');
  const groupId = Deno.env.get('MINIMAX_GROUP_ID');
  if (!apiKey) return json({ error: 'MINIMAX_API_KEY not configured on server' }, 500);

  // 4. Route the call
  let upstreamUrl: string;
  let upstreamBody: string;
  switch (action) {
    case 'chat':
      upstreamUrl = `${MINIMAX_BASE}/text/chatcompletion_v2`;
      upstreamBody = JSON.stringify(payload);
      break;
    case 'image':
    case 'image_edit':
      upstreamUrl = `${MINIMAX_BASE}/image_generation`;
      upstreamBody = JSON.stringify(payload);
      break;
    case 'tts':
      if (!groupId) return json({ error: 'MINIMAX_GROUP_ID not configured on server' }, 500);
      upstreamUrl = `${MINIMAX_BASE}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`;
      upstreamBody = JSON.stringify(payload);
      break;
    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }

  // 5. Call MiniMax
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: upstreamBody,
    });
  } catch (e) {
    console.error('[proxy-minimax] Network error:', e);
    return json({ error: 'Failed to reach MiniMax' }, 502);
  }

  const responseText = await upstreamRes.text();
  if (!upstreamRes.ok) {
    console.error('[proxy-minimax] Upstream error:', upstreamRes.status, responseText.slice(0, 300));
    return json({ error: `MiniMax error (${upstreamRes.status}): ${responseText.slice(0, 500)}` }, upstreamRes.status);
  }

  // 6. Log usage (best-effort — failure here doesn't break the request)
  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    let unitsIn = 0;
    let unitsOut = 0;
    let costEstimate = 0;

    if (action === 'chat') {
      const parsed = JSON.parse(responseText);
      unitsIn = parsed?.usage?.prompt_tokens || 0;
      unitsOut = parsed?.usage?.completion_tokens || 0;
      // MiniMax-Text-01: ~$0.20/1M input, $1.10/1M output
      costEstimate = (unitsIn * 0.0000002) + (unitsOut * 0.0000011);
    } else if (action === 'image' || action === 'image_edit') {
      unitsOut = 1;
      costEstimate = 0.01; // image-01 ≈ $0.01 per image
    } else if (action === 'tts') {
      const parsed = JSON.parse(responseText);
      const audioLen = parsed?.extra_info?.audio_length || 0;
      unitsOut = Math.ceil(audioLen / 1000);
      costEstimate = unitsOut * 0.001; // speech-02-hd ≈ $0.001 per second
    }

    await adminClient.from('usage_log').insert({
      user_id: user.id,
      user_email: user.email || '',
      provider: 'minimax',
      action,
      units_in: unitsIn,
      units_out: unitsOut,
      estimated_cost_usd: costEstimate,
      metadata: metadata || null,
    });
  } catch (logErr) {
    console.warn('[proxy-minimax] usage_log insert failed (non-fatal):', logErr);
  }

  // 7. Return upstream response untouched
  return new Response(responseText, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
