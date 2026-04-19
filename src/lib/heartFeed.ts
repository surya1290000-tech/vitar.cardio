export type HeartFeedKind = 'news' | 'study';

export interface HeartFeedItem {
  id: string;
  kind: HeartFeedKind;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  url: string;
  image: string | null;
}

interface NewsApiArticle {
  source?: { name?: string | null } | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
}

interface NewsApiResponse {
  articles?: NewsApiArticle[];
}

interface PubMedSearchResponse {
  esearchresult?: {
    idlist?: string[];
  };
}

interface PubMedArticleId {
  idtype?: string;
  value?: string;
}

interface PubMedSummaryRecord {
  uid?: string;
  title?: string;
  pubdate?: string;
  fulljournalname?: string;
  authors?: Array<{ name?: string }>;
  articleids?: PubMedArticleId[];
}

interface PubMedSummaryResponse {
  result?: Record<string, PubMedSummaryRecord | string[] | undefined> & {
    uids?: string[];
  };
}

const HEART_NEWS_QUERY =
  '("heart attack" OR "myocardial infarction" OR "acute coronary syndrome") AND (detection OR prevention OR treatment OR emergency OR wearable OR ECG OR AI OR monitoring OR hospital)';
const HEART_STUDY_QUERY =
  '("myocardial infarction"[Title/Abstract] OR "heart attack"[Title/Abstract] OR "acute coronary syndrome"[Title/Abstract]) AND (detection[Title/Abstract] OR prevention[Title/Abstract] OR monitoring[Title/Abstract] OR wearable[Title/Abstract] OR ECG[Title/Abstract] OR AI[Title/Abstract] OR risk[Title/Abstract])';
const TRUSTED_NEWS_DOMAINS = [
  'reuters.com',
  'apnews.com',
  'medicalxpress.com',
  'sciencedaily.com',
  'heart.org',
  'nih.gov',
  'mayoclinic.org',
];
const PRIMARY_HEART_TERMS = [
  'heart attack',
  'myocardial infarction',
  'acute coronary syndrome',
  'stemi',
  'nstemi',
];
const PROJECT_RELEVANCE_TERMS = [
  'wearable',
  'monitor',
  'monitoring',
  'ecg',
  'cardiac',
  'detection',
  'prevention',
  'ai',
  'risk',
  'alert',
  'emergency',
  'hospital',
];

function safeDate(value: string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
}

function trimText(value: string | null | undefined, fallback: string): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function countKeywordHits(haystack: string, terms: string[]): number {
  const normalized = haystack.toLowerCase();
  return terms.reduce((count, term) => count + (normalized.includes(term) ? 1 : 0), 0);
}

function isRelevantNewsArticle(article: NewsApiArticle): boolean {
  const content = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  const primaryHits = countKeywordHits(content, PRIMARY_HEART_TERMS);
  const relevanceHits = countKeywordHits(content, PROJECT_RELEVANCE_TERMS);
  return primaryHits >= 1 && relevanceHits >= 1;
}

function normalizeNewsArticles(articles: NewsApiArticle[]): HeartFeedItem[] {
  return articles
    .filter((article) => article.url && article.title)
    .filter(isRelevantNewsArticle)
    .sort((a, b) => {
      const aText = `${a.title || ''} ${a.description || ''}`;
      const bText = `${b.title || ''} ${b.description || ''}`;
      const aScore = countKeywordHits(aText, PRIMARY_HEART_TERMS) * 3 + countKeywordHits(aText, PROJECT_RELEVANCE_TERMS);
      const bScore = countKeywordHits(bText, PRIMARY_HEART_TERMS) * 3 + countKeywordHits(bText, PROJECT_RELEVANCE_TERMS);
      return bScore - aScore;
    })
    .slice(0, 10)
    .map((article, index) => ({
      id: `news-${index}-${encodeURIComponent(article.url as string)}`,
      kind: 'news' as const,
      title: trimText(article.title, 'Untitled heart health update'),
      source: trimText(article.source?.name, 'News Source'),
      publishedAt: safeDate(article.publishedAt),
      summary: trimText(
        article.description,
        'Open the original article for the latest reporting and source details.'
      ),
      url: article.url as string,
      image: article.urlToImage || null,
    }));
}

