/** @jest-environment node */
import { getMcpCollabCreatorSuggestions } from './catalog';
import { buildCollabCreatorSuggestions } from '@/app/lib/planner/collabCreatorSuggestionsService';

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/Metric', () => ({ __esModule: true, default: {} }));
jest.mock('@/app/models/PublishedContentEvidence', () => ({ __esModule: true, default: {} }));
jest.mock('@/app/models/MapaSeed', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('@/app/lib/scripts/intelligenceContext', () => ({}));
jest.mock('@/app/lib/scripts/ai', () => ({}));
jest.mock('@/app/lib/scripts/creatorScriptGenerationV3', () => ({}));
jest.mock('@/app/lib/planner/collabCreatorSuggestionsService', () => ({
  buildCollabCreatorSuggestions: jest.fn(async () => ({ items: [], contextLabel: null })),
}));
jest.mock('./creatorMap', () => ({ loadMcpCreatorMap: jest.fn(async () => null) }));
jest.mock('./collabIntelligence', () => ({ suggestMcpCollabCreators: jest.fn(async () => null) }));
jest.mock('./communityResearch', () => ({}));

it('no conector, o ranking de collab só considera quem ativou aparecer para collab', async () => {
  await getMcpCollabCreatorSuggestions({
    userId: '507f1f77bcf86cd799439011',
    themeKeyword: 'maternidade real',
    periodDays: 180,
    limit: 3,
  });
  expect(buildCollabCreatorSuggestions).toHaveBeenCalledWith(
    expect.objectContaining({ onlyCollabDiscoveryOptIn: true }),
  );
});
