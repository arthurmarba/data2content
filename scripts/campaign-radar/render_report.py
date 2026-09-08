#!/usr/bin/env python3
"""Gera o PDF do Radar de Oportunidades Públicas.

Design: uma coluna, tipografia grande, cor de marca gasta em um lugar só.
Cada card responde, nesta ordem, às três perguntas de decisão do creator:
quanto paga, o que eu entrego, se eu posso participar.
"""
from __future__ import annotations

import argparse
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# --- paleta ------------------------------------------------------------------
# O rosa da marca aparece só no botão e no prazo. Todo o resto é tinta e papel.
PINK = colors.HexColor("#E90F4F")
INK = colors.HexColor("#17140F")
TEXT = colors.HexColor("#413A32")
MUTED = colors.HexColor("#8A8177")
MUTED_DARK = colors.HexColor("#7A7167")
RULE = colors.HexColor("#E4DED4")
NEUTRAL = colors.HexColor("#F7F4F0")
WHITE = colors.white

UTC = timezone.utc
SAO_PAULO = ZoneInfo("America/Sao_Paulo")

CONTENT_WIDTH = 176 * mm
CARD_RAIL = 56 * mm
CARD_GAP = 12 * mm
CARD_LEFT = CONTENT_WIDTH - CARD_RAIL - CARD_GAP
LABEL_COLUMN = 34 * mm
LABEL_GAP = 6 * mm

MONTHS = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def register_fonts() -> tuple[str, str]:
    candidates = [
        (
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        ),
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
    ]
    for regular, bold in candidates:
        if all(Path(item).exists() for item in (regular, bold)):
            pdfmetrics.registerFont(TTFont("RadarSans", regular))
            pdfmetrics.registerFont(TTFont("RadarSansBold", bold))
            return "RadarSans", "RadarSansBold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


def safe(value: Any) -> str:
    normalized = str(value or "").replace("‑", "-").replace("–", "-").replace("—", "-")
    return html.escape(normalized, quote=True)


def collapse(value: Any) -> str:
    return " ".join(str(value or "").split())


def shorten(value: Any, limit: int) -> str:
    text = collapse(value)
    if len(text) <= limit:
        return text
    clipped = text[: max(1, limit - 1)].rsplit(" ", 1)[0]
    return f"{clipped or text[: max(1, limit - 1)]}…"


def format_brl(value: float | int | None) -> str:
    if value is None:
        return ""
    amount = f"{float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if amount.endswith(",00"):
        amount = amount[:-3]
    return f"R$ {amount}"


def format_date(value: str | None) -> str:
    """Datas puras ('2026-09-04') saem como estão — é o prazo que a fonte
    publicou. Instantes com hora ('...T00:30:00Z') são convertidos para o fuso
    de São Paulo: a coleta roda de noite e, em UTC, a edição vira o dia seguinte.
    """
    if not value:
        return ""
    text = str(value)
    if "T" in text:
        try:
            instant = datetime.fromisoformat(text.replace("Z", "+00:00"))
            if instant.tzinfo is None:
                instant = instant.replace(tzinfo=UTC)
            return instant.astimezone(SAO_PAULO).strftime("%d/%m/%Y")
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return text


# --- leitura do conteúdo -----------------------------------------------------
# O campo `summary` das fontes automatizadas repete o título e depois lista
# "Categorias / Plataformas / Formatos / Vagas" em texto corrido. Isso duplica a
# tabela do card. Aqui esses dados viram campos, e o parágrafo só sobrevive
# quando é texto humano de verdade (caso das chamadas da Squid).

def extract_from_summary(opportunity: dict[str, Any]) -> dict[str, str]:
    summary = collapse(opportunity.get("summary"))
    found: dict[str, str] = {}
    for key, pattern in (
        ("platforms", r"Plataformas:\s*([^.]+)\."),
        ("formats", r"Formatos:\s*([^.]+)\."),
        ("slots", r"Vagas:\s*(\d+)"),
    ):
        match = re.search(pattern, summary)
        if match:
            found[key] = collapse(match.group(1))
    return found


