# LUKI Knowledge V37 — 2026-09-05

## Current live Public Beta All Access tools
1. AI Audio Repair — live.
2. Image Enhancer — live.
3. Background Remover — live.
4. Smart Image Compressor — live.
5. Image to Text / OCR — live.

Current Public Beta All Access has no successful-job daily cap. Sign-in is still required before processing actions. Future paid Pro/Premium is not for sale and public QR/UPI checkout is not active.

## Image to Text / OCR
Tool: `image-to-text.html`
Guide: `article-image-to-text.html`

Purpose: extract editable text from photos, screenshots, scanned pages and receipts with browser-side OCR.

Current controls/features:
- Auto, Document, Screenshot, Table / Receipt and Handwriting (Experimental) modes.
- OCR choices: English, Hindi, English + Hindi, Marathi, Bengali, Gujarati, Tamil, Telugu, Kannada, Malayalam, Punjabi and Urdu.
- Auto Clean.
- Tiny Text Upscale.
- Preserve Line Breaks.
- Smart OCR Race: optional two-pass recognition that compares a normal cleanup path with a stronger contrast path and keeps the higher-confidence result.
- Manual 90-degree rotation and extra contrast.
- Batch queue up to 10 images.
- OCR confidence estimate and editable result.
- Copy text, TXT, Markdown and JSON export.
- Best-effort Table to CSV export.
- Local Privacy Pattern Scan for common email-like and phone/number-like patterns.
- Find-in-text count.

Privacy/processing:
- Image pixels are processed in the browser.
- Tesseract.js OCR engine and selected language data are downloaded to the device.
- Images are not sent to the RIVANI account API for OCR.
- Browser/network caching may retain technical OCR engine/language files.

Limits:
- OCR can misread similar characters, names, numbers and punctuation.
- Complex layouts, perspective distortion, low contrast and tiny text can reduce accuracy.
- Table-to-CSV is heuristic and not a spreadsheet reconstruction guarantee.
- Handwriting mode is experimental and should not be described as highly reliable.
- Confidence scores are estimates, not proof that every character is correct.

## Smart Image Compressor
Tool: `image-compressor.html`
Guide: `article-image-compressor.html`
Recommended default: Best Quality + Smaller Size with Visual Quality Guard, Text & Logo Guard, Transparency Guard and Smart Format Race enabled.

## Upcoming after V37
- PDF Toolkit
- AI Resume Builder
- AI Logo Generator
- Advanced Student Calculator
- Other roadmap utilities as labeled on the website
