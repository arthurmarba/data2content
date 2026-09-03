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
from reportlab.lib.enums import TA_CENTER, TA_LEFT
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
RULE = colors.HexColor("#E4DED4")
NEUTRAL = colors.HexColor("#F7F4F0")
WHITE = colors.white

UTC = timezone.utc
SAO_PAULO = ZoneInfo("America/Sao_Paulo")

CONTENT_WIDTH = 176 * mm
CARD_PADDING = 11 * mm
CARD_INNER = CONTENT_WIDTH - (2 * CARD_PADDING)


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
    def __init__(self, filename: str, **kwargs: Any):
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
            canvas.setFont(FONT, 8.5)
            canvas.setFillColor(MUTED)
            canvas.drawString(17 * mm, 11 * mm, "data2content  ·  radar de publis")
            canvas.drawRightString(width - 17 * mm, 11 * mm, f"{doc.page:02d}")
        canvas.restoreState()


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "wordmark": ParagraphStyle(
            "wordmark", parent=base["Normal"], fontName=FONT_BOLD, fontSize=13,
            leading=15, textColor=INK,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"], fontName=FONT_BOLD, fontSize=40,
            leading=41, textColor=INK, alignment=TA_LEFT,
        ),
        "cover_lead": ParagraphStyle(
            "cover_lead", parent=base["Normal"], fontName=FONT, fontSize=13.5,
            leading=19.5, textColor=TEXT,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta", parent=base["Normal"], fontName=FONT_BOLD, fontSize=10,
            leading=14, textColor=MUTED,
        ),
        "section_title": ParagraphStyle(
            "section_title", parent=base["Heading1"], fontName=FONT_BOLD, fontSize=17,
            leading=20, textColor=INK,
        ),
        "section_note": ParagraphStyle(
            "section_note", parent=base["Normal"], fontName=FONT, fontSize=10.5,
            leading=15, textColor=MUTED,
        ),
        "source": ParagraphStyle(
            "source", parent=base["Normal"], fontName=FONT_BOLD, fontSize=8.5,
            leading=11, textColor=MUTED,
        ),
        "deadline": ParagraphStyle(
            "deadline", parent=base["Normal"], fontName=FONT_BOLD, fontSize=8.5,
            leading=11, textColor=PINK, alignment=TA_CENTER,
        ),
        "card_title": ParagraphStyle(
            "card_title", parent=base["Heading2"], fontName=FONT_BOLD, fontSize=16,
            leading=19, textColor=INK,
        ),
        "money": ParagraphStyle(
            "money", parent=base["Normal"], fontName=FONT_BOLD, fontSize=25,
            leading=27, textColor=INK,
        ),
        "money_note": ParagraphStyle(
            "money_note", parent=base["Normal"], fontName=FONT, fontSize=10,
            leading=13, textColor=MUTED,
        ),
        "label": ParagraphStyle(
            "label", parent=base["Normal"], fontName=FONT_BOLD, fontSize=8,
            leading=10, textColor=MUTED,
        ),
        "value": ParagraphStyle(
            "value", parent=base["Normal"], fontName=FONT_BOLD, fontSize=10.5,
            leading=13.5, textColor=INK,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName=FONT, fontSize=10.5,
            leading=15, textColor=TEXT,
        ),
        "cta": ParagraphStyle(
            "cta", parent=base["Normal"], fontName=FONT_BOLD, fontSize=11,
            leading=14, textColor=WHITE, alignment=TA_CENTER,
        ),
        "warning": ParagraphStyle(
            "warning", parent=base["BodyText"], fontName=FONT_BOLD, fontSize=10,
            leading=14, textColor=TEXT,
        ),
        "footnote": ParagraphStyle(
            "footnote", parent=base["Normal"], fontName=FONT, fontSize=8.5,
            leading=11.5, textColor=MUTED,
        ),
    }


def fact_column(label: str, value: str, styles: dict[str, ParagraphStyle]) -> list[Any]:
    return [
        Paragraph(safe(label.upper()), styles["label"]),
        Spacer(1, 3),
        Paragraph(safe(value), styles["value"]),
    ]