def editorial_note(opportunity: dict[str, Any]) -> str | None:
    """Devolve o resumo só quando ele não é o texto gerado automaticamente."""
    summary = collapse(opportunity.get("summary"))
    title = collapse(opportunity.get("title"))
    if not summary:
        return None
    if title and summary.lower().startswith(title.lower()[:24]):
        return None
    return trim_to_sentence(summary, 210)


def trim_to_sentence(text: str, limit: int) -> str:
    """Termina sempre em frase completa. A fonte já entrega o resumo cortado no
    meio ('...Eles querem todos'), então isso vale mesmo abaixo do limite."""
    text = collapse(text)
    window = text if len(text) <= limit else text[:limit]
    if len(text) <= limit and window.endswith((".", "!", "?")):
        return window
    cut = max(window.rfind(". "), window.rfind("! "), window.rfind("? "))
    if cut > len(window) * 0.4:
        return window[: cut + 1]
    return shorten(text, limit)


def is_tag_soup(text: str) -> bool:
    """Detecta listas de palavras-chave ('Moda Beleza Instagram Reels'), que a
    fonte guarda no mesmo campo das exigências reais."""
    words = text.split()
    if len(words) < 3:
        return False
    capitalized = sum(1 for word in words if word[:1].isupper())
    return capitalized / len(words) >= 0.6 and not any(mark in text for mark in ",:;.")


def readable_deliverables(opportunity: dict[str, Any]) -> list[str]:
    """Mostra as duas entregas quando são curtas e complementares; quando são
    longas, a fonte costuma repetir a mesma entrega em duas redações — nesse
    caso fica a mais enxuta."""
    items = [collapse(item) for item in (opportunity.get("deliverables") or []) if collapse(item)]
    if len(items) <= 1:
        return items[:1]
    pair = items[:2]
    if sum(len(item) for item in pair) <= 160:
        return pair
    return [min(pair, key=len)]


def real_requirements(opportunity: dict[str, Any]) -> list[str]:
    """Filtra o boilerplate: exigência de verdade é curta, específica e completa."""
    kept = []
    for item in opportunity.get("requirements") or []:
        text = collapse(item)
        if not 12 < len(text) <= 90:
            continue
        if text.lower().startswith(("este projeto", "antes de avançar")):
            continue
        if text.lower().rstrip(":").endswith(" que"):  # frase de abertura truncada
            continue
        if is_tag_soup(text):
            continue
        # O card de programa já traz "não garante campanha" como aviso fixo.
        if is_program(opportunity) and "não garante" in text.lower():
            continue
        kept.append(text)
    return kept[:2]


def compensation_label(opportunity: dict[str, Any]) -> tuple[str, str]:
    compensation = opportunity["compensation"]
    kind = compensation["type"]
    minimum = compensation.get("minimum")
    maximum = compensation.get("maximum")
    basis = compensation.get("basis")
    source_text = compensation.get("sourceText")

    if compensation.get("confirmed") and basis in ("per_creator", "per_delivery"):
        if minimum is not None and maximum is not None and minimum != maximum:
            return f"{format_brl(minimum)} a {format_brl(maximum)}", "Cachê individual confirmado pela fonte"
        if minimum is not None:
            return format_brl(minimum), "Cachê individual confirmado pela fonte"
    if kind == "variable":
        if collapse(source_text).lower().startswith("orçamento aberto"):
            return "Orçamento aberto", "Envie sua proposta; o cachê ainda não foi confirmado"
        return collapse(source_text) or "Remuneração variável", "Depende de venda ou performance"
    if kind == "barter":
        return "Permuta ou produto", "Sem pagamento em dinheiro"
    if basis == "total_campaign_budget":
        if minimum is not None and maximum is not None and minimum != maximum:
            value = f"{format_brl(minimum)} a {format_brl(maximum)}"
        elif minimum is not None and maximum is None:
            value = f"A partir de {format_brl(minimum)}"
        elif maximum is not None and minimum is None:
            value = f"Até {format_brl(maximum)}"
        elif minimum is not None:
            value = format_brl(minimum)
        else:
            value = collapse(source_text) or "Investimento divulgado"
        return value, "Orçamento total da campanha — não é o seu cachê"
    if compensation.get("confirmed"):
        return "Há cachê", "Valor não divulgado publicamente"
    return "Não divulgado", "Consulte na plataforma de origem"


