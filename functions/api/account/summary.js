const json = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
});

export async function onRequestGet({request, env}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({error:'Account billing is temporarily unavailable.'},503);
  }
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({error:'Please sign in to view your account.'},401);
  const base = env.SUPABASE_URL.replace(/\/$/, '');
  const authResponse = await fetch(base + '/auth/v1/user', {
    headers:{apikey:env.SUPABASE_ANON_KEY,authorization:'Bearer '+token}
  });
  if (!authResponse.ok) return json({error:'Your session has expired. Please sign in again.'},401);
  const user = await authResponse.json();
  if (!user?.id || !user.email_confirmed_at) return json({error:'Please verify your email address.'},403);
  const headers = {apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY};
  const enc = encodeURIComponent(user.id);
  const [profileResponse,paymentsResponse,ledgerResponse,paidUsageResponse,freeTrialResponse] = await Promise.all([
    fetch(base+'/rest/v1/profiles?id=eq.'+enc+'&select=plan,tokens_balance,subscription_started_at,subscription_expires_at,last_payment_id',{headers}),
    fetch(base+'/rest/v1/conficel_payments?user_id=eq.'+enc+'&select=plan,amount_paise,amount_minor,currency,status,razorpay_order_id,razorpay_payment_id,created_at,paid_at&order=created_at.desc&limit=50',{headers}),
    fetch(base+'/rest/v1/conficel_token_ledger?user_id=eq.'+enc+'&select=entry_type,tokens_delta,balance_after,description,payment_id,created_at&order=created_at.desc&limit=100',{headers}),
    fetch(base+'/rest/v1/conficel_token_ledger?user_id=eq.'+enc+'&entry_type=eq.usage&select=tokens_delta&limit=1000',{headers}),
    fetch(base+'/rest/v1/free_trial_devices?user_id=eq.'+enc+'&select=tokens_used',{headers})
  ]);
  if (!profileResponse.ok || !paymentsResponse.ok || !ledgerResponse.ok || !paidUsageResponse.ok || !freeTrialResponse.ok) {
    return json({error:'Could not load account billing details. Please try again later.'},503);
  }
  const profiles = await profileResponse.json();
  const profile = profiles?.[0] || null;
  const payments = await paymentsResponse.json();
  const ledger = await ledgerResponse.json();
  const paidUsageRows = await paidUsageResponse.json();
  const freeTrialRows = await freeTrialResponse.json();
  const totalFreeUsed = freeTrialRows.reduce((sum,row)=>sum+Math.max(0,Number(row.tokens_used)||0),0);
  const freeTrialBalance = Math.max(0,20-totalFreeUsed);
  const paidPlanActive = !!profile && ['standard','scale','starter','professional','business'].includes(String(profile.plan||'').toLowerCase())
    && !!profile.subscription_expires_at && new Date(profile.subscription_expires_at).getTime()>Date.now();
  const paidBalance = Math.max(0, Number(profile?.tokens_balance || 0));
  const successfulPayments = payments.filter(x => {
    const status = String(x.status || '').toLowerCase();
    return ['paid','captured','success','succeeded','completed'].includes(status) || !!x.paid_at;
  });
  const paymentTotals = successfulPayments.reduce((totals, payment) => {
    const currency = String(payment.currency || 'INR').toUpperCase();
    const amountMinor = Number(payment.amount_minor ?? payment.amount_paise ?? 0);
    if (Number.isFinite(amountMinor) && amountMinor > 0) totals[currency] = (totals[currency] || 0) + amountMinor;
    return totals;
  }, {});
  const totalUsed = paidUsageRows.reduce((n,x)=>n+Math.abs(Math.min(0,Number(x.tokens_delta)||0)),0);
  return json({
    profile: {
      plan:paidPlanActive ? String(profile.plan).toLowerCase() : 'free',
      tokens_balance:paidBalance,
      paid_tokens_balance:paidBalance,
      free_trial_tokens_balance:freeTrialBalance,
      total_available_tokens:paidBalance+freeTrialBalance,
      paid_plan_active:paidPlanActive,
      subscription_started_at:paidPlanActive ? profile.subscription_started_at : null,
      subscription_expires_at:paidPlanActive ? profile.subscription_expires_at : null
    },
    totals:{successful_payment_count:successfulPayments.length,payment_totals:paymentTotals,used:totalUsed,free_trial_used:totalFreeUsed},
    payments,ledger
  });
}
