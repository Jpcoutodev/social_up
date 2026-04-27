// Supabase Edge Function: proxy-image
// Downloads an external image server-side and returns it as binary blob.
// This avoids CORS restrictions when fetching MiniMax/Aliyun OSS images from the browser.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing "url" parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return new Response(JSON.stringify({ error: 'Invalid URL protocol' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[proxy-image] Fetching:', url.slice(0, 100));

    const imageRes = await fetch(url);

    if (!imageRes.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream error: ${imageRes.status} ${imageRes.statusText}` }),
        {
          status: imageRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';

    console.log('[proxy-image] Success, size:', imageBuffer.byteLength, 'type:', contentType);

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[proxy-image] Error:', error);
    return new Response(
      JSON.stringify({ error: `Proxy error: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
