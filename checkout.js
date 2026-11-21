(() => {
  const buttons=[...document.querySelectorAll("[data-conficel-plan]")];
  if(!buttons.length)return;
  const message=document.getElementById("payment-message");
  function show(text,kind=""){if(message){message.textContent=text;message.className="auth-message"+(kind?" "+kind:"");}}
  function loadRazorpay(){return new Promise((resolve,reject)=>{if(window.Razorpay)return resolve();const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=resolve;s.onerror=()=>reject(new Error("Could not load Razorpay Checkout. Check your connection and try again."));document.head.appendChild(s);});}
  async function start(plan,button){
    if(!window.conficelSupabase){show("Authentication is not ready. Refresh and sign in again.","error");return;}
    button.disabled=true;show("Preparing secure checkout…");
    try{
      const {data:{session}}=await window.conficelSupabase.auth.getSession();
      if(!session){show("Please sign in before choosing a paid plan.","error");document.getElementById("auth-open-button")?.click();return;}
      await loadRazorpay();
      const orderResponse=await fetch("/api/razorpay-create-order",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+session.access_token},body:JSON.stringify({plan})});
      const order=await orderResponse.json().catch(()=>null);
      if(!orderResponse.ok)throw new Error(order?.error||"Could not prepare payment.");
      const options={key:order.key_id,amount:order.amount,currency:order.currency,name:"ConfiCel",description:(plan==="standard"?"Standard":"Scale")+" plan · 30-day access",order_id:order.order_id,prefill:order.prefill,theme:{color:"#10b981"},modal:{ondismiss:()=>show("Checkout closed. No payment was confirmed.")},handler:async response=>{
        show("Payment received. Verifying securely…");
        try{
          const vr=await fetch("/api/razorpay-verify-payment",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+session.access_token},body:JSON.stringify(response)});
          const result=await vr.json().catch(()=>null);
          if(!vr.ok||!result?.success)throw new Error(result?.error||"Payment verification failed.");
          show("Payment verified. Your "+(result.plan||plan)+" plan is active with "+(result.tokens_balance??order.tokens)+" tokens. Access expires "+(result.subscription_expires_at?new Date(result.subscription_expires_at).toLocaleDateString():"in 30 days")+".","success");
        }catch(error){show(error.message+" Keep your Razorpay payment ID for support.","error");}
      }};
      const checkout=new window.Razorpay(options);
      checkout.on("payment.failed",r=>show(r.error?.description||"Payment failed. Please try again.","error"));
      checkout.open();
    }catch(error){show(error.message||"Could not start checkout.","error");}
    finally{button.disabled=false;}
  }
  buttons.forEach(button=>button.addEventListener("click",()=>start(button.dataset.conficelPlan,button)));
})();