def opportunity_card(opportunity: dict[str, Any], styles: dict[str, ParagraphStyle]) -> Table:
    money, money_note = compensation_label(opportunity)
    parsed = extract_from_summary(opportunity)
    deadline = format_date(opportunity.get("applicationDeadline"))
    note = editorial_note(opportunity)
    requirements = real_requirements(opportunity)
    deliverables = readable_deliverables(opportunity)

    program = is_program(opportunity)

    # cabeçalho: fonte à esquerda, prazo à direita.
    # Programa raramente tem data — o que importa é se a inscrição está aberta.
    if program:
        deadline_label = f"INSCRIÇÃO ATÉ {deadline}" if deadline else "INSCRIÇÃO ABERTA"
    else:
        deadline_label = f"ATÉ {deadline}" if deadline else "SEM PRAZO PUBLICADO"
    header = Table(
        [[
            Paragraph(safe(opportunity["sourcePlatform"].upper()), styles["source"]),
            Paragraph(safe(deadline_label), styles["deadline"]),
        ]],
        colWidths=[CARD_INNER - 46 * mm, 46 * mm],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    content: list[Any] = [
        header,
        Spacer(1, 6),
        Paragraph(safe(shorten(opportunity["title"], 78)), styles["card_title"]),
        Spacer(1, 9),
    ]

    if program:
        # No lugar do valor: o que a inscrição te dá.
        content.extend([
            Paragraph("O QUE VOCÊ GANHA ENTRANDO", styles["label"]),
            Spacer(1, 4),
            Paragraph(safe(program_benefit(opportunity)), styles["body"]),
            Spacer(1, 10),
        ])
    else:
        content.extend([
            Paragraph(safe(money), styles["money"]),
            Spacer(1, 1),
            Paragraph(safe(money_note), styles["money_note"]),
            Spacer(1, 10),
        ])

    # linha de fatos: só o que existe de verdade
    facts: list[tuple[str, str]] = []
    territories = opportunity.get("territories") or []
    if territories:
        facts.append(("Território", " · ".join(territories[:3])))
    formats = parsed.get("formats") or " · ".join(opportunity.get("formats") or [])
    if formats:
        facts.append(("Formato", shorten(formats, 40)))
    platforms = parsed.get("platforms") or " · ".join(opportunity.get("platforms") or [])
    if platforms:
        facts.append(("Onde publicar", shorten(platforms, 40)))
    if parsed.get("slots"):
        facts.append(("Vagas", parsed["slots"]))

    if facts:
        facts = facts[:3]
        column_width = CARD_INNER / len(facts)
        row = [fact_column(label, value, styles) for label, value in facts]
        facts_table = Table([row], colWidths=[column_width] * len(facts))
        facts_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("LEFTPADDING", (1, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (-1, 0), (-1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        content.extend([facts_table, Spacer(1, 11)])

    if deliverables:
        content.extend([
            Paragraph("VOCÊ ENTREGA", styles["label"]),
            Spacer(1, 4),
            Paragraph(safe(shorten(deliverables[0], 125)), styles["body"]),
        ])
        if len(deliverables) > 1:
            content.append(Paragraph(safe(shorten(deliverables[1], 125)), styles["body"]))
        content.append(Spacer(1, 9))

    if requirements:
        content.extend([
            Paragraph("PARA PARTICIPAR", styles["label"]),
            Spacer(1, 4),
            Paragraph(safe(" · ".join(requirements)), styles["body"]),
            Spacer(1, 9),
        ])

    # No programa o resumo já virou "o que você ganha entrando".
    if note and not deliverables and not program:
        content.extend([Paragraph(safe(note), styles["body"]), Spacer(1, 9)])

    if program:
        # Aviso estrutural, não rodapé: é a diferença entre o programa e a publi
        # de R$ 480 que aparece na mesma edição.
        content.extend([
            Paragraph("Entrar na lista não garante campanha nem pagamento.", styles["warning"]),
            Spacer(1, 9),
        ])

    cta_label = "VER E CANDIDATAR-SE"
    if program:
        cta_label = "FAZER MINHA INSCRIÇÃO"
    elif opportunity["sourcePlatform"].lower() == "mis":
        # Não há página web da campanha: ela vive dentro do aplicativo.
        cta_label = "ABRIR NO APP DO MIS"
    elif opportunity["sourcePlatform"].lower() == "creator ads":
        # Na Creator Ads não há resposta na hora: entra-se numa seleção.
        cta_label = "CADASTRAR-SE NA SELEÇÃO"
    elif opportunity["sourcePlatform"].lower() == "squid":
        cta_label = "ABRIR CANDIDATURA NA SQUID"
    elif opportunity["sourcePlatform"].lower() == "99freelas":
        cta_label = "ENVIAR PROPOSTA NO 99FREELAS"
    cta = Table(
        [[Paragraph(
            f"<link href=\"{safe(opportunity['applicationUrl'])}\" color=\"#FFFFFF\">{cta_label}  &gt;</link>",
            styles["cta"],
        )]],
        colWidths=[CARD_INNER],
        cornerRadii=[6, 6, 6, 6],
    )
    cta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PINK),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))

    content.extend([
        cta,
        Spacer(1, 7),
        Paragraph(
            f"Verificado em {safe(format_date(opportunity.get('lastVerifiedAt')))} · "
            f"<link href=\"{safe(opportunity['sourceUrl'])}\" color=\"#8A8177\"><u>ver na fonte</u></link>",
            styles["footnote"],
        ),
    ])

    wrapper = Table([[content]], colWidths=[CONTENT_WIDTH], cornerRadii=[10, 10, 10, 10])
    wrapper.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), CARD_PADDING),
        ("RIGHTPADDING", (0, 0), (-1, -1), CARD_PADDING),
        ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
    ]))
    return wrapper


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


