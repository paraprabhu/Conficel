(function(root){
"use strict";
const TYPES = [
 {type:"E-Way Bill",aliases:["eway bill","e-way bill","e way bill","ewb"],field:"ewayBillNumber",label:"E-Way Bill number",dates:["ewayBillDate","ewayBillValidUntil"],required:["ewayBillNumber"]},
 {type:"Purchase Order",aliases:["purchase order","purchase order form","po"],field:"purchaseOrderNumber",label:"PO number",dates:["orderDate","requiredByDate"],required:["purchaseOrderNumber"]},
 {type:"Proforma Invoice",aliases:["proforma invoice","pro forma invoice","pi"],field:"proformaInvoiceNumber",label:"Proforma invoice number",dates:["proformaInvoiceDate"],required:["proformaInvoiceNumber"]},
 {type:"Credit Note",aliases:["credit note","credit memo"],field:"creditNoteNumber",label:"Credit note number",dates:["creditNoteDate"],required:["creditNoteNumber"]},
 {type:"Debit Note",aliases:["debit note","debit memo"],field:"debitNoteNumber",label:"Debit note number",dates:["debitNoteDate"],required:["debitNoteNumber"]},
 {type:"Delivery Challan",aliases:["delivery challan","delivery note"],field:"deliveryChallanNumber",label:"Delivery challan number",dates:["deliveryChallanDate"],required:["deliveryChallanNumber"]},
 {type:"Sales Order",aliases:["sales order","customer order"],field:"salesOrderNumber",label:"Sales order number",dates:["salesOrderDate","requiredByDate"],required:["salesOrderNumber"]},
 {type:"Request for Quotation",aliases:["request for quotation","rfq"],field:"rfqNumber",label:"RFQ number",dates:["rfqDate"],required:["rfqNumber"]},
 {type:"Purchase Requisition",aliases:["purchase requisition","purchase request"],field:"purchaseRequisitionNumber",label:"Purchase requisition number",dates:["purchaseRequisitionDate"],required:["purchaseRequisitionNumber"]},
 {type:"Work Order",aliases:["work order"],field:"workOrderNumber",label:"Work order number",dates:["workOrderDate"],required:["workOrderNumber"]},
 {type:"Material Issue Note",aliases:["material issue note","material issue"],field:"materialIssueNumber",label:"Material issue number",dates:["materialIssueDate"],required:["materialIssueNumber"]},
 {type:"Gate Pass",aliases:["gate pass"],field:"gatePassNumber",label:"Gate pass number",dates:["gatePassDate"],required:["gatePassNumber"]},
 {type:"Service Entry Sheet",aliases:["service entry sheet"],field:"serviceEntryNumber",label:"Service entry number",dates:["serviceEntryDate"],required:["serviceEntryNumber"]},
 {type:"Statement of Account",aliases:["statement of account","account statement"],field:"statementNumber",label:"Statement number",dates:["statementDate"],required:["statementNumber"]},
 {type:"Payment Advice",aliases:["payment advice","remittance advice"],field:"paymentAdviceNumber",label:"Payment advice number",dates:["paymentAdviceDate"],required:["paymentAdviceNumber"]},
 {type:"Delivery Receipt",aliases:["delivery receipt","proof of delivery","pod"],field:"deliveryReceiptNumber",label:"Delivery receipt number",dates:["deliveryReceiptDate"],required:["deliveryReceiptNumber"]},
 {type:"Quotation",aliases:["quotation","quote","estimate"],field:"quotationNumber",label:"Quotation number",dates:["quotationDate","validUntil"],required:["quotationNumber"]},
 {type:"Goods Receipt Note",aliases:["goods receipt note","goods received note","grn"],field:"goodsReceiptNumber",label:"Goods receipt number",dates:["goodsReceiptDate"],required:["goodsReceiptNumber"]},
 {type:"Packing List",aliases:["packing list","packing slip"],field:"packingListNumber",label:"Packing list number",dates:["packingListDate"],required:["packingListNumber"]},
 {type:"Bill of Lading",aliases:["bill of lading","b/l","bol"],field:"billOfLadingNumber",label:"Bill of Lading number",dates:["billOfLadingDate"],required:["billOfLadingNumber"]},
 {type:"Air Waybill",aliases:["air waybill","airway bill","awb"],field:"airWaybillNumber",label:"Air Waybill number",dates:["airWaybillDate"],required:["airWaybillNumber"]},
 {type:"Consignment Note",aliases:["consignment note","lorry receipt","lr number"],field:"consignmentNoteNumber",label:"Consignment note number",dates:["consignmentDate"],required:["consignmentNoteNumber"]},
 {type:"Dispatch Note",aliases:["dispatch note","dispatch advice"],field:"dispatchNoteNumber",label:"Dispatch note number",dates:["dispatchDate"],required:["dispatchNoteNumber"]},
 {type:"Receipt",aliases:["receipt","payment receipt"],field:"receiptNumber",label:"Receipt number",dates:["receiptDate"],required:["receiptNumber"]},
 {type:"Tax Invoice",aliases:["tax invoice","gst invoice","vat invoice"],field:"invoiceNumber",label:"Invoice number",dates:["invoiceDate","dueDate"],required:["invoiceNumber","invoiceDate"]},
 {type:"Invoice",aliases:["invoice","commercial invoice"],field:"invoiceNumber",label:"Invoice number",dates:["invoiceDate","dueDate"],required:["invoiceNumber","invoiceDate"]}
];
function firstValue(values){for(const value of values){if(value!==undefined&&value!==null&&String(value).trim()!=="")return String(value).trim();}return "";}
function identifierFallback(d,match){
 const identifiers=Array.isArray(d.documentIdentifiers)?d.documentIdentifiers:[];
 const aliases=[match.type.toLowerCase(),match.label.toLowerCase()];
 const found=identifiers.find(item=>{
  const type=String(item&&item.type||"").toLowerCase();
  const label=String(item&&item.label||"").toLowerCase();
  return aliases.some(alias=>type===alias||type.includes(alias)||label.includes(alias));
 });
 return found?String(found.value||"").trim():"";
}
function classifyDocument(data){
 const d=data&&data.extracted?data.extracted:(data||{});
 const explicit=String(d.documentType||"").trim().toLowerCase();
 let match=TYPES.find(item=>item.type.toLowerCase()===explicit);
 if(!match)match=TYPES.find(item=>item.aliases.some(alias=>explicit===alias));
 if(!match){
  const titleLines=String(d.rawText||"").split(/\r?\n/).slice(0,8).map(line=>line.trim()).filter(line=>line&&line.length<=70&&!/\b(?:no\.?|number|#|ref|reference|date)\b/i.test(line));
  const raw=[d.documentSubtype,...titleLines].filter(Boolean).join("\n").toLowerCase();
  for(const item of TYPES){
   const aliases=item.aliases.slice().sort((a,b)=>b.length-a.length);
   const found=aliases.some(alias=>alias.length>3&&raw.includes(alias));
   if(found){match=item;break;}
  }
 }
 if(!match){
  if(d.ewayBillNumber)match=TYPES.find(item=>item.type==="E-Way Bill");
  else if(d.purchaseOrderNumber&&!d.invoiceNumber&&!d.proformaInvoiceNumber)match=TYPES.find(item=>item.type==="Purchase Order");
  else if(d.proformaInvoiceNumber)match=TYPES.find(item=>item.type==="Proforma Invoice");
  else if(d.invoiceNumber||d.invoiceDate)match=TYPES.find(item=>item.type==="Invoice");
 }
 if(!match)return {type:String(d.documentType||"Other"),identifierField:"",identifierLabel:"Document reference",identifierValue:"",requiredFields:[],dateFields:[],dateValue:"",confidence:"unclassified"};
 const identifierValue=firstValue([d[match.field],identifierFallback(d,match)]);
 const dateValue=firstValue(match.dates.map(key=>d[key]));
 return {type:match.type,identifierField:match.field,identifierLabel:match.label,identifierValue,requiredFields:match.required.slice(),dateFields:match.dates.slice(),dateValue,confidence:"rule-match"};
}
root.ConfiCelDocumentRouter={types:TYPES,classifyDocument};
})(typeof window!=="undefined"?window:globalThis);
