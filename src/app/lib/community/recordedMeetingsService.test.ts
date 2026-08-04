import {
  getRecordedMeetings,
  getRecordedMeetingsState,
  mapYouTubePlaylistItems,
} from "./recordedMeetingsService";

describe("recordedMeetingsService", () => {
  const originalApiKey = process.env.YOUTUBE_API_KEY;
  const originalPlaylistId = process.env.YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID;

  afterEach(() => {
    process.env.YOUTUBE_API_KEY = originalApiKey;
    process.env.YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID = originalPlaylistId;
    jest.restoreAllMocks();
  });

  it("normaliza, filtra e ordena os itens da playlist", () => {
    expect(
      mapYouTubePlaylistItems([
        {
          id: "playlist-item-older",
          snippet: {
            title: "Reunião 01",
            description: "Primeira gravação",
            publishedAt: "2026-07-01T19:00:00.000Z",
            resourceId: { videoId: "video-01" },
          },
        },
        {
          id: "playlist-item-newer",
          snippet: {
            title: "Reunião 02",
            description: "Segunda gravação",
            resourceId: { videoId: "video-02" },
          },
          contentDetails: {
            videoId: "video-02",
            videoPublishedAt: "2026-07-08T19:00:00.000Z",
          },
        },
        {
          id: "private-item",
          snippet: {
            title: "Private video",
            resourceId: { videoId: "private-video" },
          },
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "playlist-item-newer",
        youtubeVideoId: "video-02",
        title: "Reunião 02",
        thumbnailUrl: "https://img.youtube.com/vi/video-02/hqdefault.jpg",
      }),
      expect.objectContaining({
        id: "playlist-item-older",
        youtubeVideoId: "video-01",
        title: "Reunião 01",
      }),
    ]);
  });

  it("não consulta o YouTube enquanto a playlist não estiver configurada", async () => {
    process.env.YOUTUBE_API_KEY = "";
    process.env.YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID = "";
    const fetchSpy = jest.spyOn(global, "fetch");

    await expect(getRecordedMeetings()).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(getRecordedMeetingsState()).resolves.toEqual({
      status: "unconfigured",
      meetings: [],
      missingConfiguration: [
        "YOUTUBE_API_KEY",
        "YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID",
      ],
    });
  });

  it("distingue playlist vazia de indisponibilidade externa", async () => {
    process.env.YOUTUBE_API_KEY = "test-key";
    process.env.YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID = "playlist-123";
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getRecordedMeetingsState()).resolves.toEqual({
      status: "empty",
      meetings: [],
    });

    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "quota" }), { status: 503 }),
    );
    await expect(getRecordedMeetingsState()).resolves.toEqual({
      status: "unavailable",
      meetings: [],
    });
  });

  it("busca os itens da playlist configurada", async () => {
    process.env.YOUTUBE_API_KEY = "test-key";
    process.env.YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID = "playlist-123";
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getRecordedMeetings()).resolves.toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("playlistId=playlist-123"),
      expect.objectContaining({ next: { revalidate: 900 } }),
    );
  });

  it("percorre playlists com mais de uma página", async () => {
    process.env.YOUTUBE_API_KEY = "test-key";
    process.env.YOUTUBE_RECORDED_MEETINGS_PLAYLIST_ID = "playlist-123";
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "first",
                snippet: {
                  title: "Primeira",
                  publishedAt: "2026-07-01T19:00:00.000Z",
                  resourceId: { videoId: "video-first" },
                },
              },
            ],
            nextPageToken: "page-2",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "second",
                snippet: {
                  title: "Segunda",
                  publishedAt: "2026-07-08T19:00:00.000Z",
                  resourceId: { videoId: "video-second" },
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(getRecordedMeetings()).resolves.toEqual([
      expect.objectContaining({ id: "second" }),
      expect.objectContaining({ id: "first" }),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[0]).toEqual(expect.stringContaining("pageToken=page-2"));
  });
});