def section_block(
    title: str,
    note: str,
    count: int,
    styles: dict[str, ParagraphStyle],
    unit: tuple[str, str] = ("oportunidade", "oportunidades"),
) -> list[Any]:
    return [
        Paragraph(safe(title), styles["section_title"]),
        Spacer(1, 4),
        Paragraph(
            f"{count} {unit[0] if count == 1 else unit[1]} · {safe(note)}",
            styles["section_note"],
        ),
        Spacer(1, 4 * mm),
    ]


def build_story(batch: dict[str, Any], styles: dict[str, ParagraphStyle]) -> list[Any]:
    approved = approved_open(batch)
    # Programa sai das seções de valor: não se ordena por quanto paga o que não paga.
    programs = sorted([o for o in approved if is_program(o)], key=sort_key)
    opportunities = [o for o in approved if not is_program(o)]
    confirmed = sorted([o for o in opportunities if group_key(o) == "confirmed"], key=sort_key)
    budget = sorted([o for o in opportunities if group_key(o) == "budget"], key=sort_key)
    unknown = sorted([o for o in opportunities if group_key(o) == "unknown"], key=sort_key)

    story: list[Any] = [
        Paragraph("data2content", styles["wordmark"]),
        Spacer(1, 34 * mm),
        Paragraph("Radar<br/>de publis", styles["cover_title"]),
        Spacer(1, 9 * mm),
        Paragraph(
            "Campanhas abertas nas plataformas que a Data2Content acompanha, conferidas "
            "uma a uma e organizadas por quanto pagam — para você ir direto à candidatura.",
            styles["cover_lead"],
        ),
        Spacer(1, 9 * mm),
        Paragraph(
            cover_count_label(len(opportunities), len(programs))
            + f"  ·  {safe(format_date(batch['reportDate']))}",
            styles["cover_meta"],
        ),
        Spacer(1, 30 * mm),
    ]

    guide = Table(
        [[[
            Paragraph("COMO LER OS VALORES", styles["label"]),
            Spacer(1, 7),
            Paragraph(
                "<b>Cachê confirmado</b> é o que a fonte descreve como pagamento para cada creator. "
                "<b>Orçamento da campanha</b> é o investimento total da marca e não diz quanto você vai receber. "
                "A candidatura e a negociação acontecem na plataforma de origem.",
                styles["body"],
            ),
        ]]],
        colWidths=[CONTENT_WIDTH],
        cornerRadii=[10, 10, 10, 10],
    )
    guide.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NEUTRAL),
        ("LEFTPADDING", (0, 0), (-1, -1), 9 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 7 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7 * mm),
    ]))
    story.extend([guide, PageBreak()])

    sections = [
        ("Cachê confirmado", "a fonte informa o pagamento por creator", confirmed),
        (
            "Orçamento, comissão ou permuta",
            "não há cachê individual confirmado pela fonte",
            budget,
        ),
        ("Valor a confirmar", "a chamada está aberta, o pagamento se confirma na plataforma", unknown),
    ]

    for title, note, items in sections:
        if not items:
            continue
        if story and not isinstance(story[-1], PageBreak):
            story.append(Spacer(1, 5 * mm))
        story.extend(section_block(title, note, len(items), styles))
        for opportunity in items:
            # Sem KeepTogether: o card é uma tabela de linha única e já é
            # indivisível. Envolvê-lo faz o reportlab superestimar a altura e
            # jogar um card por página.
            story.extend([opportunity_card(opportunity, styles), Spacer(1, 4 * mm)])

    if programs:
        if story and not isinstance(story[-1], PageBreak):
            story.append(Spacer(1, 5 * mm))
        story.extend(section_block(
            "Programas e bancos de creators",
            "não é publi: você se inscreve, entra numa lista e pode ser convidado depois",
            len(programs),
            styles,
            unit=("programa", "programas"),
        ))
        for opportunity in programs:
            story.extend([opportunity_card(opportunity, styles), Spacer(1, 4 * mm)])

    # fechamento: fontes e limites
    sources = batch.get("sources", [])
    def source_line(item: dict[str, Any]) -> str:
        emitted = item["emittedOpportunities"]
        documents = item["discoveredDocuments"]
        # Fonte lida na tela não pode ser anunciada como "página pública verificada".
        if any(str(w).startswith("captura_manual") for w in (item.get("warnings") or [])):
            return (
                f"<b>{safe(item['sourcePlatform'])}</b> — "
                f"{emitted} {'campanha lida' if emitted == 1 else 'campanhas lidas'} à mão na tela do "
                "aplicativo, na conta de um creator. Esta plataforma não publica campanhas em página "
                "pública, e a lista reflete o que ela selecionou para aquele perfil."
            )
        return (
            f"<b>{safe(item['sourcePlatform'])}</b> — "
            f"{emitted} {'oportunidade extraída' if emitted == 1 else 'oportunidades extraídas'} de "
            f"{documents} {'página pública verificada' if documents == 1 else 'páginas públicas verificadas'}."
        )

    source_lines = [source_line(item) for item in sources]
    story.extend([
        PageBreak(),
        Paragraph("Fontes e limites", styles["section_title"]),
        Spacer(1, 4),
        Paragraph(
            f"{len(sources)} {'fonte monitorada' if len(sources) == 1 else 'fontes monitoradas'} nesta edição",
            styles["section_note"],
        ),
        Spacer(1, 7 * mm),
        Paragraph("<br/>".join(source_lines), styles["body"]),
        Spacer(1, 9 * mm),
    ])

    limits = Table(
        [[[
            Paragraph("O QUE NÃO ESTÁ AQUI", styles["label"]),
            Spacer(1, 7),
            Paragraph(
                "A Data2Content acompanha o que as plataformas tornam visível. Campanhas enviadas por "
                "convite direto a um creator específico, ou já encerradas, não aparecem neste relatório. "
                "Nas fontes lidas dentro do aplicativo, a lista é a que a plataforma selecionou para um "
                "perfil — não o inventário completo dela.",
                styles["body"],
            ),
            Spacer(1, 10),
            Paragraph(
                "Este material é informativo. A Data2Content não representa as marcas ou plataformas citadas, "
                "não garante seleção e não intermedeia pagamentos. Links e condições podem mudar após a verificação.",
                styles["footnote"],
            ),
        ]]],
        colWidths=[CONTENT_WIDTH],
        cornerRadii=[10, 10, 10, 10],
    )
    limits.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NEUTRAL),
        ("LEFTPADDING", (0, 0), (-1, -1), 9 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 7 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7 * mm),
    ]))
    story.append(limits)
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
