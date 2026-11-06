# Research and design decisions

Research date: 6 November 2026. Reference pages were inspected; no customer PDF was uploaded to the reference service, and its output was not tested.

## Reference workflow

[Flipkart cropper](https://lebely.com/flipkart-label-crop-tool/): upload a PDF, choose with/without invoices, download the cropped file. The page advertises batch cropping, SKU detection, sorting and adaptive dimensions. Advertising alone does not establish its accuracy across formats.

[Meesho cropper](https://lebely.com/meesho-label-crop-tool/): additionally exposes label-printer/A4 layouts, labels per sheet, and sorting by SKU or delivery partner. These options fit the user's supplied PDF better than assuming a fixed Flipkart-only template.

## Sample analysis

The supplied file is one A4 page (595 x 842 PDF points), with selectable text and vector barcode/QR artwork. Shipping and return addresses occupy the upper left; Delhivery routing, payment information and barcodes occupy the upper right. The product table is underneath; its SKU is PUS02 and quantity is 1. A TAX INVOICE begins near y=351 points (coordinates measured downward from the visible top). Printed document content ends near y=655, leaving bottom whitespace.

Marketplace identification is uncertain: the structure resembles common Meesho exports, but the actual PDF does not establish its marketplace. The app uses section evidence instead of a marketplace name or one fixed coordinate.

## PDF inspection

[PDF.js page API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html) provides getTextContent, render and getViewport. Text positions are converted through the visible viewport, which accounts for page rotation and page origins. Raster analysis is used only to locate occupied page bounds and horizontal separators; it does not become the exported label.

[PDF.js setup](https://mozilla.github.io/pdf.js/getting_started/) documents the worker distribution. The postinstall script copies the worker and support assets from the same installed package to avoid version mismatch or CDN requests.

## PDF output

[PDFDocument.embedPage](https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedpage) accepts a clipping bounding box. [PDFPage.drawPage](https://pdf-lib.js.org/docs/api/classes/pdfpage#drawpage) supports scaling, rotation and translation. The exporter converts a visible crop back to PDF coordinates, embeds it into new pages, and fits proportionally. Original vector drawing commands are preserved rather than rasterizing shipping codes. Output uses PrintScaling.None as a viewer hint; printer settings still need to be checked.



## Framework and device behavior

[Next.js installation](https://nextjs.org/docs/app/getting-started/installation) describes the App Router and Node requirements. This app uses a client workspace, with lazy PDF engine loading and no server document endpoint. Framework and React versions are pinned; React and React DOM use matching versions.

The layout stacks below tablet widths and uses touch pointer events, enlarged crop handles and 16px phone inputs. Browser QA is specified at 320, 360, 375, 390, 540, 768, 850, 1024 and 1440 pixels. The desktop/mobile browser cases and actual PDF export checks now pass using modern Edge. Static source rendering also passed.

## Conservative behavior

Unknown/scanned/multiple-section pages default to the full visible content and require confirmation. No OCR or unsupported marketplace coverage is implied. Manual crops are per page and per output mode. Switching mode resets approvals so a label approval does not accidentally approve an invoice crop. Encrypted PDFs are rejected rather than opened with an ignored encryption flag. Limits bound page count and raster dimensions on mobile devices.

## Remaining acceptance checks

Typecheck, core tests, production build and browser cases have passed. For client acceptance, inspect additional genuine marketplace/courier examples and scan a label from the actual printer. Auto-detection remains evidenced against the provided sample and synthetic fixtures; unfamiliar layouts require review.

## Vendor dispatch expansion

The expanded local workflow and its primary-source research are recorded in [vendor-workflow.md](vendor-workflow.md). It distinguishes label entries from unique orders, missing quantities from known quantities, and local packed/exported checks from live shipping status. There are now 34 passing core checks, including the supplied sample metadata.

## shadcn/ui migration

The app follows the [shadcn/ui Base UI Select composition](https://ui.shadcn.com/docs/components/base/select), with local Button, Input, Textarea and Select sources. Tailwind 4 supplies the component utilities. Popup width/height follows the viewport and anchor, option text wraps, and keyboard/touch behavior uses Base UI. Real browser checks cover nine widths plus short-screen, focus-restoration and keyboard scenarios.
