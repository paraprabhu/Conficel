(function(root){
"use strict";
const TYPES = [
 {type:"E-Way Bill",aliases:["eway bill","e-way bill","e way bill","ewb"],field:"ewayBillNumber",label:"E-Way Bill number",dates:["ewayBillDate","ewayBillValidUntil"],required:["ewayBillNumber"]},
 {type:"Purchase Order",aliases:["purchase order","purchase order form","po"],field:"purchaseOrderNumber",label:"PO number",dates:["orderDate","requiredByDate"],required:["purchaseOrderNumber"]},
 {type:"Proforma Invoice",aliases:["proforma invoice","pro forma invoice","pi"],field:"proformaInvoiceNumber",label:"Proforma invoice number",dates:["proformaInvoiceDate","dueDate"],required:["proformaInvoiceNumber"]},
 {type:"Credit Note",aliases:["credit note","credit memo"],field:"creditNoteNumber",label:"Credit note number",dates:["creditNoteDate"],required:["creditNoteNumber"]},
 {type:"Debit Note",aliases:["debit note","debit memo"],field:"debitNoteNumber",label:"Debit note number",dates:["debitNoteDate"],required:["debitNoteNumber"]},
 {type:"Delivery Challan",aliases:["delivery challan","delivery note"],field:"deliveryChallanNumber",label:"Delivery challan number",dates:["deliveryChallanDate"],required:["deliveryChallanNumber"]},
 {type:"Sales Order",aliases:["sales order","customer order"],field:"salesOrderNumber",label:"Sales order number",dates:["salesOrderDate","requiredByDate"],required:["salesOrderNumber"]},
 {type:"Quotation",aliases:["quotation","quote","estimate"],field:"quotationNumber",label:"Quotation number",dates:["quotationDate","validUntil"],required:["quotationNumber"]},
 {type:"Goods Receipt Note",aliases:["goods receipt note","goods received note","grn"],field:"goodsReceiptNumber",label:"Goods receipt number",dates:["goodsReceiptDate"],required:["goodsReceiptNumber"]},
 {type:"Packing List",aliases:["packing list","packing slip"],field:"packingListNumber",label:"Packing list number",dates:["packingListDate"],required:["packingListNumber"]},
 {type:"Bill of Lading",aliases:["bill of lading","b/l","bol"],field:"billOfLadingNumber",label:"Bill of Lading number",dates:["billOfLadingDate"],required:["billOfLadingNumber"]},
 {type:"Air Waybill",aliases:["air waybill","airway bill","awb"],field:"airWaybillNumber",label:"Air Waybill number",dates:["airWaybillDate"],required:["airWaybillNumber"]},
 {type:"Consignment Note",aliases:["consignment note","lorry receipt","lr number","goods receipt"],field:"consignmentNoteNumber",label:"Consignment note number",dates:["consignmentDate"],required:["consignmentNoteNumber"]},
 {type:"Dispatch Note",aliases:["dispatch note","dispatch advice"],field:"dispatchNoteNumber",label:"Dispatch note number",dates:["dispatchDate"],required:["dispatchNoteNumber"]},
 {type:"Receipt",aliases:["receipt","payment receipt"],field:"receiptNumber",label:"Receipt number",dates:["receiptDate"],required:["receiptNumber"]},
 {type:"Tax Invoice",aliases:["tax invoice","gst invoice","vat invoice"],field:"invoiceNumber",label:"Invoice number",dates:["invoiceDate","dueDate"],required:["invoiceNumber","invoiceDate"]},
 {type:"Invoice",aliases:["invoice","commercial invoice","bill"],field:"invoiceNumber",label:"Invoice number",dates:["invoiceDate","dueDate"],required:["invoiceNumber","invoiceDate"]}
];
function textOf(d){
 const fields=Array.isArray(d.documentFields)?d.documentFields.map(x=>[x.label,x.value].filter(Boolean).join(": ")).join("\n"):"";
 return [d.documentType,d.documentSubtype,d.rawText,fields].filter(Boolean).join("\n").toLowerCase();
}
function classifyDocument(data){
 const d=data&&data.extracted?data.extracted:(data||{});
 const raw=textOf(d);
 const explicit=String(d.documentType||"").trim().toLowerCase();
 let match=null;
 // Strong specific document labels take precedence over generic mentions in body text.
 const ordered=TYPES.slice(0,-1);
 for(const item of ordered){
  const explicitMatch=item.aliases.some(a=>explicit===a||explicit.includes(a));
  const textMatch=item.aliases.some(a=>new RegExp("(^|[^a-z0-9])"+a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^a-z0-9]|$)","i").test(raw));
  if(explicitMatch||textMatch){match=item;break;}
 }
 if(!match){
  const inv=TYPES[TYPES.length-1];
  if(inv.aliases.some(a=>explicit===a||new RegExp("(^|[^a-z0-9])"+a+"([^a-z0-9]|$)","i").test(raw)))match=inv;
 }
 if(!match){
  const po=!!d.purchaseOrderNumber;
  if(po)match=TYPES.find(x=>x.type==="Purchase Order");
  else if(d.invoiceNumber||d.invoiceDate)match=TYPES.find(x=>x.type==="Invoice");
 }
 if(!match)return {type:String(d.documentType||"Other"),identifierField:"",identifierLabel:"Document reference",requiredFields:[],dateFields:[],confidence:"unclassified"};
 const identifierValue=d[match.field]||"";
 return {type:match.type,identifierField:match.field,identifierLabel:match.label,identifierValue,requiredFields:match.required.slice(),dateFields:match.dates.slice(),confidence:"rule-match"};
}
root.ConfiCelDocumentRouter={types:TYPES,classifyDocument};
})(typeof window!=="undefined"?window:globalThis);
