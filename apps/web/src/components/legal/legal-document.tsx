import type { LegalPageContent } from '@/lib/legal-pages';

export function LegalDocument({ page }: { page: LegalPageContent }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">
          Documento legal
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">{page.title}</h1>
        <p className="mt-3 text-sm leading-6 text-surface-400">{page.description}</p>
        <p className="mt-5 text-xs text-surface-500">Última atualização: {page.updatedAt}</p>
      </div>

      <div className="mt-8 space-y-8">
        {page.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold text-white">{section.title}</h2>
            <div className="mt-3 space-y-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-surface-400">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-4 space-y-2">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-sm leading-6 text-surface-400">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

    </div>
  );
}