def is_program(opportunity: dict[str, Any]) -> bool:
    """Programa/banco de creators: você se inscreve numa lista, não numa campanha.
    Não tem entrega, não tem cachê e a inscrição não garante nada — por isso sai
    das seções de valor e ganha seção e card próprios."""
    return opportunity.get("opportunityType") == "creator_program"


def program_benefit(opportunity: dict[str, Any]) -> str:
    """O que ocupa, no card de programa, o lugar do valor. Num programa 'quanto
    paga' não existe; o que existe é o que a inscrição te dá."""
    summary = collapse(opportunity.get("summary"))
    if summary:
        first = trim_to_sentence(summary, 150)
        if first:
            return first
    return "Inscrição para o banco de creators da marca"


def group_key(opportunity: dict[str, Any]) -> str:
    compensation = opportunity["compensation"]
    if compensation.get("confirmed") and compensation.get("basis") in ("per_creator", "per_delivery"):
        return "confirmed"
    if compensation.get("type") == "variable":
        return "budget"
    if compensation.get("type") == "barter":
        return "budget"
    if compensation.get("basis") == "total_campaign_budget":
        return "budget"
    return "unknown"


# --- documento ---------------------------------------------------------------

class RadarDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, edition_label: str = "", **kwargs: Any):
        self.edition_label = edition_label
        super().__init__(filename, pagesize=A4, **kwargs)
        page_width, page_height = A4
        frame = Frame(
            17 * mm,
            18 * mm,
            page_width - 34 * mm,
            page_height - 34 * mm,
            id="normal",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(PageTemplate(id="radar", frames=[frame], onPage=self.draw_page))

    def draw_page(self, canvas: Any, doc: Any) -> None:
        width, _ = A4
        canvas.saveState()
        canvas.setFillColor(WHITE)
        canvas.rect(0, 0, width, A4[1], stroke=0, fill=1)
        if doc.page > 1:
            canvas.setFont(FONT, 7)
            canvas.setFillColor(MUTED)
            # O rodapé é a única linha com entreletras do design; no reportlab
            # isso só existe em objeto de texto, não no drawString direto.
            self.tracked_text(canvas, 17 * mm, 11 * mm, "DATA2CONTENT · RADAR DE PUBLIS")
            label = self.edition_label
            span = stringWidth(label, FONT, 7) + 0.56 * max(len(label) - 1, 0)
            self.tracked_text(canvas, width - 17 * mm - span, 11 * mm, label)
        canvas.restoreState()

    @staticmethod
    def tracked_text(canvas: Any, x: float, y: float, value: str, tracking: float = 0.56) -> None:
        text = canvas.beginText(x, y)
        text.setFont(FONT, 7)
        text.setFillColor(MUTED)
        text.setCharSpace(tracking)
        text.textOut(value)
        canvas.drawText(text)


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "wordmark": ParagraphStyle(
            "wordmark", parent=base["Normal"], fontName=FONT_BOLD, fontSize=10,
            leading=13, textColor=INK,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"], fontName=FONT_BOLD, fontSize=38,
            leading=38.8, textColor=INK, alignment=TA_LEFT,
        ),
        "cover_lead": ParagraphStyle(
            "cover_lead", parent=base["Normal"], fontName=FONT, fontSize=12,
            leading=19.2, textColor=TEXT,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta", parent=base["Normal"], fontName=FONT_BOLD, fontSize=8.5,
            leading=12, textColor=MUTED,
        ),
        "section_title": ParagraphStyle(
            "section_title", parent=base["Heading1"], fontName=FONT_BOLD, fontSize=16,
            leading=18, textColor=INK, spaceBefore=0, spaceAfter=0,
        ),
        "section_note": ParagraphStyle(
            "section_note", parent=base["Normal"], fontName=FONT, fontSize=8,
            leading=11.2, textColor=MUTED, alignment=TA_RIGHT,
        ),
        "group_label": ParagraphStyle(
            "group_label", parent=base["Normal"], fontName=FONT_BOLD, fontSize=8.2,
            leading=11, textColor=MUTED_DARK,
        ),
        "group_count": ParagraphStyle(
            "group_count", parent=base["Normal"], fontName=FONT, fontSize=8.2,
            leading=11, textColor=MUTED_DARK, alignment=TA_RIGHT,
        ),
        "source": ParagraphStyle(
            "source", parent=base["Normal"], fontName=FONT_BOLD, fontSize=7.8,
            leading=10, textColor=MUTED_DARK,
        ),
        "card_title": ParagraphStyle(
            "card_title", parent=base["Heading2"], fontName=FONT_BOLD, fontSize=13.5,
            leading=16.9, textColor=INK, spaceBefore=0, spaceAfter=0,
        ),
        "money": ParagraphStyle(
            "money", parent=base["Normal"], fontName=FONT_BOLD, fontSize=14,
            leading=16.8, textColor=INK,
        ),
        "money_note": ParagraphStyle(
            "money_note", parent=base["Normal"], fontName=FONT, fontSize=8,
            leading=12, textColor=MUTED_DARK,
        ),
        "cta": ParagraphStyle(
            "cta", parent=base["Normal"], fontName=FONT_BOLD, fontSize=8,
            leading=12, textColor=PINK,
        ),
        "verified": ParagraphStyle(
            "verified", parent=base["Normal"], fontName=FONT, fontSize=7.6,
            leading=11.4, textColor=MUTED_DARK,
        ),
        "label": ParagraphStyle(
            "label", parent=base["Normal"], fontName=FONT_BOLD, fontSize=7.6,
            leading=11, textColor=MUTED_DARK,
        ),
        "value": ParagraphStyle(
            "value", parent=base["Normal"], fontName=FONT, fontSize=10,
            leading=15, textColor=INK,
        ),
        "term": ParagraphStyle(
            "term", parent=base["Normal"], fontName=FONT, fontSize=10,
            leading=15.5, textColor=TEXT,
        ),
        "guide_label": ParagraphStyle(
            "guide_label", parent=base["Normal"], fontName=FONT_BOLD, fontSize=7.5,
            leading=11.2, textColor=MUTED,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName=FONT, fontSize=9.5,
            leading=16.2, textColor=TEXT, spaceBefore=0, spaceAfter=0,
        ),
        "source_name": ParagraphStyle(
            "source_name", parent=base["Normal"], fontName=FONT_BOLD, fontSize=9,
            leading=13, textColor=INK,
        ),
        "source_detail": ParagraphStyle(
            "source_detail", parent=base["Normal"], fontName=FONT, fontSize=9.5,
            leading=15.2, textColor=TEXT,
        ),
        "footnote": ParagraphStyle(
            "footnote", parent=base["Normal"], fontName=FONT, fontSize=7.5,
            leading=12, textColor=MUTED,
        ),
    }


