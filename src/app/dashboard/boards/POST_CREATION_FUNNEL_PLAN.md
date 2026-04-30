# Post Creation Funnel Plan

## Current state

Today the `Criação de Post` board is split into two tabs:

- `Pautas de conteúdo` powered by the planning flow
- `Meus Roteiros` powered by the scripts flow

This creates a handoff:

1. the user explores or saves a pauta
2. the user changes context
3. the user generates or edits a roteiro
4. later the user may link a published content item

The product direction is to replace that handoff with one continuous funnel centered on a single object: `post em construção`.

## Product thesis

The board should stop behaving like two tools and start behaving like one guided decision flow:

1. decide what should be posted now
2. explain why this is the best path for the creator profile
3. turn the decision into a practical blueprint
4. optionally expand into a roteiro
5. link the published content back to the same object

## Core object

The board should converge around one entity:

- `PostCreationFunnelState`

This state should carry:

- recommendation path
- selected editorial choices
- chosen pauta
- blueprint
- optional script
- linked content

## Funnel stages

The future board should progress through these stages in one canvas:

1. `path`
   - `window`
   - `format`
   - `proposal`
   - `narrative`
2. `idea`
   - recommended pauta variants
   - recommended option, alternatives, confidence
3. `blueprint`
   - what to post
   - why this path
   - when to post
   - how the video should work
   - 4-6 scenes
4. `script`
   - optional expansion from blueprint into roteiro
5. `published`
   - content linked back to the same flow item

## Intelligence inputs

The funnel must combine three existing assets:

1. `categorization intelligence`
   - proposal
   - context
   - format
   - tone
   - references
2. `performance signals`
   - timing
   - category combinations
   - linked scripts and outcomes
   - winning narratives
3. `AI-generated ideas`
   - saved pauta suggestions
   - newly generated pauta candidates

The board should not pick a path from only one of these sources. It should rank combinations by combining all three.

## Decision logic

Every checkpoint in the funnel should expose:

- one recommended option
- two or three alternatives
- one short reason

Checkpoint order:

1. `window`
2. `format`
3. `proposal`
4. `narrative`
5. `idea selection`
6. `blueprint`

Each downstream step must recalculate when an upstream choice changes.

## Existing capabilities to preserve

The new funnel must reuse existing capabilities instead of replacing them:

- planner recommendations and saved pauta flow
- script generation and script adjustment
- script-to-content linking
- script list persistence in `Meus Roteiros`

These become stages of the same funnel instead of separate sessions.

## Implementation phases

### Phase 1

- define funnel state and step model
- expose a unified step order in the board layer
- keep current planner/scripts surfaces alive behind the new model

### Phase 2

- introduce a single board shell with sequential sections
- show recommended path, selected pauta and blueprint in one flow
- keep `Gerar roteiro` as an action from the blueprint step

### Phase 3

- bring content linking into the same card
- feed linked content outcomes back into ranking and recommendation confidence

## Success criteria

The funnel is better when it reduces:

- time to decide what to post
- need to switch contexts between pauta and roteiro
- ambiguity about why the recommendation was made

And increases:

- pauta selection rate
- blueprint generation rate
- script expansion rate
- linked-content completion rate
