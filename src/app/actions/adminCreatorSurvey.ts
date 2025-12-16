'use server';

import { getCreatorSurveyById } from '@/lib/services/adminCreatorSurveyService';
import { AdminCreatorSurveyDetail } from '@/types/admin/creatorSurvey';

export async function fetchCreatorSurveyDetailAction(id: string): Promise<AdminCreatorSurveyDetail | null> {
    try {
        const detail = await getCreatorSurveyById(id);
        // Serialize dates or objects if necessary, but getCreatorSurveyById seems to return simple objects/strings for dates mostly.
        // However, if it returns Mongoose documents or Dates, we might need to serialize them.
        // Looking at getCreatorSurveyById implementation, it converts dates to ISO strings, so it should be safe.
        // But it returns `insightsHistory` which might contain some complex objects if not carefully mapped.
        // Let's assume it's safe for now as per the types.
        return JSON.parse(JSON.stringify(detail)); // Deep copy to ensure serialization
    } catch (error) {
        console.error('Failed to fetch creator survey detail:', error);
        return null;
    }
}
