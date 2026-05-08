import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/legal-document';
import { LEGAL_PAGES } from '@/lib/legal-pages';

export const metadata: Metadata = {
  title: 'Privacidade',
  description: LEGAL_PAGES.privacy.description,
};

export default function PrivacyPage() {
  return <LegalDocument page={LEGAL_PAGES.privacy} />;
}
