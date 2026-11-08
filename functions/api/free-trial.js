const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }
});

async function signPermit(payload, secret) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encoded = btoa(String.fromCharCode(...bytes)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded)));
  const sig = btoa(String.fromCharCode(...signature)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
  return encoded + '.' + sig;
}

async function digest(value, secret) {
  const bytes = new TextEncoder().encode(secret + ':' + value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function onRequestPost({request, env}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.TRIAL_HASH_SECRET) {
    return json({error:'Free-trial protection is not configured.'}, 503);
  }
  const auth = request.headers.get('authorization') || '';
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({error:'Please sign in to use the free allowance.'}, 401);

  let payload;
  try { payload = await request.json(); } catch { return json({error:'Invalid request.'},400); }
  const deviceId = typeof payload.device_id === 'string' ? payload.device_id : '';
  const documentType = typeof payload.document_type === 'string' ? payload.document_type : 'document';
  const pageCount = Number(payload.page_count);
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20) return json({error:'Invalid page count. A document must contain between 1 and 20 pages.'},400);
  if (!/^[a-f0-9]{64}$/.test(fileSha256)) return json({error:'Document fingerprint is missing. Please select the file again.'},400);
  if (!/^[a-f0-9-]{32,64}$/i.test(deviceId)) return json({error:'Device identifier is missing. Refresh and try again.'},400);

  const base = env.SUPABASE_URL.replace(/\/$/,'');
  const userResponse = await fetch(base + '/auth/v1/user', {
    headers: { apikey:env.SUPABASE_ANON_KEY, authorization:'Bearer '+token }
  });
  if (!userResponse.ok) return json({error:'Your session has expired. Please sign in again.'},401);
  const user = await userResponse.json();
  if (!user?.id || !user.email_confirmed_at) return json({error:'Verify your email before using the free allowance.'},403);

  // Cloudflare supplies CF-Connecting-IP at the edge. Only its hash is stored.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const [deviceHash, ipHash] = await Promise.all([
    digest(deviceId, env.TRIAL_HASH_SECRET),
    digest(ip, env.TRIAL_HASH_SECRET)
  ]);

  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const permitInsert = await fetch(base + '/rest/v1/extraction_permits', {
    method:'POST',
    headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify({jti,user_id:user.id,file_sha256:fileSha256,mode,page_count:pageCount,expires_at:expiresAt})
  });
  if (!permitInsert.ok) return json({error:'Extraction authorization is not configured. Apply migration 004_extraction_permits.sql, then retry.'},503);

  const rpcResponse = await fetch(base + '/rest/v1/rpc/consume_conficel_free_tokens', {
    method:'POST',
    headers:{
      apikey:env.SUPABASE_SERVICE_ROLE_KEY,
      authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type':'application/json'
    },
    body:JSON.stringify({
      p_user_id:user.id,
      p_device_hash:deviceHash,
      p_ip_hash:ipHash,
      p_document_type:documentType,
      p_page_count:pageCount
    })
  });
  const result = await rpcResponse.json().catch(()=>null);
  if (!rpcResponse.ok) {
    await fetch(base + '/rest/v1/extraction_permits?jti=eq.'+jti,{method:'DELETE',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
    return json({error:'Could not verify your free allowance. Please try again.'},503);
  }
  if (!result?.allowed) {
    const message = result?.reason === 'device_already_used'
      ? 'The free trial has already been activated on this device. Sign in with the original account or choose a paid plan.'
      : 'Your 20 free tokens have been used. Choose a paid plan to continue.';
    return json({allowed:false,reason:result?.reason,message,tokens_remaining:0},403);
  }
  return json(result);
}