def flat_table(rows: list[list[Any]], widths: list[float], extra: list[tuple] | None = None) -> Table:
    # hAlign LEFT: no reportlab a tabela nasce centrada, o que desalinharia
    # qualquer bloco mais estreito que a coluna de texto.
    table = Table(rows, colWidths=widths, hAlign="LEFT")
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]
    style.extend(extra or [])
    table.setStyle(TableStyle(style))
    return table


def constrained(flowables: list[Any], width: float) -> Table:
    return flat_table([[flowables]], [width])


def pair_grid(pairs: list[tuple[str, str]], value_style: ParagraphStyle, styles: dict[str, ParagraphStyle]) -> Table:
    # Duas grades por card: identidade e compromisso. O rótulo à esquerda em
    # coluna fixa é o que deixa a leitura em diagonal possível.
    rows = [
        [Paragraph(safe(label.upper()), styles["label"]), Paragraph(safe(value), value_style)]
        for label, value in pairs
    ]
    return flat_table(rows, [LABEL_COLUMN, CARD_LEFT - LABEL_COLUMN - LABEL_GAP], [
        ("RIGHTPADDING", (0, 0), (0, -1), LABEL_GAP),
        ("BOTTOMPADDING", (0, 0), (-1, -2), 2.8 * mm),
        ("TOPPADDING", (0, 0), (0, -1), 0.7 * mm),
    ])


