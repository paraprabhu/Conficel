# ConfiCel — Initial Website

ConfiCel is a document-to-structured-data website prototype, currently progressing through browser-based extraction.

## Included
- Responsive homepage with invoice/document and cheque entry points
- File selection and drag-and-drop for PDF, JPG and PNG (10 MB front-end limit)
- Browser-based PDF text extraction using PDF.js
- In-browser OCR for JPG/PNG and scanned PDF pages using Tesseract.js
- Editable extracted text and CSV download
- Supabase email signup/sign-in UI

## Extraction stage and limitations
- The current extraction path runs in the user's browser; selected files are not uploaded to ConfiCel servers by this code.
- The first pass extracts readable text. OCR quality depends on scan clarity, language, rotation and document layout.
- It does not yet reliably map invoice fields (supplier, invoice number, dates, tax, totals, line items) or validate cheque fields (payee, date, amount, cheque number).
- It does not yet generate a true structured Excel workbook, enforce server-side plan allowances, implement paid billing, or activate subscriptions.
- The workspace initially shows illustrative sample data. Extract a file before downloading the actual extracted-text CSV.
- The browser loads PDF.js/Tesseract.js from public CDNs; processing needs an internet connection to load those libraries the first time.
- Do not use the current prototype for confidential or business-critical documents until security, accuracy, retention and production controls have been reviewed.

## Planned next stages
1. Test browser-based extraction on representative text PDFs, scanned PDFs and images.
2. Add reliable field parsing and a review workflow for invoice and cheque data.
3. Generate XLSX and CSV files from reviewed extracted values.
4. Add server-side usage accounting, secure storage where needed, and deletion/retention controls.
5. Evaluate a hosted OCR/AI service only after its privacy, cost and security requirements are decided.
6. Connect subscription activation after payment and usage rules are implemented.

Keep this project separate from LABOMER, EXAMIQA and UNILYSE.
