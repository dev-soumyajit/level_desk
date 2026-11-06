# Shipping sticker paper and print setup

The app defaults to **4 x 6 inch shipping sticker** output. A PDF defines page dimensions, artwork and layout; glossiness is the physical coating of the label stock and is selected through the appropriate paper and printer driver.

| Preset | Actual physical size | PDF page size |
| --- | --- | --- |
| 4 x 6 inches | 101.6 x 152.4 mm | 288 x 432 pt |
| Metric shipping sticker | 100 x 150 mm | 283.464567 x 425.196850 pt |
| A6 | 105 x 148 mm | 297.637795 x 419.527559 pt |

These three sizes are separate presets. Match the exact size printed on the label pack instead of relying on a listing calling everything A6 or 4x6. Single-label presets default to a 2.1 mm inset and automatic rotation. Inset (0–10 mm), copies (1–10), rotation, and custom stock (25–300 mm per side) can be adjusted.

## Printer setup

1. Choose the same physical stock size in the app and printer driver.
2. Print the downloaded PDF at Actual size / 100%, with Fit to page disabled. Do not enable a borderless expansion option that enlarges the artwork beyond the page.
3. Use stock made for the printer. A direct-thermal label printer needs heat-sensitive direct-thermal labels; an inkjet/laser printer needs label stock compatible with that printing method. The app does not control these driver settings.
4. Print one label and check the address and scan the barcode/QR before a batch.

A customer's description of shiny paper alone does not establish their stock or printer type. Check the label-pack dimensions and printer model before ordering consumables.

## Sources checked on 6 November 2026

- [Shopify hardware: 4 x 6 shipping labels](https://hardware.shopify.com/en-ca/products/zebra-shipping-label): specifies 4 x 6 inch direct-thermal stock, 101.6 x 152.4 mm.
- [Avery: direct thermal vs thermal transfer](https://www.avery.com/help/article/direct-thermal-vs-thermal-transfer-labels): direct thermal uses heat-sensitive material; thermal transfer uses ribbon.
- [Avery: glossy shipping labels](https://www.avery.com/products/labels/6522): shows that glossy adhesive shipping media can be made for laser/inkjet printers. This particular product is not a 4x6 recommendation.
- [Avery: laser/inkjet labels in thermal printers](https://www.avery.com/help/article/can-you-print-laser-inkjet-labels-with-a-thermal-printer): explains media incompatibility.
- [Adobe: A6 paper dimensions](https://www.adobe.com/de/creativecloud/design/discover/a6-format.html): A6 measures 105 x 148 mm.

Core tests verify the physical-size conversions and matching instructions. Browser export dimension checks for all three presets have passed on desktop and mobile layouts using modern Edge.