def opportunity_card(opportunity: dict[str, Any], styles: dict[str, ParagraphStyle]) -> Table:
    money, money_note = compensation_label(opportunity)
    parsed = extract_from_summary(opportunity)
    deadline = format_date(opportunity.get("applicationDeadline"))
    note = editorial_note(opportunity)
    requirements = real_requirements(opportunity)
    deliverables = readable_deliverables(opportunity)
    program = is_program(opportunity)

    # Sem prazo, a idade é o que diz se ainda vale: mostramos desde quando a
    # chamada está no radar em vez de um "sem prazo" mudo.
    seen = format_date(opportunity.get("discoveredAt")) or format_date(opportunity.get("lastVerifiedAt"))
    undated = f"sem prazo · vista em {seen[:5]}" if seen else "sem prazo publicado"
    if program:
        deadline_label = f"até {deadline}" if deadline else "inscrição aberta"
        money, money_note = "Sem cachê", "Entrada em banco de creators"
    else:
        deadline_label = f"até {deadline}" if deadline else undated

    header = flat_table(
        [[
            Paragraph(safe(opportunity["sourcePlatform"].upper()), styles["source"]),
            Paragraph(safe(deadline_label.upper()), ParagraphStyle(
                "deadline_inline", parent=styles["source"], textColor=PINK,
            )),
        ]],
        [42 * mm, CARD_LEFT - 42 * mm],
    )

    left: list[Any] = [
        header,
        Spacer(1, 3.5 * mm),
        Paragraph(safe(shorten(opportunity["title"], 110)), styles["card_title"]),
    ]

    # identidade: o que a campanha é
    identity: list[tuple[str, str]] = []
    territories = opportunity.get("territories") or []
    if territories:
        identity.append(("Território", " · ".join(territories[:3])))
    formats = parsed.get("formats") or " · ".join(opportunity.get("formats") or [])
    if formats:
        identity.append(("Formato", shorten(formats, 60)))
    platforms = parsed.get("platforms") or " · ".join(opportunity.get("platforms") or [])
    if platforms:
        identity.append(("Onde publicar", shorten(platforms, 60)))
    if parsed.get("slots"):
        identity.append(("Vagas", parsed["slots"]))
    if identity:
        left.extend([Spacer(1, 6 * mm), pair_grid(identity[:4], styles["value"], styles)])

    # compromisso: o que você assume
    commitment: list[tuple[str, str]] = []
    if program:
        commitment.append(("O que você ganha", program_benefit(opportunity)))
    if deliverables:
        commitment.append(("Você entrega", " · ".join(shorten(d, 125) for d in deliverables[:2])))
    if requirements:
        commitment.append(("Para participar", " · ".join(requirements)))
    if note and not deliverables and not program:
        commitment.append(("Contexto", note))
    if program:
        commitment.append(("Atenção", "Entrar na lista não garante campanha nem pagamento."))
    if commitment:
        left.extend([Spacer(1, 5 * mm), pair_grid(commitment, styles["term"], styles)])

    cta_label = "Ver e candidatar-se"
    platform = opportunity["sourcePlatform"].lower()
    if program:
        cta_label = "Fazer minha inscrição"
    elif platform == "mis":
        # Não há página web da campanha: ela vive dentro do aplicativo.
        cta_label = "Abrir no app do MIS"
    elif platform == "creator ads":
        # Na Creator Ads não há resposta na hora: entra-se numa seleção.
        cta_label = "Cadastrar-se na seleção"
    elif platform == "squid":
        cta_label = "Abrir candidatura na Squid"
    elif platform == "99freelas":
        cta_label = "Enviar proposta no 99Freelas"
    elif platform == "workana":
        cta_label = "Enviar proposta no Workana"
    elif platform.startswith("threads"):
        cta_label = "Ver a chamada no Threads"
    elif platform == "the insiders brasil":
        cta_label = "Abrir inscrição na The Insiders"
    elif platform == "brasil game show":
        cta_label = "Pedir credencial"
    elif platform == "popline creators":
        cta_label = "Criar conta na POPline"

    rail: list[Any] = [
        Paragraph(safe(money), styles["money"]),
        Spacer(1, 2 * mm),
        Paragraph(safe(money_note), styles["money_note"]),
        Spacer(1, 7 * mm),
        Paragraph(
            f"<link href=\"{safe(opportunity['applicationUrl'])}\" color=\"#E90F4F\">"
            f"{safe(cta_label.upper())} &#8594;</link>",
            styles["cta"],
        ),
        Spacer(1, 2 * mm),
        Paragraph(
            f"Verificado em {safe(format_date(opportunity.get('lastVerifiedAt')))} · "
            f"<link href=\"{safe(opportunity['sourceUrl'])}\" color=\"#7A7167\"><u>ver na fonte</u></link>",
            styles["verified"],
        ),
    ]

    card = Table([[left, rail]], colWidths=[CARD_LEFT + CARD_GAP, CARD_RAIL], hAlign="LEFT")
    card.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBEFORE", (1, 0), (1, 0), 0.6, RULE),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), CARD_GAP),
        ("LEFTPADDING", (1, 0), (1, 0), 8 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 9 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9 * mm),
    ]))
    return card


