const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' }
});

async function signPermit(payload, secret) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded)));
  const sig = btoa(String.fromCharCode(...signature)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
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
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) {
    return json({error:'Document processing is temporarily unavailable. Please try again later.'},503);
  }
  const auth = request.headers.get('authorization') || '';
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({error:'Please sign in to use the free allowance.'}, 401);

  let payload;
  try { payload = await request.json(); } catch { return json({error:'Invalid request.'},400); }
  const deviceId = typeof payload.device_id === 'string' ? payload.device_id : '';
  const documentType = typeof payload.document_type === 'string' ? payload.document_type : 'document';
  const pageCount = Number(payload.page_count);
  const fileSha256 = typeof payload.file_sha256 === 'string' ? payload.file_sha256 : '';
  const mode = typeof payload.mode === 'string' ? payload.mode : '';
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 20) return json({error:'Invalid page count. A document must contain between 1 and 20 pages.'},400);
  if (!/^[a-f0-9]{64}$/.test(fileSha256)) return json({error:'Document fingerprint is missing. Please select the file again.'},400);
  if (!['invoice','cheque','quotation','other'].includes(mode)) return json({error:'Please select a supported document type.'},400);

  const base = env.SUPABASE_URL.replace(/\/$/,'');
  const userResponse = await fetch(base + '/auth/v1/user', {
    headers: { apikey:env.SUPABASE_ANON_KEY, authorization:'Bearer '+token }
  });
  if (!userResponse.ok) return json({error:'Your session has expired. Please sign in again.'},401);
  const user = await userResponse.json();
  if (!user?.id || !user.email_confirmed_at) return json({error:'Verify your email before using the free allowance.'},403);

  // Admin account is verified server-side and is exempt from customer device, IP and trial-token limits.
  if ((user.email || '').trim().toLowerCase() === 'noreply@conficel.com') {
    const permit = await signPermit({jti:crypto.randomUUID(),userId:user.id,userEmail:'noreply@conficel.com',admin:true,fileSha256,mode,pageCount,exp:Date.now()+10*60*1000},env.TRIAL_HASH_SECRET);
    return json({allowed:true,admin:true,tokens_remaining:null,tokens_consumed:0,permit});
  }

  // Active paid subscriptions draw from their paid token balance, not the free-trial pool.
  const profileResponse = await fetch(base + '/rest/v1/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=plan,tokens_balance,subscription_expires_at', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const profiles = await profileResponse.json().catch(() => []);
  const profile = profiles?.[0];
  if (!profileResponse.ok) return json({error:'Could not verify your account plan. Please try again.'},503);
  if (profile && ['standard','scale'].includes(profile.plan) && profile.subscription_expires_at && Date.parse(profile.subscription_expires_at) > Date.now()) {
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const paidReservation = await fetch(base + '/rest/v1/rpc/reserve_conficel_paid_tokens', {
      method:'POST',
      headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},
      body:JSON.stringify({p_user_id:user.id,p_jti:jti,p_file_sha256:fileSha256,p_mode:mode,p_page_count:pageCount,p_expires_at:expiresAt})
    });
    const paidResult = await paidReservation.json().catch(()=>null);
    if (!paidReservation.ok) return json({error:'Could not reserve your paid tokens. Please try again.'},503);
    if (!paidResult?.allowed) return json({allowed:false,reason:paidResult?.reason,message:paidResult?.reason==='insufficient_tokens'?'Your paid token balance is insufficient. Renew or upgrade your plan to continue.':'Your paid subscription is not active.',tokens_remaining:paidResult?.tokens_remaining??0},403);
    const permit = await signPermit({jti,userId:user.id,fileSha256,mode,pageCount,exp:Date.now()+10*60*1000},env.TRIAL_HASH_SECRET);
    return json({...paidResult,paid:true,plan:profile.plan,permit});
  }
  // Free-trial accounts must pass Turnstile before any trial token or device allowance is consumed.
  const turnstileToken = typeof payload.turnstile_token === 'string' ? payload.turnstile_token : '';
  if (!turnstileToken) return json({requires_turnstile:true},428);
  if (!env.TURNSTILE_SECRET_KEY) return json({error:'Free-trial security check is not configured. Please try again later.'},503);
  const turnstileForm = new FormData();
  turnstileForm.append('secret', env.TURNSTILE_SECRET_KEY);
  turnstileForm.append('response', turnstileToken);
  if (request.headers.get('CF-Connecting-IP')) turnstileForm.append('remoteip', request.headers.get('CF-Connecting-IP'));
  let turnstileResult;
  try {
    const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method:'POST',body:turnstileForm});
    turnstileResult = await verifyResponse.json();
  } catch {
    return json({error:'Could not verify the security check. Please try again.'},503);
  }
  if (!turnstileResult?.success || (turnstileResult.hostname && !['conficel.com','www.conficel.com'].includes(turnstileResult.hostname))) {
    return json({error:'Security check expired or failed. Please complete it again.'},403);
  }

  if (!/^[a-f0-9-]{32,64}$/i.test(deviceId)) return json({error:'Device identifier is missing. Refresh and try again.'},400);

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
    await fetch(base + '/rest/v1/extraction_permits?jti=eq.'+jti,{method:'DELETE',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
    return json({allowed:false,reason:result?.reason,message,tokens_remaining:result?.tokens_remaining ?? 0},403);
  }
  const permit = await signPermit({jti,userId:user.id,fileSha256,mode,pageCount,exp:Date.now()+10*60*1000},env.TRIAL_HASH_SECRET);
  return json({...result,permit});
}
