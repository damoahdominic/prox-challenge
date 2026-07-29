#!/usr/bin/env python3
"""Extract text, page renders, and embedded images from the Vulcan OmniPro 220 PDFs.

Outputs (committed to the repo so evaluators don't need Python):
  public/manual/<doc>/pages/page-NN.png   - full page renders (150 dpi)
  public/manual/<doc>/images/...         - embedded raster images (deduped)
  src/mastra/knowledge/<doc>.json        - per-page text + image manifest
"""
import json
import os
import sys

import fitz  # PyMuPDF

SRC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "files")
OUT_PUBLIC = "public/manual"
OUT_KNOWLEDGE = "src/mastra/knowledge"

DOCS = ["owner-manual", "quick-start-guide", "selection-chart"]


def main():
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for doc in DOCS:
        pdf_path = os.path.join(SRC_DIR, f"{doc}.pdf")
        pdf = fitz.open(pdf_path)
        pages_dir = os.path.join(OUT_PUBLIC, doc, "pages")
        images_dir = os.path.join(OUT_PUBLIC, doc, "images")
        os.makedirs(pages_dir, exist_ok=True)
        os.makedirs(images_dir, exist_ok=True)

        seen_xrefs = set()
        manifest_pages = []
        for i, page in enumerate(pdf, start=1):
            # Full page render
            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
            pix.save(os.path.join(pages_dir, f"page-{i:02d}.png"))

            # Embedded raster images (dedupe by xref)
            images = []
            for img in page.get_images(full=True):
                xref = img[0]
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)
                try:
                    extracted = pdf.extract_image(xref)
                except Exception:
                    continue
                if extracted["width"] < 80 or extracted["height"] < 80:
                    continue  # skip icons/bullets
                ext = extracted["ext"]
                fname = f"p{i:02d}-x{xref}.{ext}"
                with open(os.path.join(images_dir, fname), "wb") as f:
                    f.write(extracted["image"])
                images.append(
                    {
                        "file": f"/manual/{doc}/images/{fname}",
                        "width": extracted["width"],
                        "height": extracted["height"],
                    }
                )

            text = page.get_text("text").strip()
            manifest_pages.append(
                {
                    "page": i,
                    "text": text,
                    "pageImage": f"/manual/{doc}/pages/page-{i:02d}.png",
                    "images": images,
                }
            )

        with open(os.path.join(OUT_KNOWLEDGE, f"{doc}.json"), "w") as f:
            json.dump(
                {"doc": doc, "pageCount": len(pdf), "pages": manifest_pages},
                f,
                indent=1,
            )
        print(f"{doc}: {len(pdf)} pages, {len(seen_xrefs)} unique images")
        pdf.close()


if __name__ == "__main__":
    os.makedirs(OUT_KNOWLEDGE, exist_ok=True)
    main()
