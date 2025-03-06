import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "criadores de conteúdo";
  const maxResults = searchParams.get("maxResults") || "6";

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "Missing YOUTUBE_API_KEY" }, { status: 500 });
  }

  const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${process.env.YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(youtubeApiUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch videos from YouTube" }, { status: res.status });
    }
    const data = await res.json();

    const videos = data.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
    }));

    return NextResponse.json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error);
    return NextResponse.json({ error: "Error fetching videos" }, { status: 500 });
  }
}
