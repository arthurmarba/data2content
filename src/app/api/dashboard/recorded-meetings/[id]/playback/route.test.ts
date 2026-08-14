import { getServerSession } from "next-auth";

import { canAccessRecordedMeetings } from "@/app/lib/community/recordedMeetingsAccess";
import {
  getRecordedMeetingsState,
  toRecordedMeetingPlayback,
} from "@/app/lib/community/recordedMeetingsService";
import { GET } from "./route";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({ resolveAuthOptions: jest.fn().mockResolvedValue({}) }));
jest.mock("@/app/lib/community/recordedMeetingsAccess", () => ({
  canAccessRecordedMeetings: jest.fn(),
}));
jest.mock("@/app/lib/community/recordedMeetingsService", () => ({
  getRecordedMeetingsState: jest.fn(),
  toRecordedMeetingPlayback: jest.fn((meeting) => meeting),
}));

const canAccess = canAccessRecordedMeetings as jest.Mock;
const getState = getRecordedMeetingsState as jest.Mock;
const toPlayback = toRecordedMeetingPlayback as jest.Mock;

describe("GET /api/dashboard/recorded-meetings/[id]/playback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "user-1" } });
    getState.mockResolvedValue({
      status: "ready",
      meetings: [{
        id: "meeting-1",
        youtubeVideoId: "video-secret",
        title: "Reunião",
        description: "Descrição",
        publishedAt: "2026-08-01T12:00:00.000Z",
        thumbnailUrl: "youtube-thumbnail",
      }],
    });
  });

  it("nega a reprodução antes de consultar a playlist quando o usuário é Free", async () => {
    canAccess.mockResolvedValue(false);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "meeting-1" }),
    });

    expect(response.status).toBe(403);
    expect(getState).not.toHaveBeenCalled();
    expect(toPlayback).not.toHaveBeenCalled();
  });

  it("entrega os dados de reprodução somente ao usuário Pro", async () => {
    canAccess.mockResolvedValue(true);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "meeting-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meeting.youtubeVideoId).toBe("video-secret");
    expect(toPlayback).toHaveBeenCalledTimes(1);
  });
});
