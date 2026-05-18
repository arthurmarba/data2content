type VideoNarrativeLoadingBlockProps = {
  title: string;
  messages: string[];
};

export function VideoNarrativeLoadingBlock({ title, messages }: VideoNarrativeLoadingBlockProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
      {messages.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {messages.map((message, index) => (
            <li key={message} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm text-zinc-700">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-950" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase text-zinc-500">{index + 1}</span>
              <span>{message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-zinc-600">Sem etapas de carregamento para este estágio.</p>
      )}
    </div>
  );
}
