export type AdminListQuery = {
  q: string;
  page: number;
  limit: number;
  offset: number;
};

export function parseAdminListQuery(url: URL, defaultLimit = 50): AdminListQuery {
  const q = String(url.searchParams.get("q") || "").trim().toUpperCase();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const limit = Math.min(100, Math.max(10, Number(url.searchParams.get("limit") || defaultLimit) || defaultLimit));
  return { q, page, limit, offset: (page - 1) * limit };
}

export function paginateList<T>(items: T[], query: AdminListQuery) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.limit;
  return {
    items: items.slice(offset, offset + query.limit),
    total,
    page,
    limit: query.limit,
    totalPages,
  };
}

export function matchesQuery(text: string, q: string) {
  if (!q) return true;
  return text.toUpperCase().includes(q);
}
