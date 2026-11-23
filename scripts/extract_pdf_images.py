#!/usr/bin/env python3
"""
Extract high-resolution anatomical figures directly from a veterinary lecture PDF.
Uses PyMuPDF (fitz) if installed. Zero GPU required.

Usage:
  python scripts/extract_pdf_images.py lecture.pdf --out lectures/lec01/images --min-width 300
"""

import argparse
import pathlib
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract anatomical diagrams from a lecture PDF.")
    parser.add_argument("pdf", help="Path to lecture PDF file")
    parser.add_argument("--out", required=True, help="Output directory for extracted figures")
    parser.add_argument("--min-width", type=int, default=250, help="Ignore tiny icons narrower than this")
    parser.add_argument("--min-height", type=int, default=200, help="Ignore tiny icons shorter than this")
    args = parser.parse_args()

    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("PyMuPDF not installed. Install lightly with: pip install pymupdf", file=sys.stderr)
        return 1

    pdf_path = pathlib.Path(args.pdf)
    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    saved = 0
    seen_xrefs = set()

    for page_idx, page in enumerate(doc, start=1):
        for img_idx, img in enumerate(page.get_images(full=True), start=1):
            xref = img[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)
            base = doc.extract_image(xref)
            w, h = base.get("width", 0), base.get("height", 0)
            if w < args.min_width or h < args.min_height:
                continue
            ext = base.get("ext", "png")
            out_file = out_dir / f"p{page_idx:02d}_fig{img_idx:02d}.{ext}"
            out_file.write_bytes(base["image"])
            saved += 1
            print(f"Extracted: {out_file.name} ({w}x{h})")

    print(f"Total figures extracted: {saved}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
