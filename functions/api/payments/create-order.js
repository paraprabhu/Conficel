const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

function logFailure(stage, details={}) {
  // Never log credentials, access tokens, payment payloads, or customer details.
  console.error('[ConfiCel checkout]', {stage, ...details});
}

async function getUser(request, env) {
  const bearer = request.headers.get('authorization') || '';
  const accessToken = bearer.match(/^Bearer\\s+(.+)$/i)?.[1];
  if (!accessToken) return null;

  let response;
  try {
    response = await fetch(env.SUPABASE_URL.replace(/\\/$/, '') + '/auth/v1/user', {
      headers: {apikey:env.SUPABASE_ANON_KEY, authorization:'Bearer '+accessToken}
    });
  } catch {
    const error = new Error('SUPABASE_AUTH_UNREACHABLE');
    error.stage = 'supabase_auth';
    throw error;
  }
  if (!response.ok) {
    const error = new Error('SUPABASE_AUTH_REJECTED');
    error.stage = 'supabase_auth';
    error.status = response.status;
    throw error;
  }
  const user = await response.json();
  return user?.id && user.email_confirmed_at ? user : null;
}

export async function onRequestPost({request, env}) {
  let stage = 'configuration';
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY ||
        !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      return json({error:'Paid checkout is not configured. Please contact support.', stage},503);
    }

    stage = 'supabase_auth';
    const user = await getUser(request, env);
    if (!user) return json({error:'Please sign in with a verified account before choosing a paid plan.', stage},401);

    let payload;
    try { payload = await request.json(); } catch {
      return json({error:'Invalid checkout request.', stage:'request'},400);
    }
    const plan = payload?.plan;
    const plans = {
      standard: {amount:10000, tokens:50, label:'ConfiCel Standard'},
      scale: {amount:50000, tokens:500, label:'ConfiCel Scale'}
    };
    const selected = plans[plan];
    if (!selected) return json({error:'Please select a valid plan.', stage:'request'},400);

    stage = 'razorpay_order';
    const receipt = 'cc_' + crypto.randomUUID().replace(/-/g,'').slice(0,24);
    let razorpayResponse;
    try {
      razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
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
    } catch {
      logFailure(stage, {reason:'upstream_fetch_failed'});
      return json({error:'Could not connect to Razorpay. Please try again.', stage},502);
    }

    const order = await razorpayResponse.json().catch(()=>null);
    if (!razorpayResponse.ok || !order?.id) {
      const razorpayCode = order?.error?.code || 'RAZORPAY_ORDER_REJECTED';
      logFailure(stage, {status:razorpayResponse.status, code:razorpayCode});
      return json({error:'Razorpay rejected the order request. Please check the payment configuration.', stage, code:razorpayCode},502);
    }

    stage = 'supabase_payment_insert';
    let saved;
    try {
      saved = await fetch(env.SUPABASE_URL.replace(/\\/$/, '')+'/rest/v1/conficel_payments', {
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
    } catch {
      logFailure(stage, {reason:'upstream_fetch_failed'});
      return json({error:'Razorpay order was created, but ConfiCel could not save it. Please contact support before retrying.', stage},503);
    }
    if (!saved.ok) {
      logFailure(stage, {status:saved.status});
      return json({error:'Razorpay order was created, but ConfiCel could not save it. Please contact support before retrying.', stage, code:'SUPABASE_INSERT_FAILED'},503);
    }

    return json({
      key_id:env.RAZORPAY_KEY_ID, order_id:order.id, amount:selected.amount,
      currency:'INR', name:'ConfiCel', description:selected.label+' — 30-day access',
      plan, tokens:selected.tokens, customer:{name:user.user_metadata?.full_name || '', email:user.email || ''}
    });
  } catch (error) {
    const failedStage = error?.stage || stage;
    logFailure(failedStage, {
      reason: error?.message === 'SUPABASE_AUTH_UNREACHABLE' || error?.message === 'SUPABASE_AUTH_REJECTED'
        ? error.message : 'unexpected_runtime_error',
      status: Number.isInteger(error?.status) ? error.status : undefined
    });
    return json({
      error:'Checkout could not be prepared. Please try again or contact support.',
      stage:failedStage,
      code:'CHECKOUT_RUNTIME_ERROR'
    },500);
  }
}
