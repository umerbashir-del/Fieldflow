// supabase/functions/chat/index.ts
//
// Matches chatbot/apiFallback.js: reads { query, accountId }, returns
// { text, source? }. Placeholder logic below returns a generic fallback
// (deliberately not echoing the user's question) — swap the `text` line
// for a real AI call (OpenAI, Anthropic, etc.) when you're ready.
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
    await req.json(); // { query, accountId } — unused until a real AI call is wired in

    const text = "I don't have an answer for that yet. Try asking about creating a job, job statuses, your account, or your schedule — or reach out to your FieldFlow contact for anything else.";

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