def approved_open(batch: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item for item in batch.get("opportunities", [])
        if item.get("review", {}).get("status") == "approved" and item.get("status") != "closed"
    ]


def sort_key(opportunity: dict[str, Any]) -> tuple[int, str]:
    deadline = opportunity.get("applicationDeadline")
    return (0, deadline) if deadline else (1, "")


def cover_count_label(campaigns: int, programs: int) -> str:
    label = f"{campaigns} {'CAMPANHA ABERTA' if campaigns == 1 else 'CAMPANHAS ABERTAS'}"
    if programs:
        label += f"  ·  {programs} {'PROGRAMA' if programs == 1 else 'PROGRAMAS'}"
    return label


def section_block(title: str, note: str, styles: dict[str, ParagraphStyle]) -> list[Any]:
    header = flat_table(
        [[
            Paragraph(safe(title), styles["section_title"]),
            Paragraph(safe(note), styles["section_note"]),
        ]],
        [CONTENT_WIDTH - 82 * mm, 82 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, 0), 1.5, INK),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 4 * mm),
            ("LEFTPADDING", (1, 0), (1, 0), 10 * mm),
        ],
    )
    return [header]


def group_block(label: str, count: int, styles: dict[str, ParagraphStyle], unit: tuple[str, str] = ("oportunidade", "oportunidades")) -> list[Any]:
    header = flat_table(
        [[
            Paragraph(safe(label.upper()), styles["group_label"]),
            Paragraph(f"{count} {unit[0] if count == 1 else unit[1]}", styles["group_count"]),
        ]],
        [CONTENT_WIDTH - 60 * mm, 60 * mm],
        [
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 2.5 * mm),
        ],
    )
    return [Spacer(1, 10 * mm), header]


def month_groups(items: list[dict[str, Any]]) -> list[tuple[str, list[dict[str, Any]]]]:
    # Agrupar por mês de prazo: o creator lê a edição perguntando "o que fecha agora".
    buckets: list[tuple[str, list[dict[str, Any]]]] = []
    for item in items:
        deadline = item.get("applicationDeadline")
        if deadline:
            year, month, _ = deadline.split("-")
            label = f"Prazo em {MONTHS[int(month) - 1]} de {year}"
        else:
            label = "Sem prazo publicado"
        for existing_label, bucket in buckets:
            if existing_label == label:
                bucket.append(item)
                break
        else:
            buckets.append((label, [item]))
    return buckets


def source_groups(items: list[dict[str, Any]]) -> list[tuple[str, list[dict[str, Any]]]]:
    buckets: list[tuple[str, list[dict[str, Any]]]] = []
    for item in items:
        label = item["sourcePlatform"]
        for existing_label, bucket in buckets:
            if existing_label == label:
                bucket.append(item)
                break
        else:
            buckets.append((label, [item]))
    return buckets


