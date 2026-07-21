import { getUpcomingMentorshipOperationalEvent } from "./events";
import { getWeeklyMeetingExperience } from "./weeklyMeetingService";

jest.mock("./events", () => ({
  getUpcomingMentorshipOperationalEvent: jest.fn(),
}));

const getOperationalEventMock =
  getUpcomingMentorshipOperationalEvent as jest.MockedFunction<
    typeof getUpcomingMentorshipOperationalEvent
  >;

describe("getWeeklyMeetingExperience", () => {
  const originalFallbackUrl = process.env.WEEKLY_MEETING_JOIN_URL;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalFallbackUrl === undefined) {
      delete process.env.WEEKLY_MEETING_JOIN_URL;
    } else {
      process.env.WEEKLY_MEETING_JOIN_URL = originalFallbackUrl;
    }
  });

  it("uses a forecast fallback without claiming the meeting is confirmed", async () => {
    getOperationalEventMock.mockResolvedValue(null);
    process.env.WEEKLY_MEETING_JOIN_URL = "https://meet.example/fallback";

    const meeting = await getWeeklyMeetingExperience(
      new Date("2026-07-19T12:00:00.000Z"),
    );

    expect(meeting.status).toBe("forecast");
    expect(meeting.source).toBe("weekly_fallback");
    expect(meeting.joinUrl).toBe("https://meet.example/fallback");
  });

  it("never exposes the call link for a cancelled edition", async () => {
    getOperationalEventMock.mockResolvedValue({
      _id: "event-1",
      title: "Reunião semanal",
      startAt: new Date("2026-07-23T22:00:00.000Z"),
      endAt: new Date("2026-07-24T00:00:00.000Z"),
      timezone: "America/Sao_Paulo",
      joinUrl: "https://meet.example/stale",
      status: "cancelled",
      isFallback: false,
    });

    const meeting = await getWeeklyMeetingExperience(
      new Date("2026-07-20T12:00:00.000Z"),
    );

    expect(meeting.status).toBe("cancelled");
    expect(meeting.joinUrl).toBeNull();
  });
});
