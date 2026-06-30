import { generatedDocs } from "./generated-docs";

export type DocPage = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  path: string;
  tags: string[];
  content: string;
};

export const docsCatalog: DocPage[] = generatedDocs.map((entry) => ({
  ...entry,
  tags: [...entry.tags]
}));

export const docsCategories = [...new Set(docsCatalog.map((doc) => doc.category))];

export function docsByQuery(query: string, category: string) {
  const normalized = query.trim().toLowerCase();
  return docsCatalog.filter((doc) => {
    const matchesCategory = category === "ALL" || doc.category === category;
    const matchesQuery =
      !normalized ||
      doc.title.toLowerCase().includes(normalized) ||
      doc.summary.toLowerCase().includes(normalized) ||
      doc.tags.some((tag) => tag.toLowerCase().includes(normalized));
    return matchesCategory && matchesQuery;
  });
}

export function docNeighbors(slug: string) {
  const index = docsCatalog.findIndex((doc) => doc.slug === slug);
  return {
    previous: index > 0 ? docsCatalog[index - 1] : null,
    next: index >= 0 && index < docsCatalog.length - 1 ? docsCatalog[index + 1] : null
  };
}

export function docBySlug(slug: string) {
  return docsCatalog.find((doc) => doc.slug === slug) ?? docsCatalog[0];
}