function buildStudySummary(record: PubMedSummaryRecord): string {
  const journal = trimText(record.fulljournalname, 'PubMed indexed journal');
  const author = record.authors?.[0]?.name?.trim();
  const date = trimText(record.pubdate, 'Recent publication');

  if (author) {
    return `${journal}. Lead author: ${author}. Published: ${date}.`;
  }

  return `${journal}. Published: ${date}.`;
}

function resolveStudyUrl(record: PubMedSummaryRecord): string {
  const doi = record.articleids?.find((item) => item.idtype === 'doi')?.value?.trim();
  if (doi) {
    return `https://doi.org/${doi}`;
  }

  return `https://pubmed.ncbi.nlm.nih.gov/${record.uid ?? ''}/`;
}

function normalizeStudyRecords(records: PubMedSummaryRecord[]): HeartFeedItem[] {
  return records
    .filter((record) => record.uid && record.title)
    .slice(0, 8)
    .map((record) => ({
      id: `study-${record.uid}`,
      kind: 'study' as const,
      title: trimText(record.title, 'Recent heart study'),
      source: trimText(record.fulljournalname, 'PubMed'),
      publishedAt: safeDate(record.pubdate),
      summary: buildStudySummary(record),
      url: resolveStudyUrl(record),
      image: null,
    }));
}

async function fetchHeartNews(): Promise<HeartFeedItem[]> {
  const apiKey = process.env.NEWSAPI_KEY || process.env.HEART_NEWS_API_KEY;
  if (!apiKey) {
    return [];
  }
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const params = new URLSearchParams({
    q: HEART_NEWS_QUERY,
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: '20',
    from: fromDate,
    domains: TRUSTED_NEWS_DOMAINS.join(','),
    apiKey,
  });

  const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`News feed request failed with status ${res.status}`);
  }

  const data = (await res.json()) as NewsApiResponse;
  return normalizeNewsArticles(data.articles || []);
}

async function fetchHeartStudies(): Promise<HeartFeedItem[]> {
  const apiKey = process.env.NCBI_API_KEY || process.env.PUBMED_API_KEY;
  const searchParams = new URLSearchParams({
    db: 'pubmed',
    sort: 'pub_date',
    retmode: 'json',
    retmax: '8',
    term: HEART_STUDY_QUERY,
  });

  if (apiKey) {
    searchParams.set('api_key', apiKey);
  }

  const searchRes = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`,
    { next: { revalidate: 900 } }
  );

  if (!searchRes.ok) {
    throw new Error(`PubMed search failed with status ${searchRes.status}`);
  }

  const searchData = (await searchRes.json()) as PubMedSearchResponse;
  const ids = searchData.esearchresult?.idlist || [];
  if (ids.length === 0) {
    return [];
  }

  const summaryParams = new URLSearchParams({
    db: 'pubmed',
    retmode: 'json',
    id: ids.join(','),
  });

  if (apiKey) {
    summaryParams.set('api_key', apiKey);
  }

  const summaryRes = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams.toString()}`,
    { next: { revalidate: 900 } }
  );

  if (!summaryRes.ok) {
    throw new Error(`PubMed summary failed with status ${summaryRes.status}`);
  }

  const summaryData = (await summaryRes.json()) as PubMedSummaryResponse;
  const records = (summaryData.result?.uids || [])
    .map((uid) => summaryData.result?.[uid])
    .filter((record): record is PubMedSummaryRecord => typeof record === 'object' && record !== null);

  return normalizeStudyRecords(records);
}

export async function getHeartFeed(): Promise<HeartFeedItem[]> {
  const [newsResult, studiesResult] = await Promise.allSettled([fetchHeartNews(), fetchHeartStudies()]);

  const news = newsResult.status === 'fulfilled' ? newsResult.value : [];
  const studies = studiesResult.status === 'fulfilled' ? studiesResult.value : [];

  return [...news, ...studies]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 14);
}
