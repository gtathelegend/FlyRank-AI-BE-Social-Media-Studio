import { validateUrlForSsrf } from './ssrfGuard.js';

export interface IngestedUrlContent {
  title: string | null;
  content: string;
  sourceUrl: string;
}

export class UrlIngestionError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'UrlIngestionError';
    this.statusCode = statusCode;
  }
}

export type FetchFunction = (url: string, init?: RequestInit) => Promise<Response>;

export async function fetchAndExtractUrlContent(
  url: string,
  customFetch?: FetchFunction
): Promise<IngestedUrlContent> {
  const ssrfResult = validateUrlForSsrf(url);
  if (!ssrfResult.allowed) {
    throw new UrlIngestionError(`SSRF Protection: ${ssrfResult.reason}`, 400);
  }

  const fetcher = customFetch || globalThis.fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let response: Response;

  try {
    response = await fetcher(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FlyRank-SocialStudio-Bot/1.0 (+https://flyrank.ai)'
      }
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UrlIngestionError('URL fetch timed out after 5000ms', 400);
    }
    throw new UrlIngestionError('Failed to fetch the target URL. Ensure the URL is accessible.', 400);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new UrlIngestionError(`Target URL returned HTTP status ${response.status}`, 400);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
    throw new UrlIngestionError('Target URL did not return text or HTML content', 400);
  }

  const html = await response.text();
  if (html.length > 2 * 1024 * 1024) {
    throw new UrlIngestionError('Response body exceeded maximum allowed size (2MB)', 400);
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Extract text content from body by stripping tags & script/style blocks
  const textContent = html
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!textContent) {
    throw new UrlIngestionError('Extracted empty content from target URL', 400);
  }

  return {
    title: title || 'Ingested Article',
    content: textContent,
    sourceUrl: url
  };
}
