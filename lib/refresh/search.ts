type SearchResult = {
  title: string;
  url: string;
  publishedDate: string | null;
  highlights: string[];
};

export function isAllowedSource(url: string, hosts: string[]): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function dedupeResults(results: SearchResult[]): SearchResult[] {
  const byUrl = new Map<string, SearchResult>();
  for (const result of results) {
    if (!byUrl.has(result.url)) byUrl.set(result.url, result);
  }
  return [...byUrl.values()];
}

export type { SearchResult };
