(function(root){
"use strict";
const DEFINITIONS = {
 "Tax Invoice": {
  title:"Tax Invoice / Invoice",
  items:[
   ["invoice_number","Invoice number",["invoiceNumber"],"required"],
   ["invoice_date","Invoice date",["invoiceDate"],"required"],
   ["supplier_name","Supplier / seller name",["supplier"],"required"],
   ["supplier_address","Supplier address",["supplierAddress"],"recommended"],
   ["supplier_tax_id","Supplier GSTIN / VAT / tax ID",["supplierGSTIN"],"conditional"],
   ["buyer_name","Buyer / customer name",["buyerCustomer"],"required"],
   ["buyer_address","Buyer address",["buyerAddress"],"recommended"],
   ["buyer_tax_id","Buyer GSTIN / VAT / tax ID",["buyerGSTIN"],"conditional"],
   ["ship_to","Ship-to / consignee",["consigneeShipTo"],"conditional"],
   ["purchase_order_ref","Linked PO number",["purchaseOrderNumber"],"conditional"],
   ["currency","Currency",["currency"],"required"],
   ["line_items","Line items",["lineItems"],"required"],
   ["quantity","Quantity for each line",["lineItems[].quantity"],"recommended"],
   ["unit_price","Unit price for each line",["lineItems[].unitRate"],"recommended"],
   ["line_amount","Line amount / net or gross",["lineItems[].amount","lineItems[].netAmount","lineItems[].grossAmount"],"required"],
   ["subtotal","Subtotal / net total",["subtotal"],"recommended"],
   ["tax","Tax type and amount",["taxLabel","taxDescription","totalTax","taxDue"],"conditional"],
   ["tax_breakdown","Tax breakdown by rate",["taxBreakdown"],"conditional"],
   ["other_charges","Freight / packing / other charges",["otherCharges","freightCharges","chargeBreakdown"],"recommended"],
   ["invoice_total","Invoice total / amount due",["invoiceTotal"],"required"],
   ["due_date","Due date",["dueDate"],"recommended"],
   ["payment_terms","Payment terms",["paymentTerms"],"recommended"],
   ["bank_payment","Bank / payment instructions",["documentFields@bank"],"conditional"],
   ["references","Other linked document references",["documentIdentifiers@linked"],"recommended"],
   ["signature","Authorized signatory / stamp",["documentFields@signature"],"recommended"],
   ["full_text","All pages and source text",["rawText","sections"],"required"]
  ],
  checks:["Supplier and buyer must remain distinct; never infer one from the other.","Invoice number/date must come from their own printed labels, not a PO or due date.","Line items, tax breakdown and amount summary must be checked against source pages.","For multi-rate tax, retain each rate and taxable base separately.","Do not treat template prompts or blank footer cells as supplier details."]
 },
 "Purchase Order": {
  title:"Purchase Order (PO)",
  items:[
   ["po_number","PO number",["purchaseOrderNumber"],"required"],
   ["po_date","PO / order date",["orderDate"],"required"],
   ["buyer_name","Buyer / ordering company",["buyerCustomer"],"required"],
   ["buyer_address","Buyer address",["buyerAddress"],"recommended"],
   ["buyer_tax_id","Buyer tax ID",["buyerGSTIN"],"conditional"],
   ["supplier_name","Supplier / vendor name",["supplier"],"required"],
   ["supplier_address","Supplier address",["supplierAddress"],"recommended"],
   ["supplier_tax_id","Supplier tax ID",["supplierGSTIN"],"conditional"],
   ["delivery_site","Ship-to / delivery site",["consigneeShipTo"],"recommended"],
   ["pr_reference","Linked purchase requisition",["purchaseRequisitionNumber","documentIdentifiers@pr_reference"],"recommended"],
   ["rfq_reference","Linked RFQ",["rfqNumber","documentIdentifiers@rfq_reference"],"recommended"],
   ["quotation_reference","Supplier quotation reference",["quotationNumber","documentIdentifiers@quotation_reference"],"recommended"],
   ["required_by","Required-by / delivery date",["requiredByDate"],"recommended"],
   ["items","Machinery / goods / service line items",["lineItems"],"required"],
   ["specification","Product / service specifications (where applicable)",["lineItems[].description"],"recommended"],
   ["quantity","Ordered quantity and unit",["lineItems[].quantity","lineItems[].unit"],"required"],
   ["unit_price","Unit price",["lineItems[].unitRate"],"recommended"],
   ["line_total","Line amount",["lineItems[].amount","lineItems[].netAmount","lineItems[].grossAmount"],"recommended"],
   ["currency","Currency",["currency"],"recommended"],
   ["tax","Tax type/rate/amount",["taxLabel","taxDescription","taxBreakdown","totalTax","taxDue"],"conditional"],
   ["charges","Freight / installation / other charges",["otherCharges","freightCharges","chargeBreakdown@extra_charges"],"conditional"],
   ["po_total","PO total / order value",["orderTotal","documentTotal","amountSummaryRows@total","documentFields@order_total"],"recommended"],
   ["payment_terms","Payment terms / milestones",["paymentTerms","documentFields@payment_terms"],"recommended"],
   ["delivery_terms","Delivery terms / schedule",["deliveryTerms","requiredByDate"],"recommended"],
   ["warranty","Warranty / service / spares conditions",["documentFields@warranty"],"conditional"],
   ["approvals","Approvals / authorized signatures",["documentFields@approval","documentFields@signature"],"recommended"],
   ["amount_rows","Amount summary rows (Net Total, tax, Order Total)",["amountSummaryRows"],"required"],
   ["full_text","All pages, terms and conditions",["rawText","sections"],"required"]
  ],
  checks:["PO number and order date must not be populated from invoice fields.","Capture supplier and buyer as separate parties.","Preserve machinery make/model/specifications and line-wise quantity; do not compress different items.","Capture linked PR/RFQ/quotation references separately from the PO number.","Read all commercial, delivery, warranty and terms pages, not only the item table."]
 },
 "Proforma Invoice": {
  title:"Proforma Invoice",
  items:[
   ["pi_number","Proforma invoice number",["proformaInvoiceNumber"],"required"],
   ["pi_date","Proforma invoice date",["proformaInvoiceDate"],"required"],
   ["supplier_name","Supplier / seller name",["supplier"],"required"],
   ["supplier_address","Supplier address",["supplierAddress"],"recommended"],
   ["supplier_tax_id","Supplier tax ID",["supplierGSTIN"],"conditional"],
   ["buyer_name","Buyer / customer name",["buyerCustomer"],"required"],
   ["buyer_address","Buyer address",["buyerAddress"],"recommended"],
   ["buyer_tax_id","Buyer tax ID",["buyerGSTIN"],"conditional"],
   ["ship_to","Ship-to / consignee",["consigneeShipTo"],"conditional"],
   ["linked_po","Linked PO reference",["purchaseOrderNumber"],"conditional"],
   ["currency","Currency",["currency"],"required"],
   ["items","Machinery / goods / service line items",["lineItems"],"required"],
   ["specification","Product description / specifications (where applicable)",["lineItems[].description"],"recommended"],
   ["quantity","Quantity and unit",["lineItems[].quantity","lineItems[].unit"],"required"],
   ["unit_price","Unit price",["lineItems[].unitRate"],"recommended"],
   ["line_total","Line amounts",["lineItems[].amount","lineItems[].netAmount","lineItems[].grossAmount"],"recommended"],
   ["subtotal","Subtotal",["subtotal"],"recommended"],
   ["tax","Tax type/rate/amount",["taxLabel","taxDescription","taxBreakdown","totalTax","taxDue"],"conditional"],
   ["charges","Freight / insurance / packing / other charges",["chargeBreakdown@extra_charges","otherCharges","freightCharges"],"conditional"],
   ["total","Proforma total / estimated amount",["invoiceTotal","documentTotal","amountSummaryRows@total","documentFields@proforma_total"],"required"],
   ["validity","Quotation / proforma validity",["validUntil","documentFields@validity","sections@validity"],"recommended"],
   ["delivery_terms","Delivery schedule / Incoterms",["deliveryTerms","documentFields@delivery_terms","sections@delivery_terms"],"recommended"],
   ["payment_terms","Advance / payment terms",["paymentTerms","documentFields@payment_terms","sections@payment_terms"],"recommended"],
   ["bank_payment","Bank details / payment instructions",["documentFields@bank","sections@bank"],"conditional"],
   ["warranty","Warranty / scope / exclusions",["documentFields@warranty","sections@warranty"],"conditional"],
   ["full_text","All pages and source text",["rawText","sections"],"required"]
  ],
  checks:["Use proformaInvoiceNumber and proformaInvoiceDate; do not substitute invoiceNumber, invoiceDate or dueDate.","A proforma invoice is not a tax invoice or proof of payment.","Capture validity, advance/payment terms and delivery terms when printed.","Keep linked PO and other references separate from the proforma number.","Capture all line items, taxes, charges, currency and total without inventing values."]
 }
};
function present(v){if(v===undefined||v===null)return false;if(Array.isArray(v))return v.length>0;if(typeof v==="object")return Object.values(v).some(present);return String(v).trim()!=="";}
function getPath(d,path){
 if(path==="documentFields@order_total"||path==="documentFields@payment_terms"||path==="documentFields@warranty"||path==="documentFields@approval"){
  const rows=Array.isArray(d.documentFields)?d.documentFields:[];
  const patterns={order_total:/(order total|po total|grand total|total value|total amount)/i,payment_terms:/(payment terms|payment milestones|advance|retention)/i,warranty:/(warranty|guarantee|service warranty|service support|spares)/i,approval:/(approved by|authorized by|authorised by|approval|signature|signed by|stamp|seal)/i};
  const key=path.split("@")[1];return rows.filter(x=>x&&patterns[key].test(String(x.label||""))&&present(x.value));
 }
 if(path==="documentFields@proforma_total"){
  const rows=Array.isArray(d.documentFields)?d.documentFields:[];
  return rows.filter(x=>x&&/(proforma total|total amount|estimated amount|grand total)/i.test(String(x.label||""))&&present(x.value));
 }
 if(path==="documentFields@validity"||path==="documentFields@delivery_terms"||path==="documentFields@payment_terms"||path==="documentFields@warranty"){
  const rows=Array.isArray(d.documentFields)?d.documentFields:[];
  const patterns={validity:/(valid until|validity|valid through|offer valid)/i,delivery_terms:/(delivery terms|delivery schedule|incoterms|deliver|dispatch terms)/i,payment_terms:/(payment terms|payment milestones|advance|pdc|retention)/i,warranty:/(warranty|guarantee|service warranty|service support|spares|exclusions)/i};
  const key=path.split("@")[1];
  return rows.filter(x=>x&&patterns[key].test(String(x.label||""))&&present(x.value));
 }
 if(path==="sections@bank"||path==="sections@validity"||path==="sections@delivery_terms"||path==="sections@payment_terms"||path==="sections@warranty"){
  const rows=Array.isArray(d.sections)?d.sections:[];
  const patterns={bank:/(bank details|payment instructions|remittance|account details)/i,validity:/(validity|valid until|offer valid|valid through)/i,delivery_terms:/(delivery|deliver|dispatch|incoterm|ex factory|ex works)/i,payment_terms:/(payment|advance|pdc|credit terms|retention)/i,warranty:/(warranty|guarantee|service warranty|service support|spares|exclusions)/i};
  const key=path.split("@")[1];
  return rows.filter(x=>x&&patterns[key].test(String(x.heading||"")+" "+String(x.content||""))&&present(x.content));
 }
 if(path==="documentIdentifiers@pr_reference"||path==="documentIdentifiers@rfq_reference"||path==="documentIdentifiers@quotation_reference"){
  const rows=Array.isArray(d.documentIdentifiers)?d.documentIdentifiers:[];
  const key=path.split("@")[1];
  const patterns={pr_reference:/(purchase requisition|\bpr\b)/i,rfq_reference:/(request for quotation|\brfq\b)/i,quotation_reference:/(supplier quotation|vendor quotation|quotation reference|quote reference)/i};
  return rows.filter(x=>x&&patterns[key].test(String((x.type||"")+" "+(x.label||"")))&&present(x.value));
 }
 if(path==="chargeBreakdown@extra_charges"){
  const rows=Array.isArray(d.chargeBreakdown)?d.chargeBreakdown:[];
  return rows.filter(x=>x&&/(freight|shipping|delivery charge|installation|packing|handling|insurance|surcharge|other charge)/i.test(String(x.label||""))&&present(x.amount));
 }
 if(path==="amountSummaryRows@total"){const rows=Array.isArray(d.amountSummaryRows)?d.amountSummaryRows:[];return rows.filter(x=>x&&/(order total|po total|grand total|total amount)/i.test(String(x.label||""))&&present(x.amount));}
 if(path==="documentIdentifiers@linked"){
  const rows=Array.isArray(d.documentIdentifiers)?d.documentIdentifiers:[];
  const re=/(purchase order|\bpo\b|proforma invoice|quotation|quote|sales order|\bso\b|delivery challan|\bdc\b|work order|\bwo\b|rfq|requisition|contract|agreement|job number)/i;
  return rows.filter(x=>x&&re.test(String((x.type||"")+" "+(x.label||"")))&&present(x.value));
 }
 if(path==="documentFields@bank"||path==="documentFields@signature"){
  const rows=Array.isArray(d.documentFields)?d.documentFields:[];
  const re=path.endsWith("@bank")?/(bank|account|iban|swift|bic|sort code|payment instruction|remittance|beneficiary|routing)/i:/(signature|signed by|authorized signatory|authorised signatory|stamp|seal)/i;
  return rows.filter(x=>x&&re.test(String(x.label||""))&&present(x.value));
 }
 if(path.endsWith("[]")){const v=d[path.slice(0,-2)];return Array.isArray(v)?v:[];}if(path.includes("[].")){const [arr,field]=path.split("[].");const rows=Array.isArray(d[arr])?d[arr]:[];return rows.filter(x=>present(x&&x[field]));}return d[path];}
function classifyKey(type){const t=String(type||"").toLowerCase();if(t.includes("proforma"))return "Proforma Invoice";if(t.includes("purchase order"))return "Purchase Order";if(t==="invoice"||t.includes("tax invoice")||t.includes("commercial invoice"))return "Tax Invoice";return "";}
function buildChecklist(data){
 const d=data&&data.extracted?data.extracted:(data||{}),type=classifyKey(d.documentType||d.documentSubtype),def=DEFINITIONS[type];
 if(!def)return {type:type||String(d.documentType||"Other"),title:"No checklist configured",items:[],checks:[],summary:{found:0,missing:0,review:0,notApplicable:0},configured:false};
 const items=def.items.map(([id,label,paths,priority])=>{
  const values=paths.map(p=>getPath(d,p)),found=values.some(present);
  let status=found?"FOUND":priority==="conditional"?"NOT APPLICABLE":priority==="recommended"?"REVIEW":"MISSING";
  let detail=found?"Captured in: "+paths.filter((p,i)=>present(values[i])).join(", "):priority==="conditional"?"No evidence found; applicable only if printed or relevant to this transaction.":priority==="recommended"?"Not found. Review source document; may not apply.":"Expected for this document type but not captured. Check the original.";
  if(id==="quantity"){
   const rows=Array.isArray(d.lineItems)?d.lineItems:[];
   const qty=rows.length>0&&rows.every(x=>present(x&&x.quantity));
   const units=rows.length>0&&rows.every(x=>present(x&&x.unit));
   status=qty&&units?"FOUND":qty||units?"REVIEW":rows.length?"MISSING":status;
   detail=rows.length?(qty?"Quantity captured for all "+rows.length+" line(s). ":"Quantity missing for one or more lines. ")+(units?"Unit captured for all lines.":"Unit missing for one or more lines; verify whether the source prints units."):"No line items available to assess quantity and unit.";
  }
  if(id==="specification"){
   const rows=Array.isArray(d.lineItems)?d.lineItems:[];
   const specRe=/\b(model|part\s*(?:no|number)|type\s*[:#]|make\s*[:#]|grade|size|dimension|capacity|voltage|power|pressure|material|gsm|micron|mm|cm|inch|\d+\s*(?:kw|hp|v|bar|lpm|rpm))\b/i;
   const detailed=rows.filter(x=>specRe.test(String(x&&x.description||"")));
   status=rows.length&&detailed.length===rows.length?"FOUND":detailed.length?"REVIEW":rows.length?"REVIEW":status;
   detail=rows.length?detailed.length+" of "+rows.length+" line description(s) contain identifiable specification markers; inspect make/model/part number where relevant.":"No line items available to assess specifications.";
  }
  if(id==="line_items"||id==="items"){const rows=Array.isArray(d.lineItems)?d.lineItems:[];detail=rows.length?rows.length+" line item(s) captured; verify every source row and description.":"No line items captured; inspect the document.";}
  if(id==="full_text")detail=present(d.rawText)||present(d.sections)?"Source text/sections available; visually compare every page.":"No full-document text or sections captured.";
  return {id,label,priority,status,detail,fields:paths};
 });
 const summary={found:items.filter(x=>x.status==="FOUND").length,missing:items.filter(x=>x.status==="MISSING").length,review:items.filter(x=>x.status==="REVIEW").length,notApplicable:items.filter(x=>x.status==="NOT APPLICABLE").length};
 return {type,title:def.title,items,checks:def.checks.slice(),summary,configured:true};
}
root.ConfiCelDocumentChecklists={definitions:DEFINITIONS,buildChecklist};
})(typeof window!=="undefined"?window:globalThis);
