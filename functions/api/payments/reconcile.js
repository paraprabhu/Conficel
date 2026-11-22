const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

export async function onRequestPost({request, env}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({error:'Payment recovery is not configured.'},503);
  }

  const accessToken = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({error:'Please sign in again.'},401);

  const auth = await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/user', {
    headers:{apikey:env.SUPABASE_ANON_KEY,authorization:'Bearer '+accessToken}
  });
  if (!auth.ok) return json({error:'Your session has expired. Please sign in again.'},401);
  const user = await auth.json();
  if (!user?.id || !user.email_confirmed_at) return json({error:'A verified account is required.'},403);

  let payload;
  try { payload = await request.json(); } catch { return json({error:'Invalid recovery request.'},400); }
  const paymentId = typeof payload?.razorpay_payment_id === 'string' ? payload.razorpay_payment_id.trim() : '';
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return json({error:'Invalid Razorpay payment ID.'},400);

  const paymentResponse = await fetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId), {
    headers:{authorization:'Basic '+btoa(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET)}
  });
  const payment = await paymentResponse.json().catch(()=>null);
  if (!paymentResponse.ok || payment?.id !== paymentId || payment.status !== 'captured' ||
      !payment.order_id || !['INR','USD','EUR','AED'].includes(payment.currency) ||
      !Number.isInteger(payment.amount) || payment.amount < 1) {
    return json({error:'Razorpay has not confirmed this payment as captured. No activation was attempted.'},402);
  }

  const base = env.SUPABASE_URL.replace(/\/$/,'');
  const params = new URLSearchParams({
    select:'id,user_id,plan,currency,amount_minor,status,razorpay_payment_id',
    razorpay_order_id:'eq.'+payment.order_id,
    user_id:'eq.'+user.id,
    limit:'1'
  });
  const recordResponse = await fetch(base+'/rest/v1/conficel_payments?'+params.toString(), {
    headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}
  });
  const records = await recordResponse.json().catch(()=>null);
  const record = Array.isArray(records) ? records[0] : null;
  if (!record) return json({error:'No matching ConfiCel payment order was found for your account. Contact support; no activation was attempted.'},404);
  if (record.currency !== payment.currency || record.amount_minor !== payment.amount) {
    return json({error:'The captured payment does not match the saved ConfiCel order amount or currency. Contact support; no activation was attempted.'},409);
  }
  if (record.status === 'paid' && record.razorpay_payment_id !== paymentId) {
    return json({error:'This order is already associated with a different payment. Contact support.'},409);
  }
  if (!['created','paid'].includes(record.status)) {
    return json({error:'This ConfiCel order is not eligible for recovery. Contact support.'},409);
  }

  const activation = await fetch(base+'/rest/v1/rpc/activate_conficel_payment', {
    method:'POST',
    headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'content-type':'application/json'},
    body:JSON.stringify({
      p_order_id:payment.order_id,
      p_payment_id:paymentId,
      p_user_id:user.id,
      p_currency:payment.currency,
      p_amount_minor:payment.amount
    })
  });
  const result = await activation.json().catch(()=>null);
  if (!activation.ok || !result?.success) {
    console.error('[ConfiCel payment recovery]', {stage:'activation_rpc',status:activation.status});
    return json({error:'Razorpay confirms the payment, but ConfiCel could not activate it yet. Contact support with payment ID '+paymentId+'.'},503);
  }

  return json({
    success:true,
    recovered:true,
    plan:result.plan,
    tokens_balance:result.tokens_balance,
    subscription_expires_at:result.subscription_expires_at,
    already_activated:result.already_activated
  });
}
