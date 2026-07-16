/**
 * Central catalog of analytics events used across Data2Content.
 * Extend this catalog when introducing new events so payloads remain consistent.
 */

type StringMaybe = string | null | undefined;
type NumberMaybe = number | null | undefined;

type EventSpec<Payload extends Record<string, any>> = {
  description: string;
  group:
    | 'funnel'
    | 'email'
    | 'ai'
    | 'monetization'
    | 'affiliates'
    | 'navigation'
    | 'ops'
    | 'other';
  payload: Payload;
};

export const analyticsEventCatalog = {
  button_click: {
    group: 'navigation',
    description: 'Visitor clicked an interactive control anywhere in the platform.',
    payload: {
      button_name: '' as string,
      button_section: '' as string,
      page_path: '' as string,
      destination: '' as StringMaybe,
      element_type: '' as ('button' | 'link' | 'input' | 'role_button'),
    },
  },
  media_kit_viewed: {
    group: 'funnel',
    description: 'Public media kit viewed by a visitor/brand.',
    payload: {
      creator_id: '' as StringMaybe,
      media_kit_id: '' as StringMaybe,
      referrer: '' as StringMaybe,
      utm_source: '' as StringMaybe,
      utm_medium: '' as StringMaybe,
      utm_campaign: '' as StringMaybe,
      utm_content: '' as StringMaybe,
      utm_term: '' as StringMaybe,
    },
  },
  proposal_submitted: {
    group: 'funnel',
    description: 'Brand submitted a proposal through the media kit form.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      budget: 0 as NumberMaybe,
      budget_intent: '' as ('provided' | 'requested' | null | undefined),
      deliverables_count: 0 as NumberMaybe,
      timeline_days: 0 as NumberMaybe,
      utm_source: '' as StringMaybe,
      utm_medium: '' as StringMaybe,
      utm_campaign: '' as StringMaybe,
      utm_content: '' as StringMaybe,
      utm_term: '' as StringMaybe,
    },
  },
  proposal_received: {
    group: 'funnel',
    description: 'Proposal successfully created and visible on the creator dashboard.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      source: '' as ('media_kit' | 'campaign_brief' | 'other' | null | undefined),
    },
  },
  proposal_opened: {
    group: 'funnel',
    description: 'Creator opened a proposal inside the dashboard.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
    },
  },
  ai_analysis_started: {
    group: 'ai',
    description: 'Creator triggered AI proposal analysis.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
    },
  },
  ai_suggestion_generated: {
    group: 'ai',
    description: 'AI returned a recommendation for a proposal.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      suggestion_type: '' as (
        | 'aceitar'
        | 'ajustar'
        | 'aceitar_com_extra'
        | 'ajustar_escopo'
        | 'coletar_orcamento'
        | null
        | undefined
      ),
      suggested_value: 0 as NumberMaybe,
      confidence: 0 as NumberMaybe,
      fallback_used: null as boolean | null | undefined,
    },
  },
  ai_analysis_failed: {
    group: 'ai',
    description: 'AI proposal analysis failed at some stage.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      stage: '' as ('context' | 'engine' | 'llm' | 'parse' | null | undefined),
    },
  },
  email_draft_generated: {
    group: 'email',
    description: 'Platform produced an email draft for the proposal response.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      subject_length: 0 as NumberMaybe,
      body_length: 0 as NumberMaybe,
    },
  },
  email_sent_via_platform: {
    group: 'email',
    description: 'Creator sent an email response through the platform (north star).',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
    },
  },
  proposal_status_changed: {
    group: 'funnel',
    description: 'Proposal status transitioned to a new state.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      from_status: '' as StringMaybe,
      to_status: '' as StringMaybe,
    },
  },
  copy_media_kit_link: {
    group: 'navigation',
    description: 'Visitor copied the public media kit link.',
    payload: {
      creator_id: '' as StringMaybe,
      media_kit_id: '' as StringMaybe,
      origin: '' as StringMaybe,
    },
  },
  dashboard_cta_clicked: {
    group: 'navigation',
    description: 'User engaged with a primary dashboard CTA.',
    payload: {
      creator_id: '' as StringMaybe,
      target: '' as (
        | 'connect_ig'
        | 'create_media_kit'
        | 'open_proposals'
        | 'analyze_with_ai'
        | 'copy_kit_link'
        | 'view_as_brand'
        | 'edit_kit'
        | 'activate_pro'
        | null
        | undefined
      ),
      surface: '' as ('flow_checklist' | 'proposals_block' | 'media_kit_block' | 'upsell_block' | 'other' | null | undefined),
      context: '' as StringMaybe,
    },
  },
  paywall_viewed: {
    group: 'monetization',
    description: 'User encountered a paywall experience.',
    payload: {
      creator_id: '' as StringMaybe,
      context: '' as (
        | 'planner'
        | 'planning'
        | 'discover'
        | 'whatsapp_ai'
        | 'reply_email'
        | 'ai_analysis'
        | 'calculator'
        | 'mentoria'
        | 'media_kit'
        | 'publis'
        | 'other'
        | null
        | undefined
      ),
      plan: '' as StringMaybe,
    },
  },
  planning_viewed: {
    group: 'navigation',
    description: 'Creator opened the planning experience inside the dashboard.',
    payload: {
      creator_id: '' as StringMaybe,
      surface: '' as ('planner_page' | 'planner_demo' | 'other' | null | undefined),
    },
  },
  planning_charts_objective_changed: {
    group: 'navigation',
    description: 'Creator changed objective mode in planning charts.',
    payload: {
      creator_id: '' as StringMaybe,
      from_objective: '' as ('reach' | 'engagement' | 'leads' | null | undefined),
      to_objective: '' as ('reach' | 'engagement' | 'leads' | null | undefined),
      time_period: '' as StringMaybe,
    },
  },
  planning_charts_action_clicked: {
    group: 'navigation',
    description: 'Creator clicked one recommendation action in planning charts.',
    payload: {
      creator_id: '' as StringMaybe,
      action_id: '' as StringMaybe,
      objective_mode: '' as ('reach' | 'engagement' | 'leads' | null | undefined),
      confidence: '' as ('high' | 'medium' | 'low' | null | undefined),
      time_period: '' as StringMaybe,
    },
  },
  planning_charts_go_to_planner_clicked: {
    group: 'navigation',
    description: 'Creator clicked CTA to open planner from planning charts.',
    payload: {
      creator_id: '' as StringMaybe,
      source: '' as ('recommendations_card' | 'recommendation_drawer' | null | undefined),
      objective_mode: '' as ('reach' | 'engagement' | 'leads' | null | undefined),
      time_period: '' as StringMaybe,
    },
  },
  planner_plan_generated: {
    group: 'ai',
    description: 'Creator triggered generation of planner slots or roteiros.',
    payload: {
      creator_id: '' as StringMaybe,
      day_of_week: 0 as NumberMaybe,
      block_start_hour: 0 as NumberMaybe,
      source: '' as StringMaybe,
    },
  },
  post_creation_trial_connect_clicked: {
    group: 'funnel',
    description: 'Visitor clicked the Instagram trial CTA for the post creation board.',
    payload: {
      creator_id: '' as StringMaybe,
      source: '' as StringMaybe,
      account_state: '' as StringMaybe,
      instagram_connected: null as boolean | null | undefined,
      acceptedLegal: null as boolean | null | undefined,
    },
  },
  post_creation_trial_started: {
    group: 'funnel',
    description: 'Temporary or registered user started the post creation trial.',
    payload: {
      creator_id: '' as StringMaybe,
      source: '' as StringMaybe,
      account_state: '' as StringMaybe,
      instagram_connected: null as boolean | null | undefined,
    },
  },
  post_creation_instagram_connect_started: {
    group: 'funnel',
    description: 'User was sent to Meta/Facebook authorization from the post creation trial.',
    payload: {
      creator_id: '' as StringMaybe,
      source: '' as StringMaybe,
      account_state: '' as StringMaybe,
      instagram_connected: null as boolean | null | undefined,
    },
  },
  post_creation_instagram_connect_failed: {
    group: 'funnel',
    description: 'Instagram connection failed while entering the post creation trial.',
    payload: {
      creator_id: '' as StringMaybe,
      source: '' as StringMaybe,
      account_state: '' as StringMaybe,
      instagram_connected: null as boolean | null | undefined,
      message: '' as StringMaybe,
    },
  },
  post_creation_account_gate_opened: {
    group: 'funnel',
    description: 'Pre-signup user hit the account creation gate in the post creation board.',
    payload: {
      creator_id: '' as StringMaybe,
      source: '' as StringMaybe,
      account_state: '' as StringMaybe,
      instagram_connected: null as boolean | null | undefined,
    },
  },
  post_creation_paywall_opened: {
    group: 'monetization',
    description: 'Registered user hit the subscription gate in the post creation board.',
    payload: {
      creator_id: '' as StringMaybe,
      source: '' as StringMaybe,
      account_state: '' as StringMaybe,
      instagram_connected: null as boolean | null | undefined,
    },
  },
  post_creation_checkpoint_selected: {
    group: 'funnel',
    description: 'Creator selected one checkpoint option inside the unified post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      step: '' as ('window' | 'proposal' | 'context' | 'tone' | 'theme' | null | undefined),
      option_id: '' as StringMaybe,
      option_label: '' as StringMaybe,
      recommended_selected: null as boolean | null | undefined,
      stage_before: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_idea_selected: {
    group: 'funnel',
    description: 'Creator selected one resulting idea inside the unified post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      idea_id: '' as StringMaybe,
      lane: '' as ('recommended' | 'safe' | 'bold' | 'practical' | null | undefined),
      source: '' as ('historical_pattern' | 'ai_idea' | 'saved_idea' | 'manual' | null | undefined),
      confidence: 0 as NumberMaybe,
      evidence_count: 0 as NumberMaybe,
      path_key: '' as StringMaybe,
      window_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      context_id: '' as StringMaybe,
      tone_id: '' as StringMaybe,
      theme_id: '' as StringMaybe,
      format_id: '' as StringMaybe,
      narrative_id: '' as StringMaybe,
      recommended_selected: null as boolean | null | undefined,
      stage_before: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_blueprint_activated: {
    group: 'funnel',
    description: 'Creator activated the recommended blueprint from the unified post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      blueprint_title: '' as StringMaybe,
      source: '' as ('recommended_cta' | 'idea_selection' | null | undefined),
      stage_before: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_blueprint_adjusted: {
    group: 'funnel',
    description: 'Creator adjusted the blueprint direction inside the unified post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      blueprint_title: '' as StringMaybe,
      source: '' as ('simplify' | 'direct' | 'question_cta' | 'rotate_narrative' | 'reset' | null | undefined),
      stage_before: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_blueprint_script_opened: {
    group: 'funnel',
    description: 'Creator opened an existing script already linked to the active blueprint.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      script_id: '' as StringMaybe,
      slot_id: '' as StringMaybe,
      script_status: '' as ('generated' | 'linked' | 'published' | null | undefined),
    },
  },
  post_creation_blueprint_script_started: {
    group: 'ai',
    description: 'Creator triggered script generation from the blueprint card.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      blueprint_title: '' as StringMaybe,
      slot_id: '' as StringMaybe,
      has_slot_link: null as boolean | null | undefined,
    },
  },
  post_creation_blueprint_script_succeeded: {
    group: 'ai',
    description: 'Blueprint successfully generated a script inside the unified funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      script_id: '' as StringMaybe,
      slot_id: '' as StringMaybe,
      linked_to_slot: null as boolean | null | undefined,
    },
  },
  post_creation_blueprint_script_failed: {
    group: 'ai',
    description: 'Blueprint script generation failed inside the unified funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      slot_id: '' as StringMaybe,
      message: '' as StringMaybe,
    },
  },
  post_creation_slot_saved: {
    group: 'funnel',
    description: 'Creator saved a planner slot while progressing through the unified post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      slot_id: '' as StringMaybe,
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_script_opened: {
    group: 'funnel',
    description: 'Creator opened a script from inside the unified post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      script_id: '' as StringMaybe,
      script_status: '' as ('generated' | 'linked' | 'published' | null | undefined),
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_script_saved: {
    group: 'funnel',
    description: 'Creator saved a script while progressing through the unified post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      script_id: '' as StringMaybe,
      script_status: '' as ('generated' | 'linked' | 'published' | null | undefined),
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_content_linked: {
    group: 'funnel',
    description: 'Creator linked published content back to the post creation funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      script_id: '' as StringMaybe,
      content_id: '' as StringMaybe,
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  post_creation_published_step_reopened: {
    group: 'funnel',
    description: 'Creator reopened blueprint or script after the content was already published in the unified funnel.',
    payload: {
      creator_id: '' as StringMaybe,
      draft_id: '' as StringMaybe,
      content_id: '' as StringMaybe,
      destination: '' as ('blueprint' | 'script' | null | undefined),
      stage_before: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
      stage_after: '' as ('path' | 'idea' | 'blueprint' | 'script' | 'published' | null | undefined),
    },
  },
  subscription_started: {
    group: 'monetization',
    description: 'Creator initiated subscription payment flow.',
    payload: {
      creator_id: '' as StringMaybe,
      plan: '' as ('mensal' | 'anual' | string | null | undefined),
      currency: '' as StringMaybe,
      value: 0 as NumberMaybe,
    },
  },
  subscription_activated: {
    group: 'monetization',
    description: 'Subscription became active after payment confirmation.',
    payload: {
      creator_id: '' as StringMaybe,
      plan: '' as ('mensal' | 'anual' | string | null | undefined),
      currency: '' as StringMaybe,
      value: 0 as NumberMaybe,
    },
  },
  subscription_canceled: {
    group: 'monetization',
    description: 'Subscription was canceled or scheduled to end.',
    payload: {
      creator_id: '' as StringMaybe,
      plan: '' as ('mensal' | 'anual' | string | null | undefined),
      currency: '' as StringMaybe,
      value: 0 as NumberMaybe,
    },
  },
  affiliate_link_clicked: {
    group: 'affiliates',
    description: 'Affiliate shared link was clicked.',
    payload: {
      ref_creator_id: '' as StringMaybe,
      new_creator_id: '' as StringMaybe,
      commission_base_value: 0 as NumberMaybe,
      channel: '' as StringMaybe,
    },
  },
  affiliate_signup_converted: {
    group: 'affiliates',
    description: 'Affiliate referred creator completed signup.',
    payload: {
      ref_creator_id: '' as StringMaybe,
      new_creator_id: '' as StringMaybe,
      commission_base_value: 0 as NumberMaybe,
    },
  },
  email_delivered: {
    group: 'email',
    description: 'Outbound email reported as delivered by provider.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
    },
  },
  email_bounced: {
    group: 'email',
    description: 'Outbound email bounced.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      bounce_reason: '' as StringMaybe,
    },
  },
  email_opened: {
    group: 'email',
    description: 'Outbound email opened by recipient.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
    },
  },
  email_link_clicked: {
    group: 'email',
    description: 'Outbound email link clicked by recipient.',
    payload: {
      creator_id: '' as StringMaybe,
      proposal_id: '' as StringMaybe,
      link_target: '' as StringMaybe,
    },
  },
} satisfies Record<string, EventSpec<Record<string, any>>>;

export type AnalyticsEventCatalog = typeof analyticsEventCatalog;
export type KnownAnalyticsEvent = keyof AnalyticsEventCatalog;
export type AnalyticsEventName = KnownAnalyticsEvent | (string & {});

export type AnalyticsEventPayload<Name extends AnalyticsEventName> =
  Name extends KnownAnalyticsEvent
    ? AnalyticsEventCatalog[Name]['payload']
    : Record<string, any>;

export function getEventDefinition(name: KnownAnalyticsEvent) {
  return analyticsEventCatalog[name];
}
