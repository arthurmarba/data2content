import {
  buildWeeklyMeetingIcs,
  computeNextWeeklyMeeting,
  formatWeeklyMeetingDate,
} from "./weeklyMeeting";

describe("weeklyMeeting", () => {
  it("selects the same Thursday before and during the meeting", () => {
    const before = computeNextWeeklyMeeting(new Date("2026-07-23T20:30:00.000Z"));
    const during = computeNextWeeklyMeeting(new Date("2026-07-23T23:00:00.000Z"));

    expect(before.startAt.toISOString()).toBe("2026-07-23T22:00:00.000Z");
    expect(during.startAt.toISOString()).toBe("2026-07-23T22:00:00.000Z");
    expect(before.endAt.toISOString()).toBe("2026-07-24T00:00:00.000Z");
  });

  it("advances one week after Thursday's meeting ends", () => {
    const slot = computeNextWeeklyMeeting(new Date("2026-07-24T00:01:00.000Z"));
    expect(slot.startAt.toISOString()).toBe("2026-07-30T22:00:00.000Z");
  });

  it("formats and exports the two-hour meeting without exposing a raw call link", () => {
    const slot = computeNextWeeklyMeeting(new Date("2026-07-19T12:00:00.000Z"));
    const ics = buildWeeklyMeetingIcs({
      ...slot,
      meetingPageUrl: "https://data2content.ai/reuniao",
      generatedAt: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(formatWeeklyMeetingDate(slot.startAt)).toContain("Quinta-feira");
    expect(ics).toContain("DTSTART:20260723T220000Z");
    expect(ics).toContain("DTEND:20260724T000000Z");
    expect(ics).toContain("https://data2content.ai/reuniao");
    expect(ics).toContain("STATUS:TENTATIVE");
    expect(ics).toContain("Mudanças e cancelamentos");
  });

  it("marks a cancelled edition explicitly in the calendar", () => {
    const slot = computeNextWeeklyMeeting(new Date("2026-07-19T12:00:00.000Z"));
    const ics = buildWeeklyMeetingIcs({
      ...slot,
      meetingPageUrl: "https://data2content.ai/reuniao",
      status: "cancelled",
      generatedAt: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(ics).toContain("SUMMARY:Cancelada");
    expect(ics).toContain("STATUS:CANCELLED");
  });
});
