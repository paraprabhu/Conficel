const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

async function getUser(request, env) {
  const bearer = request.headers.get('authorization') || '';
  const accessToken = bearer.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return null;
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user', {
    headers: {apikey:env.SUPABASE_ANON_KEY, authorization:'Bearer '+accessToken}
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id && user.email_confirmed_at ? user : null;
}

export async function onRequestPost({request, env}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({error:'Paid checkout is not configured. Please contact support.'},503);
  }
  const user = await getUser(request, env);
  if (!user) return json({error:'Please sign in with a verified account before choosing a paid plan.'},401);

  let payload;
  try { payload = await request.json(); } catch { return json({error:'Invalid checkout request.'},400); }
  const plan = payload?.plan;
  const plans = {
    standard: {amount:10000, tokens:50, label:'ConfiCel Standard'},
    scale: {amount:50000, tokens:500, label:'ConfiCel Scale'}
  };
  const selected = plans[plan];
  if (!selected) return json({error:'Please select a valid plan.'},400);

  const receipt = 'cc_' + crypto.randomUUID().replace(/-/g,'').slice(0,24);
  const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method:'POST',
    headers:{
      authorization:'Basic '+btoa(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET),
      'content-type':'application/json'
    },
    body:JSON.stringify({
      amount:selected.amount, currency:'INR', receipt,
      notes:{user_id:user.id, plan, product:'ConfiCel'}
    })
  });
  const order = await razorpayResponse.json().catch(()=>null);
  if (!razorpayResponse.ok || !order?.id) {
    return json({error:'Razorpay could not create the payment order. Please try again.'},502);
  }

  const saved = await fetch(env.SUPABASE_URL.replace(/\/$/, '')+'/rest/v1/conficel_payments', {
    method:'POST',
    headers:{
      apikey:env.SUPABASE_SERVICE_ROLE_KEY,
      authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type':'application/json',
      Prefer:'return=minimal'
    },
    body:JSON.stringify({
      user_id:user.id, plan, amount_paise:selected.amount, currency:'INR',
      status:'created', razorpay_order_id:order.id
    })
  });
  if (!saved.ok) {
    return json({error:'The payment order could not be saved securely. Please contact support before retrying.'},503);
  }
  return json({
    key_id:env.RAZORPAY_KEY_ID, order_id:order.id, amount:selected.amount,
    currency:'INR', name:'ConfiCel', description:selected.label+' — 30-day access',
    plan, tokens:selected.tokens, customer:{name:user.user_metadata?.full_name || '', email:user.email || ''}
  });
}
