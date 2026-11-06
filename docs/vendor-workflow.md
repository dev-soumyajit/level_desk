# Daily vendor workflow

LabelDesk covers PDF preparation, picking, packing checks and print export for a dispatch batch. It works with seller-issued PDFs. Its automatic crop detection is evidenced against the supplied sample and synthetic fixtures; unfamiliar marketplace/courier formats need manual review.

## Dispatch workflow

1. Add the original PDFs. Exact repeat file uploads are rejected with a recoverable message.
2. Choose label/invoice mode and stock size. The default is 4 x 6 inches. Choose 100 x 150 mm, A6, custom 25–300 mm stock, cropped size or 2/4-up A4 as needed. Set margin, copies and automatic rotation. Only these print preferences are stored locally.
3. Review the crop. For a page with several labels, use **Add another crop**, adjust each region and enter its order/item details. Each additional crop needs confirmation. **Apply crop to matching pages** only applies within the same source and geometry; every affected page needs a fresh review.
4. Open **Order & packing details** to correct order/sub-order ID, AWB, marketplace, courier, prepaid/COD status, product rows, SKU, size, color and quantities. These values drive lists and sorting; seller-issued barcode and tax-invoice artwork is preserved.
5. Use the batch table to search order ID, AWB, SKU, variant or source filename. Filter by marketplace, courier, payment, crop review, duplicates, missing data, multiple units, unpacked or PDF-exported state. **Select matches** adds the matched entries to the export; **Select only matches** replaces the export selection. Search alone does not change selection.
6. Resolve possible repeats. Matching AWBs or identical rendered page/crop fingerprints trigger an export block. **Exclude repeats** keeps the first included entry. Enable **Allow intentional duplicate labels** only for a deliberate repeat print. An order ID alone is not used to remove a shipment, since one order can have separate packets.
7. Download the **SKU picking list** as CSV or open its printable version. It groups by SKU + size + color. Unknown quantities stay flagged instead of becoming one. Print copies never multiply stock quantities.
8. Tick **Packed** after checking a parcel. Use the internal dispatch checklist for order/AWB/courier/payment/packing notes. It is not the courier's official manifest.
9. Download the batch PDF or a single label. Successful downloads receive a local PDF-export timestamp; that timestamp does not establish physical printing, pickup or shipment status. Print one test at Actual size / 100% before a batch.

## Data and integrity

- Customer files and metadata stay in browser memory and are cleared on reload/clear. Print settings alone are saved under `labeldesk.print.v1`.
- Scanned PDFs have manual cropping support; OCR is not included.
- Product-row extraction is best-effort. Wrapped or unfamiliar tables can need manual product-row corrections before using a picking list.
- Page fingerprinting is a duplicate warning mechanism, not a cryptographic authenticity check.
- CSV quotes multiline data, protects spreadsheet formula cells, and prefixes long/zero-prefixed numeric identifiers as text to avoid spreadsheet precision loss. CSV is a working export, not an official marketplace import template.
- Printable reports escape all seller/item text before inserting it into HTML.
- This app does not generate new AWBs, rewrite tax invoices, arrange pickups, synchronize inventory or mark marketplace orders shipped. Those actions need the vendor's shipping/seller account and an appropriate integration.

## Research supporting the boundary

[Flipkart's official order APIs](https://seller.flipkart.com/api-docs/order-api-docs/OMAPIRef.html) describe shipment/item identifiers, quantities, SKU data, labels, multiple packets and shipment states. A local PDF workspace cannot infer live state changes from a downloaded document.

[Shiprocket's official bulk-print help](https://support.shiprocket.in/support/solutions/folders/152000000117) separates bulk label/invoice generation, integrated order imports and manifest generation. LabelDesk provides local working lists; obtain the official handover document from the seller/shipping panel.

## Verification

34 core checks pass in the supplied workspace, including the real sample's crop, order ID, AWB, prepaid status and SKU/variant/quantity extraction. Tests also cover duplicate handling, separate packets, filters, picking aggregation, incomplete quantities, spreadsheet text/formula handling, escaped reports, fresh crop approvals and print-option validation.

TypeScript, production compilation and all 14 desktop/mobile browser cases have passed using modern Edge. The actual PDF.js upload and PDF-lib download paths were exercised. Additional shadcn dropdown checks cover nine viewport widths, touch selection, keyboard navigation and a short viewport. Physical phone/printer verification remains part of acceptance.
