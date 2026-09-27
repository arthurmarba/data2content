'use client';
import { useEffect } from 'react';
import { RESEARCH_LANG_COOKIE, type ResearchLang } from './researchLang';

export default function ResearchLanguage({ lang, marketplace }: { lang: ResearchLang; marketplace: boolean }) {
  // Guarda a escolha para a volta do Login do Facebook, que retorna sem o parâmetro.
  useEffect(() => { document.cookie = `${RESEARCH_LANG_COOKIE}=${lang}; path=/creator-research; max-age=2592000; samesite=lax`; }, [lang]);
  const en = lang === 'en';
  return <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-6 pt-6 text-sm">
    <a href="#research" className="underline">{en ? 'Creator research by @' : 'Pesquisa por @'}</a>
    {marketplace && <a href="#marketplace" className="underline">{en ? 'Creator discovery (Instagram Creator Marketplace)' : 'Descoberta de criadores (Marketplace)'}</a>}
    <span className="ml-auto">
      <a href="?lang=pt" aria-current={!en} className={en ? 'underline' : 'font-semibold'}>Português</a>
      {' · '}
      <a href="?lang=en" aria-current={en} className={en ? 'font-semibold' : 'underline'}>English</a>
    </span>
  </nav>;
}
