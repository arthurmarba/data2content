export type RecordedMeeting = {
  id: string;
  youtubeVideoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
};

export type RecordedMeetingsStatus =
  | "ready"
  | "empty"
  | "unconfigured"
  | "unavailable";

export type RecordedMeetingsResult = {
  status: RecordedMeetingsStatus;
  meetings: RecordedMeeting[];
  missingConfiguration?: Array<"YOUTUBE_API_KEY" | "YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID">;
};

type YouTubePlaylistItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    resourceId?: {
      videoId?: string;
    };
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
};

type YouTubePlaylistResponse = {
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
};

const YOUTUBE_PLAYLIST_ITEMS_ENDPOINT =
  "https://www.googleapis.com/youtube/v3/playlistItems";

export function mapYouTubePlaylistItems(
  items: YouTubePlaylistItem[],
): RecordedMeeting[] {
  return items
    .map((item): RecordedMeeting | null => {
      const youtubeVideoId =
        item.contentDetails?.videoId?.trim() ||
        item.snippet?.resourceId?.videoId?.trim() ||
        "";
      const title = item.snippet?.title?.trim() || "";
      if (!youtubeVideoId || !title || title === "Deleted video" || title === "Private video") {
        return null;
      }

      return {
        id: item.id?.trim() || youtubeVideoId,
        youtubeVideoId,
        title,
        description: item.snippet?.description?.trim() || "",
        publishedAt:
          item.contentDetails?.videoPublishedAt ||
          item.snippet?.publishedAt ||
          "",
        thumbnailUrl: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
      };
    })
    .filter((meeting): meeting is RecordedMeeting => Boolean(meeting))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getRecordedMeetingsState(): Promise<RecordedMeetingsResult> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const playlistId = process.env.YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID?.trim();
  if (!apiKey || !playlistId) {
    const missingConfiguration: RecordedMeetingsResult["missingConfiguration"] = [];
    if (!apiKey) missingConfiguration.push("YOUTUBE_API_KEY");
    if (!playlistId) missingConfiguration.push("YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID");
    return { status: "unconfigured", meetings: [], missingConfiguration };
  }

  const playlistItems: YouTubePlaylistItem[] = [];
  let pageToken = "";

  // A API entrega no máximo 50 itens por página. O teto evita loops em caso de
  // resposta externa inconsistente e ainda comporta vários anos de reuniões.
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    let response: Response;
    try {
      response = await fetch(`${YOUTUBE_PLAYLIST_ITEMS_ENDPOINT}?${params.toString()}`, {
        next: { revalidate: 15 * 60 },
      });
    } catch {
      return { status: "unavailable", meetings: [] };
    }
    if (!response.ok) return { status: "unavailable", meetings: [] };

    let payload: YouTubePlaylistResponse;
    try {
      payload = (await response.json()) as YouTubePlaylistResponse;
    } catch {
      return { status: "unavailable", meetings: [] };
    }
    if (Array.isArray(payload.items)) playlistItems.push(...payload.items);
    pageToken = payload.nextPageToken?.trim() || "";
    if (!pageToken) break;
  }

  const meetings = mapYouTubePlaylistItems(playlistItems);
  return { status: meetings.length > 0 ? "ready" : "empty", meetings };
}

export async function getRecordedMeetings(): Promise<RecordedMeeting[]> {
  const result = await getRecordedMeetingsState();
  if (result.status === "unavailable") {
    throw new Error("youtube_recorded_meetings_unavailable");
  }
  return result.meetings;
}
