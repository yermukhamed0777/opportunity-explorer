import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

// Fixed public sources only: visitors cannot make the server fetch arbitrary URLs.
export const SOURCES = [
  {
    id: 'studyqa',
    name: 'StudyQA / Стадика',
    kind: 'telegram',
    url: 'https://t.me/studyqa',
    feedUrl: 'https://t.me/s/studyqa',
  },
  {
    id: 'noborders',
    name: 'No Borders Abroad',
    kind: 'telegram',
    url: 'https://t.me/noborders_abroad',
    feedUrl: 'https://t.me/s/noborders_abroad',
  },
  {
    id: 'scholars4dev',
    name: 'Scholars4Dev',
    kind: 'rss',
    url: 'https://www.scholars4dev.com/',
    feedUrl: 'https://www.scholars4dev.com/feed/',
  },
  {
    id: 'opportunitydesk',
    name: 'Opportunity Desk',
    kind: 'rss',
    url: 'https://opportunitydesk.org/',
    feedUrl: 'https://opportunitydesk.org/feed/',
  },
];
const relevant =
  /(scholarship|fellowship|internship|hackathon|olympiad|research|summer school|masters?|bachelor|стипенд|грант|стажиров|хакатон|олимпиад|магистр|бакалавр|исследован|летн.{0,8}школ)/iu;
