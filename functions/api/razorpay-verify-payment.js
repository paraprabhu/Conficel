const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function hmac(secret,message){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)));}
function equal(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
export async function onRequestPost({request,env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY||!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET)return json({error:"Payment service is not configured."},503);
  const token=(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token)return json({error:"Please sign in again."},401);
  const base=env.SUPABASE_URL.replace(/\/$/,"");
  const ur=await fetch(base+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,authorization:"Bearer "+token}});
  if(!ur.ok)return json({error:"Your session has expired. Please sign in again."},401);
  const user=await ur.json();
  let body;try{body=await request.json()}catch{return json({error:"Invalid payment response."},400)}
  const orderId=String(body?.razorpay_order_id||""),paymentId=String(body?.razorpay_payment_id||""),signature=String(body?.razorpay_signature||"");
  if(!orderId||!paymentId||!signature)return json({error:"Payment verification details are incomplete."},400);
  const expected=await hmac(env.RAZORPAY_KEY_SECRET,orderId+"|"+paymentId);
  if(!equal(expected,signature))return json({error:"Payment signature verification failed."},400);
  const orderRows=await fetch(base+"/rest/v1/conficel_payments?select=id,user_id,plan,amount_paise,currency,status&razorpay_order_id=eq."+encodeURIComponent(orderId),{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY}});
  const rows=await orderRows.json().catch(()=>[]);
  const row=rows?.[0];
  if(!orderRows.ok||!row)return json({error:"Payment order was not found."},404);
  if(row.user_id!==user.id)return json({error:"This payment belongs to another account."},403);
  if(row.status==="paid")return json({success:true,already_activated:true,message:"This payment has already been applied."});
  const paymentResponse=await fetch("https://api.razorpay.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{authorization:"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET)}});
  const payment=await paymentResponse.json().catch(()=>null);
  if(!paymentResponse.ok||!payment)return json({error:"Could not verify payment status with Razorpay."},502);
  if(payment.order_id!==orderId||payment.amount!==row.amount_paise||payment.currency!==row.currency||payment.status!=="captured")
    return json({error:"Payment is not captured or its order amount/currency does not match. No tokens have been credited."},400);
  const activated=await fetch(base+"/rest/v1/rpc/activate_conficel_payment",{method:"POST",headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,"content-type":"application/json"},body:JSON.stringify({p_order_id:orderId,p_payment_id:paymentId})});
  const result=await activated.json().catch(()=>null);
  if(!activated.ok||!result?.activated)return json({error:"Payment is verified, but plan activation failed. Contact support with payment ID "+paymentId+"."},503);
  return json({success:true,...result});
}