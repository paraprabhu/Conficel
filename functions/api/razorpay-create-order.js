const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const PLANS={standard:{amount:10000,tokens:50},scale:{amount:50000,tokens:500}};
async function getUser(request,env){
  const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token) return null;
  const r=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:"Bearer "+token}});
  if(!r.ok) return null;
  const u=await r.json(); return u?.id&&u.email_confirmed_at?u:null;
}
export async function onRequestPost({request,env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET)
    return json({error:"Payment service is not configured in this Preview environment."},503);
  const user=await getUser(request,env);
  if(!user) return json({error:"Please sign in and verify your email before purchasing."},401);
  let body; try{body=await request.json()}catch{return json({error:"Invalid request."},400)}
  const plan=String(body?.plan||"");
  const config=PLANS[plan]; if(!config) return json({error:"Choose a valid plan."},400);
  const base=env.SUPABASE_URL.replace(/\/$/,"");
  const auth="Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET);
  let orderResponse;
  try{
    orderResponse=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{authorization:auth,"content-type":"application/json"},body:JSON.stringify({amount:config.amount,currency:"INR",receipt:"cc_"+crypto.randomUUID().replace(/-/g,"").slice(0,24),notes:{conficel_user_id:user.id,conficel_plan:plan}})});
  }catch{return json({error:"Could not connect to the payment provider. Please try again."},502)}
  const order=await orderResponse.json().catch(()=>null);
  if(!orderResponse.ok||!order?.id) return json({error:order?.error?.description||"Could not create payment order."},502);
  const saved=await fetch(base+"/rest/v1/conficel_payments",{method:"POST",headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"content-type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({user_id:user.id,plan,amount_paise:config.amount,currency:"INR",razorpay_order_id:order.id,status:"created"})});
  if(!saved.ok) return json({error:"The payment order was created but could not be registered. Please contact support before paying.",order_created:true},503);
  return json({key_id:env.RAZORPAY_KEY_ID,order_id:order.id,amount:config.amount,currency:"INR",plan,tokens:config.tokens,prefill:{name:user.user_metadata?.full_name||"",email:user.email||""}});
}