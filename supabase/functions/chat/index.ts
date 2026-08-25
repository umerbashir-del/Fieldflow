// supabase/functions/chat/index.ts
//
// Matches chatbot/apiFallback.js: reads { query, accountId }, returns
// { text, source? }. Placeholder logic below — swap the `text` line for a
// real AI call (OpenAI, Anthropic, etc.) when you're ready.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, accountId } = await req.json();

    const text = `You asked: "${query}". I don't have a live AI hooked up yet, but the connection works end to end.`;

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
