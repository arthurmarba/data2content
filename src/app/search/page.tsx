import faqItems from "@/data/faq";

interface SearchPageProps {
  searchParams: { q?: string };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams.q || "").toLowerCase();
  const results = query
    ? faqItems.filter(
        (item) =>
          item.q.toLowerCase().includes(query) ||
          item.a.toLowerCase().includes(query)
      )
    : [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">
        Resultados para &quot;{searchParams.q || ""}&quot;
      </h1>
      {query === "" ? (
        <p>Digite um termo de busca acima.</p>
      ) : results.length === 0 ? (
        <p>Nenhum resultado encontrado.</p>
      ) : (
        <ul className="space-y-6">
          {results.map((item, idx) => (
            <li key={idx} className="border-b pb-4">
              <h2 className="font-semibold text-lg">{item.q}</h2>
              <div
                className="mt-2 text-sm text-gray-700"
                dangerouslySetInnerHTML={{ __html: item.a }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
