const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return [...signature].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function onRequestPost({request, env}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({error:'Paid checkout is not configured. Please contact support.'},503);
  }
  const bearer = request.headers.get('authorization') || '';
  const accessToken = bearer.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({error:'Please sign in again.'},401);
  const userResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, '')+'/auth/v1/user', {
    headers:{apikey:env.SUPABASE_ANON_KEY,authorization:'Bearer '+accessToken}
  });
  if (!userResponse.ok) return json({error:'Your session has expired. Please sign in again.'},401);
  const user = await userResponse.json();
  if (!user?.id || !user.email_confirmed_at) return json({error:'Verify your email before activating a paid plan.'},403);

  let payload;
  try { payload = await request.json(); } catch { return json({error:'Invalid payment verification request.'},400); }
  const orderId = typeof payload?.razorpay_order_id === 'string' ? payload.razorpay_order_id : '';
  const paymentId = typeof payload?.razorpay_payment_id === 'string' ? payload.razorpay_payment_id : '';
  const signature = typeof payload?.razorpay_signature === 'string' ? payload.razorpay_signature : '';
  if (!orderId || !paymentId || !/^[a-f0-9]{64}$/i.test(signature)) {
    return json({error:'Razorpay payment details are incomplete.'},400);
  }

  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, orderId+'|'+paymentId);
  if (!safeEqual(expected.toLowerCase(), signature.toLowerCase())) {
    return json({error:'Payment signature verification failed. Your plan has not been activated.'},403);
  }

  // Confirm the payment is captured and belongs to this exact order and expected plan amount.
  const paymentResponse = await fetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(paymentId), {
    headers:{authorization:'Basic '+btoa(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET)}
  });
  const payment = await paymentResponse.json().catch(()=>null);
  if (!paymentResponse.ok || !payment?.id || payment.order_id !== orderId ||
      payment.status !== 'captured' || !['INR','USD','EUR','AED'].includes(payment.currency) ||
      !Number.isInteger(payment.amount) || payment.amount < 1) {
    return json({error:'Razorpay has not confirmed a captured payment. If money was deducted, contact support with your payment ID.'},402);
  }

  const activation = await fetch(env.SUPABASE_URL.replace(/\/$/, '')+'/rest/v1/rpc/activate_conficel_payment', {
    method:'POST',
    headers:{
      apikey:env.SUPABASE_SERVICE_ROLE_KEY,
      authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type':'application/json'
    },
    body:JSON.stringify({
      p_order_id:orderId,p_payment_id:paymentId,p_user_id:user.id,
      p_currency:payment.currency,p_amount_minor:payment.amount
    })
  });
  const result = await activation.json().catch(()=>null);
  if (!activation.ok || !result?.success) {
    return json({error:'Payment was verified, but plan activation needs support. Please contact support with payment ID '+paymentId+'.'},503);
  }
  return json({success:true,plan:result.plan,tokens_balance:result.tokens_balance,
    subscription_expires_at:result.subscription_expires_at,already_activated:result.already_activated});
}
