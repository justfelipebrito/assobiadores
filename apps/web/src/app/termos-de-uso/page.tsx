import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/legal-document';
import { LEGAL_PAGES } from '@/lib/legal-pages';

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: LEGAL_PAGES.terms.description,
};

export default function TermsOfUsePage() {
  return <LegalDocument page={LEGAL_PAGES.terms} />;
}