const advertisement = /(?:#реклама|erid\s*[:=]|sponsored post|advertisement)/iu;
export function safeUrl(value) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      !u.hostname.includes('.') ||
      isIP(u.hostname) ||
      /\.(localhost|local|internal)$/i.test(u.hostname)
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
function clean(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}
function boundedWords(text, n) {
  return clean(text).split(/\s+/u).slice(0, n).join(' ');
}
function classify(text) {
  if (/hackathon|хакатон|game jam/iu.test(text)) return 'Hackathon';
  if (/olympiad|олимпиад/iu.test(text)) return 'Olympiad';
  if (/scholarship|fellowship|стипенд|грант/iu.test(text)) return 'Scholarship';
  if (/internship|стажиров/iu.test(text)) return 'Internship';
  if (/research|исследован|summer school|летн.{0,8}школ/iu.test(text))
    return 'Research';
  return 'Opportunity';
}
function degreeTags(text) {
  const result = [];
  if (/bachelor|undergrad|бакалавр/iu.test(text)) result.push('Undergraduate');
  if (/master|магистр/iu.test(text)) result.push('Master’s');
  if (/ph\.?d|doctor|аспиран/iu.test(text)) result.push('PhD');
  if (/high school|школьник|школьны/iu.test(text)) result.push('High school');
  return result;
}
function item(source, { text, url, publishedAt, links = [], title }) {
  const lead = clean(title || text).replace(/^[\p{P}\p{S}\s]+/gu, '');
  if (
    !relevant.test(text) ||
    advertisement.test(text) ||
    !safeUrl(url) ||
    /^(how to|tips for|guide to|как(?:\s|$)|советы|хотите(?:\s|$)|сохранили(?:\s|$))/iu.test(
      lead,
    ) ||
    /(hot\s+job|job\s+opportunit|vacanc|career\s+opportunit|ваканси)/iu.test(
      lead.slice(0, 180),
    )
  )
    return null;
  if (
    source.kind === 'telegram' &&
    (!relevant.test(lead.slice(0, 200)) ||
      links.some((u) => /\/advisers\/consult-request/i.test(u)))
  )
    return null;
  const date = new Date(publishedAt);
  if (!Number.isFinite(date.valueOf())) return null;
  const head = boundedWords(title || text, 17).slice(0, 160);
  // Short attributed excerpts only; original announcements stay on the source.
  const excerpt = boundedWords(
    title ? clean(text).slice(clean(title).length) : text.slice(head.length),
    8,
  ).slice(0, 100);
  return {
    id: createHash('sha1').update(url).digest('hex').slice(0, 18),
    title: head,
    excerpt,
    url: safeUrl(url),
    publishedAt: date.toISOString(),
    sourceId: source.id,
    sourceName: source.name,
    kind: source.kind,
    type: classify(text),
    degreeTags: degreeTags(text),
    links: [...new Set(links.map(safeUrl).filter(Boolean))]
      .filter((u) => !new URL(u).hostname.endsWith('t.me'))
      .slice(0, 2),
    verified: false,
  };
}
export function parseTelegram(html, source) {
  const $ = load(html);
  const messages = $('.tgme_widget_message');
  if (!messages.length)
    throw new Error('Public channel preview is unavailable');
  const result = [];
  messages.each((_, node) => {
    const el = $(node),
      body = el.find('.tgme_widget_message_text');
    body.find('script,style').remove();
    const post = el.attr('data-post');
    if (!post || !/^\w+\/\d+$/.test(post)) return;
    body.find('br').replaceWith(' ');
    const text = body.text(),
      links = body
        .find('a[href]')
        .map((_, a) => $(a).attr('href'))
        .get();
    const value = item(source, {
      text,
      url: 'https://t.me/' + post,
      publishedAt: el.find('time[datetime]').attr('datetime'),
      links,
    });
    if (value) result.push(value);
  });
  return result;
}
export function parseRss(xml, source) {
  const $ = load(xml, { xmlMode: true });
  const entries = $('item,entry');
  if (!entries.length) throw new Error('No readable RSS or Atom entries');
  const result = [];
  entries.each((_, node) => {
    const el = $(node);
    const title = el.find('title').first().text();
    const description = el.find('description,summary,content').first().text();
    const plain = load(description).text();
    const article = el.find('link[rel="alternate"],link:not([rel])').first();
    const url = article.attr('href') || article.text();
    const publishedAt = el
      .find('pubDate,published,updated,dc\\:date')
      .first()
      .text();
    const value = item(source, {
      title,
      text: title + ' ' + plain,
      url,
      publishedAt,
    });
    if (value) result.push(value);
  });
  return result;
}
export async function readSourceText(response, limit = 2_000_000) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > limit) {
    await response.body?.cancel();
    throw new Error('Source response is too large');
  }
  if (!response.body) throw new Error('Source returned no body');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let size = 0,
    text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('Source response is too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function collectFeeds(
  previous = {},
  fetcher = fetch,
  now = new Date(),
) {
  const prior = previous.items || [];
  const results = await Promise.all(
    SOURCES.map(async (source) => {
      const checkedAt = now.toISOString(),
        oldStatus = (previous.sources || []).find((s) => s.id === source.id);
      try {
        const response = await fetcher(source.feedUrl, {
          headers: {
            'User-Agent':
              'OpportunityExplorer/2.1 (+https://opportunity-explorer-ruddy.vercel.app/)',
            Accept: 'text/html,application/rss+xml,application/xml;q=0.9',
          },
          signal: AbortSignal.timeout(12000),
          redirect: 'follow',
        });
        if (!response.ok)
          throw new Error('Source returned HTTP ' + response.status);
        const body = await readSourceText(response);
        const parsed = (source.kind === 'telegram' ? parseTelegram : parseRss)(
          body,
          source,
        );
        const items = parsed
          .filter((x) => {
            const age = now - new Date(x.publishedAt);
            return age >= -48 * 3600000 && age <= 120 * 86400000;
          })
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
          .slice(0, 20);
        return {
          items,
          status: {
            id: source.id,
            name: source.name,
            url: source.url,
            kind: source.kind,
            status: 'ok',
            checkedAt,
            lastSuccessAt: checkedAt,
            count: items.length,
            message: items.length
              ? 'Public announcements retrieved.'
              : 'Source responded; no recent matching announcements.',
          },
        };
      } catch (error) {
        const items = prior.filter((x) => x.sourceId === source.id);
        return {
          items,
          status: {
            id: source.id,
            name: source.name,
            url: source.url,
            kind: source.kind,
            status: 'unavailable',
            checkedAt,
            lastSuccessAt: oldStatus?.lastSuccessAt || null,
            count: items.length,
            message:
              'Public source could not be read. ' +
              (items.length
                ? 'Showing the last saved items.'
                : 'Use the source link to check directly.'),
          },
        };
      }
    }),
  );
  const seen = new Set(),
    items = results
      .flatMap((r) => r.items)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .filter((x) => {
        if (seen.has(x.url)) return false;
        seen.add(x.url);
        return true;
      })
      .slice(0, 80);
  return {
    schemaVersion: 1,
    refreshedAt: now.toISOString(),
    lastSuccessfulRefresh: results.some((r) => r.status.status === 'ok')
      ? now.toISOString()
      : previous.lastSuccessfulRefresh || null,
    engine: 'vercel-scheduled-feeds',
    schedule: 'Monday mornings, Hong Kong time',
    notice:
      'Automatically collected source announcements. Eligibility, funding and deadlines are not independently verified.',
    sources: results.map((r) => ({
      ...r.status,
      count: items.filter((item) => item.sourceId === r.status.id).length,
    })),
    items,
  };
}
