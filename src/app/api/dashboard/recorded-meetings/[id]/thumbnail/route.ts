import { getRecordedMeetingsState } from "@/app/lib/community/recordedMeetingsService";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getRecordedMeetingsState();
  const meeting = result.meetings.find((candidate) => candidate.id === id);
  if (!meeting) return new Response(null, { status: 404 });

  const sources = [
    `https://img.youtube.com/vi/${meeting.youtubeVideoId}/maxresdefault.jpg`,
    meeting.thumbnailUrl,
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source, { next: { revalidate: 60 * 60 } });
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (!response.ok || !ALLOWED_IMAGE_TYPES.has(contentType)) continue;
      return new Response(response.body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    } catch {
      // Tenta a miniatura de fallback antes de declarar indisponibilidade.
    }
  }

  return new Response(null, { status: 404 });
}
