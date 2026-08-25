// Called only when the local getAnswer() pipeline has nothing (see model.js).
// Invokes a Supabase Edge Function named "chat" — deploy one that accepts
// { query, accountId } and returns { text, source? } to enable this path.
// Until that function exists, invoke() rejects and callers should keep
// showing the local fallback message.
import { supabase } from './supabaseClient.js';

export async function askApi(query, accountId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('chat', {
      body: { query, accountId },
    });
    if (error || !data?.text) return null;
    return { text: data.text, source: data.source };
  } catch {
    return null;
  }
}
