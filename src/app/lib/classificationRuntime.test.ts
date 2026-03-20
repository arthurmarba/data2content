import {
  buildMetricClassificationUpdate,
  normalizeClassificationResponse,
} from "@/app/lib/classificationRuntime";

describe("classification runtime", () => {
  it("normalizes legacy and V2 fields from AI JSON payloads", () => {
    const normalized = normalizeClassificationResponse({
      Formato: ["Reel"],
      Proposta: ["Dicas"],
      Contexto: { principal: "Moda/Estilo" },
      Tom: ["Educacional/Informativo"],
      Referências: ["geography.city"],
      "Objetivo principal": ["Ensinar"],
      "Forma narrativa": ["Tutorial/Passo a Passo"],
      Sinais: [["Patrocinado/Publi"], { extra: "CTA de Comentario" }],
      Postura: ["Critico"],
      "Tipo de Prova": ["Demonstracao"],
      "Modo Comercial": ["Parceria Paga"],
    });

    expect(normalized).toEqual({
      format: ["Reel"],
      proposal: ["Dicas"],
      context: ["Moda/Estilo"],
      tone: ["Educacional/Informativo"],
      references: ["geography.city"],
      contentIntent: ["Ensinar"],
      narrativeForm: ["Tutorial/Passo a Passo"],
      contentSignals: ["Patrocinado/Publi", "CTA de Comentario"],
      stance: ["Critico"],
      proofStyle: ["Demonstracao"],
      commercialMode: ["Parceria Paga"],
    });
  });

  it("derives V2 fallback fields and deterministic signals from legacy classifications", () => {
    const update = buildMetricClassificationUpdate(
      {
        source: "manual",
        type: "REEL",
        description: "Comenta aqui e salva esse post. Link na bio. #publi",
      },
      {
        format: ["Reel"],
        proposal: ["Dicas", "Publi/Divulgação", "Chamada"],
        context: ["Moda/Estilo"],
        tone: ["Promocional/Comercial"],
        references: ["geography", "geography.city"],
        contentIntent: [],
        narrativeForm: [],
        contentSignals: [],
        stance: [],
        proofStyle: [],
        commercialMode: [],
      }
    );

    expect(update).toEqual({
      format: ["reel"],
      proposal: ["tips"],
      context: ["fashion_style"],
      tone: ["promotional"],
      references: ["city"],
      contentIntent: ["teach", "convert"],
      narrativeForm: ["tutorial"],
      contentSignals: ["sponsored", "comment_cta", "save_cta", "link_in_bio_cta"],
      stance: [],
      proofStyle: [],
      commercialMode: ["paid_partnership"],
    });
  });

  it("prefers explicit V2 AI output while keeping deterministic signal extraction and api format override", () => {
    const update = buildMetricClassificationUpdate(
      {
        source: "api",
        type: "IMAGE",
        description: "Sorteio especial, comenta aqui para participar.",
      },
      {
        format: ["Reel"],
        proposal: ["Review"],
        context: ["Tecnologia/Digital"],
        tone: ["Neutro/Descritivo"],
        references: [],
        contentIntent: ["Converter"],
        narrativeForm: ["Review"],
        contentSignals: ["Sorteio"],
        stance: ["Questionando"],
        proofStyle: ["Opiniao"],
        commercialMode: ["Oferta/Desconto"],
      }
    );

    expect(update).toEqual({
      format: ["photo"],
      proposal: ["review"],
      context: ["technology_digital"],
      tone: ["neutral"],
      references: [],
      contentIntent: ["convert"],
      narrativeForm: ["review"],
      contentSignals: ["giveaway", "comment_cta"],
      stance: ["questioning"],
      proofStyle: ["opinion"],
      commercialMode: ["discount_offer"],
    });
  });

  it("derives strategic fields from description even when legacy proposal and tone are empty", () => {
    const update = buildMetricClassificationUpdate(
      {
        source: "api",
        type: "REEL",
        description: "Revelando nosso segredo, amigas. Minha historia real com antes e depois no link da bio com cupom.",
      },
      {
        format: [],
        proposal: [],
        context: ["Relacionamentos/Família"],
        tone: [],
        references: [],
        contentIntent: [],
        narrativeForm: [],
        contentSignals: [],
        stance: [],
        proofStyle: [],
        commercialMode: [],
      }
    );

    expect(update).toEqual({
      format: ["reel"],
      proposal: [],
      context: ["relationships_family"],
      tone: [],
      references: [],
      contentIntent: ["convert", "connect"],
      narrativeForm: [],
      contentSignals: ["link_in_bio_cta", "promo_offer"],
      stance: ["testimonial"],
      proofStyle: ["before_after", "personal_story"],
      commercialMode: ["discount_offer"],
    });
  });

  it("infers tutorial intent and narrative from description patterns without legacy proposal", () => {
    const update = buildMetricClassificationUpdate(
      {
        source: "api",
        type: "REEL",
        description: "3 dicas para organizar sua rotina: passo a passo simples e checklist do que fazer.",
      },
      {
        format: [],
        proposal: [],
        context: [],
        tone: [],
        references: [],
        contentIntent: [],
        narrativeForm: [],
        contentSignals: [],
        stance: [],
        proofStyle: [],
        commercialMode: [],
      }
    );

    expect(update).toEqual({
      format: ["reel"],
      proposal: [],
      context: [],
      tone: [],
      references: [],
      contentIntent: ["teach", "connect"],
      narrativeForm: ["tutorial"],
      contentSignals: [],
      stance: [],
      proofStyle: ["list_based", "demonstration"],
      commercialMode: [],
    });
  });
});