def build_story(batch: dict[str, Any], styles: dict[str, ParagraphStyle]) -> list[Any]:
    approved = approved_open(batch)
    # Programa sai das seções de valor: não se ordena por quanto paga o que não paga.
    programs = sorted([o for o in approved if is_program(o)], key=sort_key)
    opportunities = [o for o in approved if not is_program(o)]
    confirmed = sorted([o for o in opportunities if group_key(o) == "confirmed"], key=sort_key)
    budget = sorted([o for o in opportunities if group_key(o) == "budget"], key=sort_key)
    unknown = sorted([o for o in opportunities if group_key(o) == "unknown"], key=sort_key)

    meta = (
        f"<font color=\"#17140F\">{cover_count_label(len(opportunities), 0)}</font>"
        "&nbsp;&nbsp;&nbsp;&nbsp;"
    )
    if programs:
        meta += f"{len(programs)} {'PROGRAMA' if len(programs) == 1 else 'PROGRAMAS'}&nbsp;&nbsp;&nbsp;&nbsp;"
    meta += safe(format_date(batch["reportDate"]))

    story: list[Any] = [
        Paragraph("data2content", styles["wordmark"]),
        Spacer(1, 52 * mm),
        Paragraph("Radar<br/>de publis", styles["cover_title"]),
        Spacer(1, 10 * mm),
        constrained([Paragraph(
            "Campanhas abertas nas plataformas que a Data2Content acompanha, conferidas "
            "uma a uma e organizadas por quanto pagam — para você ir direto à candidatura.",
            styles["cover_lead"],
        )], 128 * mm),
        Spacer(1, 12 * mm),
        Paragraph(meta, styles["cover_meta"]),
        Spacer(1, 46 * mm),
    ]

    guide = flat_table(
        [[
            Paragraph("COMO LER<br/>OS VALORES", styles["guide_label"]),
            constrained([Paragraph(
                "<b><font color=\"#17140F\">Cachê confirmado</font></b> é o que a fonte descreve como "
                "pagamento para cada creator. <b><font color=\"#17140F\">Orçamento da campanha</font></b> "
                "é o investimento total da marca e não diz quanto você vai receber. A candidatura e a "
                "negociação acontecem na plataforma de origem.",
                styles["body"],
            )], 116 * mm),
        ]],
        [36 * mm, CONTENT_WIDTH - 36 * mm],
        [
            ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
            ("TOPPADDING", (0, 0), (-1, 0), 7 * mm),
            ("RIGHTPADDING", (0, 0), (0, 0), 9 * mm),
        ],
    )
    story.extend([guide, PageBreak()])

    sections = [
        ("Cachê confirmado", "a fonte informa o pagamento por creator", confirmed, month_groups),
        ("Orçamento, comissão ou permuta", "não há cachê individual confirmado pela fonte", budget, month_groups),
        ("Valor a confirmar", "a chamada está aberta, o pagamento se confirma na plataforma", unknown, source_groups),
    ]

    for title, note, items, grouper in sections:
        if not items:
            continue
        if story and not isinstance(story[-1], PageBreak):
            story.append(PageBreak())
        count = len(items)
        unit = "oportunidade" if count == 1 else "oportunidades"
        story.extend(section_block(title, f"{count} {unit} · {note}", styles))
        for label, bucket in grouper(items):
            story.extend(group_block(label, len(bucket), styles))
            for opportunity in bucket:
                # Sem KeepTogether: o card é uma tabela de linha única e já é
                # indivisível. Envolvê-lo faz o reportlab superestimar a altura e
                # jogar um card por página.
                story.append(opportunity_card(opportunity, styles))

    if programs:
        if story and not isinstance(story[-1], PageBreak):
            story.append(PageBreak())
        count = len(programs)
        story.extend(section_block(
            "Programas e bancos de creators",
            f"{count} {'programa' if count == 1 else 'programas'} · não é publi: você se inscreve, "
            "entra numa lista e pode ser convidado depois",
            styles,
        ))
        story.extend(group_block("Inscrição aberta", count, styles, unit=("programa", "programas")))
        for opportunity in programs:
            story.append(opportunity_card(opportunity, styles))

    # fechamento: fontes e limites
    sources = batch.get("sources", [])

    def source_detail(item: dict[str, Any]) -> str:
        emitted = item["emittedOpportunities"]
        documents = item["discoveredDocuments"]
        # Fonte lida na tela não pode ser anunciada como "página pública verificada".
        if any(str(w).startswith("captura_manual") for w in (item.get("warnings") or [])):
            return (
                f"{emitted} {'campanha lida' if emitted == 1 else 'campanhas lidas'} à mão na tela do "
                "aplicativo, na conta de um creator. Esta plataforma não publica campanhas em página "
                "pública, e a lista reflete o que ela selecionou para aquele perfil."
            )
        return (
            f"{emitted} {'oportunidade extraída' if emitted == 1 else 'oportunidades extraídas'} de "
            f"{documents} {'página pública verificada' if documents == 1 else 'páginas públicas verificadas'}."
        )

    story.append(PageBreak())
    story.extend(section_block(
        "Fontes e limites",
        f"{len(sources)} {'fonte monitorada' if len(sources) == 1 else 'fontes monitoradas'} nesta edição",
        styles,
    ))
    story.append(Spacer(1, 8 * mm))
    story.append(flat_table(
        [
            [
                Paragraph(safe(item["sourcePlatform"]), styles["source_name"]),
                Paragraph(safe(source_detail(item)), styles["source_detail"]),
            ]
            for item in sources
        ],
        [42 * mm, CONTENT_WIDTH - 42 * mm],
        [
            ("RIGHTPADDING", (0, 0), (0, -1), 9 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -2), 5 * mm),
        ],
    ))

    limits = flat_table(
        [[
            Paragraph("O QUE NÃO<br/>ESTÁ AQUI", styles["guide_label"]),
            constrained([
                Paragraph(
                    "A Data2Content acompanha o que as plataformas tornam visível. Campanhas enviadas por "
                    "convite direto a um creator específico, ou já encerradas, não aparecem neste relatório. "
                    "Nas fontes lidas dentro do aplicativo, a lista é a que a plataforma selecionou para um "
                    "perfil — não o inventário completo dela.",
                    styles["body"],
                ),
                Spacer(1, 6 * mm),
                Paragraph(
                    "Este material é informativo. A Data2Content não representa as marcas ou plataformas citadas, "
                    "não garante seleção e não intermedeia pagamentos. Links e condições podem mudar após a verificação.",
                    styles["footnote"],
                ),
            ], 116 * mm),
        ]],
        [36 * mm, CONTENT_WIDTH - 36 * mm],
        [
            ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
            ("TOPPADDING", (0, 0), (-1, 0), 7 * mm),
            ("RIGHTPADDING", (0, 0), (0, 0), 9 * mm),
        ],
    )
    story.extend([Spacer(1, 14 * mm), limits])
    return story


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera o PDF do Radar de Oportunidades Públicas.")
    parser.add_argument("--input", required=True, help="Lote reviewed.json")
    parser.add_argument("--output", required=True, help="Caminho do PDF final")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    with input_path.open("r", encoding="utf-8") as handle:
        batch = json.load(handle)

    opportunities = approved_open(batch)
    if not opportunities:
        raise SystemExit("Nenhuma oportunidade aberta e aprovada para gerar o relatório.")
    pending = [item for item in batch.get("opportunities", []) if item.get("review", {}).get("status") == "pending"]
    if pending:
        raise SystemExit(f"Ainda há {len(pending)} oportunidade(s) pendente(s) de revisão.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = RadarDocTemplate(
        str(output_path),
        edition_label=format_date(batch["reportDate"]),
        title=f"Radar Data2Content - {batch['reportDate']}",
        author="Data2Content",
        subject="Oportunidades públicas para creators",
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=17 * mm,
        bottomMargin=18 * mm,
    )
    doc.build(build_story(batch, build_styles()))
    print(str(output_path))


if __name__ == "__main__":
    main()
