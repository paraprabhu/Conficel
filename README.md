# Conficel — Initial Website

**Tagline:** Tools that simplify work.  
**Product message:** Documents in. Excel out.

This is the initial static website and interaction prototype for Conficel, a document-to-spreadsheet service.

## Included
- Responsive homepage with invoice/document and cheque entry points
- File selection and drag-and-drop UI for PDF, JPG and PNG (10 MB front-end demo limit)
- Editable sample spreadsheet preview
- Downloadable sample CSV generated in the browser
- Responsive layout and Conficel SVG brand mark

## Important prototype limits
- Selected files are **not uploaded** and are **not processed**.
- The extract button intentionally explains that cloud OCR is not connected.
- Sample data is illustrative only; CSV download exports the sample table.
- Login, account verification, database, credit accounting, secure object storage, OCR, Excel generation, billing, deletion policies and production security are not implemented yet.
- Security statements describe design goals, not certifications or guarantees. Do not use this prototype with confidential documents.

## Local preview
Open `index.html` in a browser. The Google Fonts import is optional; a sans-serif fallback is provided.

## Planned next stages
1. Connect a cloud backend and private upload storage with strict limits.
2. Extract embedded PDF text first, then use OCR for scans and images.
3. Generate XLSX files, expose uncertain fields for review, and delete temporary files according to a defined policy.
4. Add authentication and server-side free-usage credits (planned: 10 document conversions and 10 cheque conversions for eligible new accounts).
5. Measure processing costs and validate hosting limits before launching paid credit packs.

Keep this project separate from LABOMER, EXAMIQA and UNILYSE.
