import { z } from 'zod';

export const competitionCategorySchema = z.enum(['freestyle', 'melodia', 'passaros']);
export type CompetitionCategory = z.infer<typeof competitionCategorySchema>;

export const COMPETITION_CATEGORIES: {
  value: CompetitionCategory;
  label: string;
}[] = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'melodia', label: 'Melodia' },
  { value: 'passaros', label: 'Pássaros' },
];

export const COMPETITION_CATEGORY_LABELS: Record<CompetitionCategory, string> = {
  freestyle: 'Freestyle',
  melodia: 'Melodia',
  passaros: 'Pássaros',
};
