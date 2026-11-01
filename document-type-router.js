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
 {type:"Consignment Note",aliases:["consignment note","lorry receipt","lr number"],field:"consignmentNoteNumber",label:"Consignment note number",dates:["consignmentDate"],required:["consignmentNoteNumber"]},
 {type:"Dispatch Note",aliases:["dispatch note","dispatch advice"],field:"dispatchNoteNumber",label:"Dispatch note number",dates:["dispatchDate"],required:["dispatchNoteNumber"]},
 {type:"Receipt",aliases:["receipt","payment receipt"],field:"receiptNumber",label:"Receipt number",dates:["receiptDate"],required:["receiptNumber"]},
 {type:"Tax Invoice",aliases:["tax invoice","gst invoice","vat invoice"],field:"invoiceNumber",label:"Invoice number",dates:["invoiceDate","dueDate"],required:["invoiceNumber","invoiceDate"]},
 {type:"Invoice",aliases:["invoice","commercial invoice"],field:"invoiceNumber",label:"Invoice number",dates:["invoiceDate","dueDate"],required:["invoiceNumber","invoiceDate"]}
];
function classifyDocument(data){
 const d=data&&data.extracted?data.extracted:(data||{});
 const explicit=String(d.documentType||"").trim().toLowerCase();
 // Trust a recognized explicit type first, so a linked PO/invoice reference cannot override the document itself.
 let match=TYPES.find(x=>x.aliases.some(a=>explicit===a||explicit.includes(a)));
 if(!match){
  const titleLines=String(d.rawText||"").split(/\r?\n/).slice(0,8).map(x=>x.trim()).filter(x=>x && x.length<=55 && !/\\b(no\\.?|number|#|ref|reference|date)\\b/i.test(x));\n  const raw=[d.documentType,d.documentSubtype,...titleLines].filter(Boolean).join("\\n").toLowerCase();
  for(const item of TYPES){
   const found=item.aliases.some(a=>a.length>3 && new RegExp("(^|[^a-z0-9])"+a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^a-z0-9]|$)","i").test(raw));
   if(found){match=item;break;}
  }
 }
 if(!match){
  if(d.ewayBillNumber)match=TYPES.find(x=>x.type==="E-Way Bill");
  else if(d.purchaseOrderNumber&&!d.invoiceNumber)match=TYPES.find(x=>x.type==="Purchase Order");
  else if(d.proformaInvoiceNumber)match=TYPES.find(x=>x.type==="Proforma Invoice");
  else if(d.invoiceNumber||d.invoiceDate)match=TYPES.find(x=>x.type==="Invoice");
 }
 if(!match)return {type:String(d.documentType||"Other"),identifierField:"",identifierLabel:"Document reference",identifierValue:"",requiredFields:[],dateFields:[],confidence:"unclassified"};
 return {type:match.type,identifierField:match.field,identifierLabel:match.label,identifierValue:d[match.field]||"",requiredFields:match.required.slice(),dateFields:match.dates.slice(),confidence:"rule-match"};
}
root.ConfiCelDocumentRouter={types:TYPES,classifyDocument};
})(typeof window!=="undefined"?window:globalThis);
