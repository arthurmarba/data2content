---
name: data2content-product-direction
description: >
  Use when planning, implementing, reviewing, or debugging Data2Content product work, especially onboarding, creator diagnosis, narrative map, content creation, uploads, Instagram analysis, collabs, brand matching, monetization, creator-facing AI prompts, UX copy, dashboards, or product strategy. Keeps every decision aligned with the product purpose: calm, self-awareness-led content creation where content is a consequence of the creator's life and narrative, not a source of anxiety.
---

# Data2Content Product Direction

## North Star

Build Data2Content as a calm strategic companion for creators.

The platform must help a creator understand who they are, what they want from content, and how their life becomes coherent content. Only after that should it help with creation, distribution, collabs, brands, products, and monetization.

Data2Content is not a generic content factory, growth-hack dashboard, or brand marketplace first. It is a narrative and consciousness map that becomes a practical operating system for content.

## Core Belief

Treat creator data as life signals, not just metrics. Metrics, posts, uploads, audience behavior, and Instagram history are evidence for narrative, territory, rhythm, anxiety reduction, and coherent action.

The product should reduce the anxiety of posting, not increase dependence on numbers. It should help the creator say: "I know who I am, I know what I am building, and this post either fits or does not fit."

## Product Journey

Respect this order when designing flows:

1. Self-awareness: ask who the creator is, what they want with content, where they want to go, and how content should serve their life.
2. Central narrative: help the creator define or discover the core narrative they want to build.
3. Territories: map subjects the creator can legitimately occupy.
4. Adjacent narratives: suggest coherent narrative extensions from the central narrative and territories.
5. Assets: map what exists in the creator's real life that can become content without forcing life to become content.
6. Tone: capture how the creator wants to speak, such as reflective, humorous, inspirational, direct, technical, or intimate.
7. Formats: connect narrative and tone to practical content formats.
8. Coherence: evaluate new content against the creator's map.
9. Creation: generate ideas, pautas, scripts, and calendars from the map.
10. Distribution: recommend collabs and creators with compatible narratives.
11. Monetization: recommend brands, products, proposals, and projects that match the creator's narrative.
12. Daily usefulness: support planning, content management, money, collabs, and performance so the platform remains useful after the initial map.

Collabs can exist as a feature before the full journey is complete, especially when much of it is already implemented. In the user's mental journey, however, collabs should be introduced after the map is clear: "Now that we understand your narrative, here are people who make sense with you."

## Decision Rules

Before changing product behavior, answer these questions:

- Does this strengthen the creator's self-awareness, narrative clarity, or coherent action?
- Does this reduce anxiety around ideas, posting, numbers, criticism, or fear of flopping?
- Does this fit a clear step in the product journey, or does it add another disconnected mini-product?
- Does it treat data as meaning and narrative, not just as performance pressure?
- Does it help the creator create from life, rather than transform all of life into content?
- Is the UI calm, guided, and sparse enough that the creator knows the next step?
- Does the feature preserve a straight-line journey rather than asking the creator to do everything at once?

If the answer is unclear, narrow the feature until it maps to one journey step.

## UX Principles

- Make the experience calm. Prefer one focused question, state, or action at a time.
- Use less text when possible. Let structure, progress, and clear choices carry the experience.
- Make onboarding feel like a guided reflection, not a form dump.
- Let users return to account/profile configuration and adjust their inputs over time.
- Enrich the map incrementally from new videos, Instagram connection, creator answers, and observed high-performing content.
- Keep the platform "sem firula": sharp, lean, and only as complex as the belief requires.
- Prefer language such as "mapa", "narrativa central", "territorios", "assets", "tom", "formatos", "coerencia", "oportunidades", and "proximos passos".

## Product Pillars

### Consciousness And Narrative

Help the creator build the map: who they are, why they create, what content means to them, their central narrative, territories, adjacent narratives, assets, tone, and formats.

### Coherent Creation

When a creator uploads or drafts content, tell whether it connects with the map. If they lack ideas, generate ideas from the map instead of generic trends.

### Distribution Through Collabs

Recommend creators with compatible or complementary narratives. The first version can be recommendation-only; do not require full request/accept collaboration mechanics to deliver value.

### Monetization Through Narrative Fit

Recommend brands, products, proposals, and projects because they match the creator's narrative, not because they are generic commercial opportunities.

### Daily Operating System

After the map is built, give the creator reasons to return: content calendar, content management, collab management, monetization tracking, money/proposals, and post-by-post refinement.

## Implementation Guidance

When implementing features:

- Locate the requested work in the journey before coding.
- Preserve existing useful mini-products, but connect them into the journey.
- If a feature currently feels isolated, introduce copy, navigation, state, or data flow that explains its place in the map.
- Use uploads and Instagram data to enrich understanding over time, not just to score performance.
- If analyzing downloaded Instagram/video content, design for minimal retention: process, extract durable insights, and delete raw media unless there is explicit consent and a product reason to keep it.
- Track where users engage, stop, return, or disengage across journey steps.
- Prefer partial saves, progressive completion, and editable profile inputs.
- Avoid making collabs, brands, or monetization feel like the first product promise before identity and narrative are established.

## Agent Workflow

Use this checklist for product or code work:

1. State the journey step the work belongs to.
2. State how it supports calm, narrative clarity, coherent creation, distribution, or monetization.
3. Implement the smallest change that connects the feature to that purpose.
4. Preserve a calm UI and direct copy.
5. In the final response, mention the alignment briefly if it affected the implementation.

## Avoid

- Do not frame Data2Content as "post more", "beat the algorithm", "hack growth", or "turn your whole life into content".
- Do not force the creator into one niche if their identity spans multiple territories.
- Do not create dashboards that increase anxiety without translating numbers into calm decisions.
- Do not add large blocks of explanatory copy when the same guidance can be expressed as a focused prompt, question, or next step.
- Do not push monetization, brands, or collabs before the creator has enough narrative clarity.
- Do not leave newly built features as disconnected islands.

## Source Notes

For the audio-derived rationale behind this skill, read `references/source-notes.md` when product direction is ambiguous or a major roadmap decision depends on the underlying conversation.
