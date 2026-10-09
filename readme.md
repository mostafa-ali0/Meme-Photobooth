# SAP Cam Booth

A browser photobooth. Pick 4 memes, recreate each with your webcam, export a
print-ready PDF strip in SAP branding.

## Run

```bash
python3 serve.py
```

Opens `http://localhost:8000`. Allow camera access when prompted.

> The camera (`getUserMedia`) only works on a secure context. `localhost`
> counts; opening `index.html` as a `file://` URL does **not**. Always run
> through `serve.py`.

## How it works

1. **Pick** – choose 4 of the 8 memes to recreate.
2. **Shoot** – your webcam on the left, the target meme on the right. Hit
   **Take picture** for a 3-2-1 countdown + snap. **Retake** any shot, or click
   a thumbnail to jump back and redo one. A progress bar tracks captures.
3. **Print** – download a 4×6 PDF strip (your photos left, memes right, SAP
   footer) ready to print.

## Layout

```
.
├── index.html          # markup, 3 stages (pick / shoot / result)
├── serve.py            # tiny static server (localhost, no-cache)
├── readme.md
├── src/
│   ├── app.js          # all app logic + PDF export
│   └── style.css       # SAP-blue theme, trapezoid-scatter background
├── assets/
│   ├── sap-logo.png    # used in header, strip footer, PDF (jsPDF needs PNG)
│   └── sap-logo-png-svg.webp   # original source logo
└── memes/              # the 8 source meme images
```

## Notes

- jsPDF loaded from CDN; needs internet on first load.
- Captured photos never leave the browser — all client-side.
