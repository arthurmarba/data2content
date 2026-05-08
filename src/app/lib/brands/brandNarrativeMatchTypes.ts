export type BrandNarrativeMatchInput = {
  decision?: {
    contextId?: string | null;
    proposalId?: string | null;
    toneId?: string | null;
    referenceId?: string | null;
    intentId?: string | null;
    narrativeId?: string | null;
    formatId?: string | null;
    durationId?: string | null;
    dayId?: string | null;
    hourId?: string | null;
    themeId?: string | null;
    pautaId?: string | null;
  };
  pauta?: {
    title?: string | null;
    description?: string | null;
    reason?: string | null;
    theme?: string | null;
    keywords?: string[];
  };
  categories?: {
    context?: string[];
    proposal?: string[];
    tone?: string[];
    reference?: string[];
    contentIntent?: string[];
    narrativeForm?: string[];
    contentSignals?: string[];
    stance?: string[];
    proofStyle?: string[];
    commercialMode?: string[];
  };
  limit?: number;
};

export type BrandNarrativeMatchLevel = 'alto' | 'medio' | 'baixo';

export type BrandNarrativeMatchResult = {
  brandId: string;
  brandName: string;
  slug: string;
  category: string[];
  subcategories?: string[];
  matchScore: number;
  matchLevel: BrandNarrativeMatchLevel;
  confidenceScore: number;
  matchedSignals: string[];
  rationale: string;
  insertionAngle: string;
  suggestedDeliverables: string[];
  suggestedApproachMessage: string;
  disclaimer: string;
};
