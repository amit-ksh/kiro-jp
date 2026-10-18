# Kiro JP artwork

Original vector artwork authored for this project. No external icon, font outline or generated-image asset is used. Source geometry is `packages/design-tokens/src/brand.ts`; the SVG and PNGs are deterministic renders of its eight rounded strokes. `provenance.json` records raster/source hashes.

The white open book has an orange lower page and speech/ribbon accent. `icon.png` is opaque; adaptive foreground and monochrome images retain transparency. `splash-start.png` is the 日 starting frame, matching the native morph view. The animation's 本 frame is a visual transition, not instructional stroke-order content or a historical derivation.

Keep all exports aligned with the source geometry. Verify 1024-pixel assets, matching alpha for adaptive/monochrome exports and the Android 66/108 safe circle before replacing the installed icon.
