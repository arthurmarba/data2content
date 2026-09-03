#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


def normalize_text(value: str) -> str:
    normalized = value.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
    return " ".join(normalized.split())


def title_is_present(document_text: str, title: str) -> bool:
    normalized_title = normalize_text(title)
    if normalized_title in document_text:
        return True
    document_tokens = set(re.findall(r"[\w+]+", document_text.casefold()))
    title_tokens = re.findall(r"[\w+]+", normalized_title.casefold())
    return bool(title_tokens) and all(token in document_tokens for token in title_tokens)


def main() -> None:
    parser = argparse.ArgumentParser(description="Valida conteúdo e links do PDF do Radar.")
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    pdf_path = Path(args.pdf).resolve()
    input_path = Path(args.input).resolve()
    batch = json.loads(input_path.read_text(encoding="utf-8"))
    expected = [
        item for item in batch.get("opportunities", [])
        if item.get("review", {}).get("status") == "approved" and item.get("status") != "closed"
    ]

    reader = PdfReader(str(pdf_path))
    if len(reader.pages) < 3:
        raise SystemExit("PDF curto demais para o relatório esperado.")

    annotations = []
    for page in reader.pages:
        for annotation_ref in page.get("/Annots", []):
            annotation = annotation_ref.get_object()
            action = annotation.get("/A")
            if action and action.get("/URI"):
                annotations.append(str(action.get("/URI")))

    with pdfplumber.open(str(pdf_path)) as document:
        text = "\n".join((page.extract_text() or "") for page in document.pages)

    normalized_text = normalize_text(text)
    missing_titles = [item["title"] for item in expected if not title_is_present(normalized_text, item["title"])]
    missing_links = [item["applicationUrl"] for item in expected if item["applicationUrl"] not in annotations]
    forbidden = [token for token in ("undefined", "NaN", "[object Object]") if token in text]
    if missing_titles or missing_links or forbidden:
        raise SystemExit(
            json.dumps(
                {"missingTitles": missing_titles, "missingLinks": missing_links, "forbiddenTokens": forbidden},
                ensure_ascii=False,
                indent=2,
            )
        )

    print(json.dumps({
        "pages": len(reader.pages),
        "approvedOpportunities": len(expected),
        "linkAnnotations": len(annotations),
        "uniqueLinks": len(set(annotations)),
        "status": "ok",
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
