export default function ContentAnalysisHistoryLoading() {
  return (
    <main className="min-h-dvh bg-white px-5 pt-20">
      <div className="mx-auto max-w-2xl animate-pulse">
        <div className="h-3 w-24 rounded bg-zinc-100" />
        <div className="mt-4 h-16 w-64 rounded-xl bg-zinc-100" />
        <div className="mt-10 space-y-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-[104px] rounded-2xl bg-zinc-100" />)}
        </div>
      </div>
    </main>
  );
}
