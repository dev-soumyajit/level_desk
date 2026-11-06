# LabelDesk

A responsive Next.js + TypeScript workspace for cropping ecommerce shipping labels and separating invoices. PDFs are processed entirely in the browser; no database, API key, or document upload service is needed.

## Run locally

Use Node.js 22.x and npm, matching the configured Vercel runtime.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:3000. `npm install` also copies the matching PDF.js worker, fonts, CMaps, and WebAssembly files into `public/pdfjs`. All runtime PDF resources are served locally. If install scripts were disabled, run `node scripts/prepare-pdf.mjs` once.

To try the app on a phone on the same Wi-Fi:

```powershell
npm.cmd run dev:network
```

Use the Network URL printed by Next.js, with your computer's LAN IP and port 3000. The computer must permit the local connection.

## Workflow

1. Add original seller-panel PDFs (up to 30 MB per file, 100 MB total, 300 pages).
2. Choose labels only, labels with invoices, or invoices only.
3. Choose 4 x 6 inch shipping stickers (the default), 100 x 150 mm stickers, A6, cropped size, or 2/4 labels per A4 sheet.
4. Inspect each green print area. Drag it, resize its corners, or edit the percentage fields. Touch targets and input sizes adapt for mobile.
5. Confirm any page that needs review. Unknown layouts are never silently cropped to a guessed half-page. Exclude blank or unwanted pages using Include.
6. Download one merged PDF. Print at Actual size / 100%. Check barcode, QR and address readability on one printed label.

Single-label and A4 layouts automatically rotate crops for the largest proportional fit. Cropped-size output preserves source orientation. Sorting by SKU or delivery partner is optional; missing values appear last. Metadata extraction is best-effort, and is visible for inspection.

## Supported layouts and limits

- Automatic split is supported when an identifiable shipping section is followed by one TAX INVOICE / RETAIL INVOICE heading and a safe separator.
- The supplied one-page sample has this layout: the shipping section ends near y=351 pt; SKU PUS02 and quantity 1 remain in the label.
- Recognizable standalone thermal labels can be exported directly.
- Scans, unfamiliar formats, rotated text that cannot be identified, invoice-only pages and multiple label sections per page require manual review. There is no OCR or automatic extraction of multiple labels on one source page. Use Add another crop for manual regions.
- Password-protected, invalid and oversized PDFs receive explicit errors. A failing file does not discard earlier successful files.
- PDF artwork remains vector content where it was vector in the source. Image-only input stays image-only; cropping does not improve its source resolution.
- Cropping is a visible print-area operation, not secure redaction. The exported PDF can retain the source content outside the visible crop.
- Modern Chrome/Edge recommended; the app's PDF engine must be verified against a client's actual devices before production handover.
- The sample contains customer data and is not copied into public assets.

## Checks

```powershell
npm.cmd run check:lock
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Core tests cover cropping, metadata, duplicates, packing reports and PDF coordinates. Browser tests cover mobile/desktop layouts, real PDF uploads and downloads, stock dimensions, invalid files, review gating and saved preferences. They use Chrome by default; choose another installed browser with `PLAYWRIGHT_CHANNEL`. This workspace was verified using modern Edge:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
npm.cmd run test:e2e -- --workers=1
```

For the optional real-sample geometry regression (requires Python with PyMuPDF and Pillow):

```powershell
python scripts/analyze-sample.py
npm.cmd test
```

The script keeps extracted sample data inside the ignored `artifacts` directory. Without that artifact, the real-sample regression is skipped; synthetic tests still run.

## Production

```powershell
npm.cmd run build
npm.cmd start
```

The source is ready for standard Next.js hosting, including Vercel. There are no credentials to configure. Run installation with scripts enabled so the PDF worker/assets exist before building. Deployment was not performed in this workspace.

## Verification in this workspace

- TypeScript checks and the optimized production build pass.
- 34 core tests pass, including the supplied PDF's crop and order/item metadata.
- All 14 desktop/mobile browser cases have passed with Edge, including actual label/invoice downloads, 4x6/metric/A6/A4 output, copies, rotated pages, review gating and recoverable file errors.
- Additional shadcn dropdown checks pass at 320, 360, 375, 390, 414, 540, 768, 1024 and 1440 pixels: viewport bounds, touch selection, descriptions, metadata controls, four batch filters and a short 480px-high viewport.
- Keyboard option navigation, Enter selection, Escape dismissal and focus restoration pass.
- Automatic layout coverage remains limited to recognized sections; review additional real client PDFs and check a physical printed barcode before handover.

See docs/research.md for source links and implementation decisions.

Illustrative outputs from the supplied sample are available locally at `artifacts/sample-labels-only.pdf`, `artifacts/sample-invoices-only.pdf`, and `artifacts/sample-labels-with-invoices.pdf`. These were produced with the installed PyMuPDF library from the tested crop geometry, and visually inspected for the label. They demonstrate the intended crop; they do not verify the app's PDF-lib export path.

For label-stock dimensions, glossy vs thermal media, and printer settings, see [docs/printing.md](docs/printing.md). Stock-size conversions and actual browser export dimension checks pass.

## Daily vendor tools

The workspace now includes editable order/AWB/payment and multi-item SKU details, a searchable batch table, courier/marketplace/payment and issue filters, explicit bulk selection, duplicate-file and duplicate-label checks, local packing checks, PDF-export timestamps, SKU picking CSV/print lists and an internal dispatch checklist. Single-label export, copies, custom stock, margin/rotation controls and saved print preferences are included. Customer/order data is not stored in localStorage.

Read [docs/vendor-workflow.md](docs/vendor-workflow.md) for the complete workflow, tested behavior, local-status meaning and integration boundaries. The official marketplace/courier manifest still comes from the seller/shipping account. Build and browser verification have completed; physical phone/printer acceptance remains separate.

## UI components

The app uses source-owned shadcn/ui Base UI components (`src/components/ui`) with Tailwind CSS 4 and the existing green theme. All dropdowns share a viewport-bounded, scrollable Select with wrapping option descriptions. Main buttons, text/number inputs and textareas use the component layer. Responsive typography is defined once using fluid rem-based tokens; mobile editable fields keep a readable 1rem size.

The `components.json` file supports further shadcn component additions. Source components were installed manually using locally available dependency packages; `package-lock.json` includes the required dependencies for npm installs.

## Vercel installation

Use the current `package-lock.json`; the stale Bun lock has been removed. `vercel.json` validates the lockfile, runs `npm ci`, and then builds with Node 22.x. See [docs/deployment.md](docs/deployment.md) for the dependency-install fix and redeploy steps. Push the changed files and the lockfile deletion before redeploying; the old Git commit retains the old error.
