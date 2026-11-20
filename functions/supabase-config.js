export async function onRequestGet({ env }) {
  const supabaseUrl = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    return new Response(
      'throw new Error("ConfiCel Preview Supabase is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to Cloudflare Pages Preview environment variables.");',
      {
        status: 503,
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  const normalizedUrl = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
  const safeUrl = JSON.stringify(normalizedUrl);
  const safeKey = JSON.stringify(publishableKey);

  return new Response(
    `window.CONFICEL_SUPABASE_URL = ${safeUrl};
window.CONFICEL_SUPABASE_PUBLISHABLE_KEY = ${safeKey};
`,
    {
      status: 200,
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}
