import { NextResponse } from "next/server";

interface YouTubeItem {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    description?: string;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "criadores de conteúdo";
  const maxResults = searchParams.get("maxResults") || "6";

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "Missing YOUTUBE_API_KEY" }, { status: 500 });
  }

  const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
    query
  )}&type=video&maxResults=${maxResults}&key=${process.env.YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(youtubeApiUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch videos from YouTube" }, { status: res.status });
    }

    const data = await res.json();
    const items: YouTubeItem[] = data.items || [];

    const videos = items.map((item) => ({
      videoId: item.id?.videoId || "",
      title: item.snippet?.title || "",
      description: item.snippet?.description || "",
    }));

    return NextResponse.json(videos);
  } catch (error: unknown) {
    console.error("Error fetching videos:", error);

    let message = "Erro desconhecido.";
    if (error instanceof Error) {
      message = error.message;
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
