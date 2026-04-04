import CalendarHub from "./CalendarHub";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <CalendarHub />
    </main>
  );
}
