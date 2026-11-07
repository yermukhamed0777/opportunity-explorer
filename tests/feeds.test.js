import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTelegram,
  parseRss,
  collectFeeds,
  readSourceText,
  safeUrl,
  SOURCES,
} from '../lib/feeds.js';
import { authorized } from '../api/refresh.js';
const channel = SOURCES[0];
const telegram = `<div class="tgme_widget_message" data-post="studyqa/123"><div class="tgme_widget_message_text">Master scholarship in engineering at a university. Applications are available for international graduates.<script>secret bad script</script><a href="javascript:alert(1)">unsafe</a><a href="https://university.edu/funding">Provider</a></div><a class="tgme_widget_message_date"><time datetime="2026-11-01T10:00:00Z"></time></a></div><div class="tgme_widget_message" data-post="studyqa/124"><div class="tgme_widget_message_text">Scholarship advert #реклама erid=xyz</div><time datetime="2026-11-01T10:00:00Z"></time></div>`;
const rss = `<rss><channel><item><title>Engineering Master Scholarship 2027</title><link>https://example.edu/funding</link><pubDate>Sun, 01 Nov 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Funding details are available on the provider website.</p>]]></description></item><item><title>How to prepare for a scholarship interview</title><link>https://example.edu/tips</link><pubDate>Sun, 01 Nov 2026 12:00:00 GMT</pubDate></item></channel></rss>`;
test('public channel parsing rejects adverts and executable links, keeps source and date', () => {
  const records = parseTelegram(telegram, channel);
  assert.equal(records.length, 1);
  assert.equal(records[0].url, 'https://t.me/studyqa/123');
  assert.equal(records[0].publishedAt, '2026-11-01T10:00:00.000Z');
  assert.deepEqual(records[0].degreeTags, ['Master’s']);
  assert.deepEqual(records[0].links, ['https://university.edu/funding']);
  assert.equal(records[0].verified, false);
  assert(!records[0].title.includes('script'));
  assert(
    records[0].title.split(/\s+/).length +
      records[0].excerpt.split(/\s+/).length <=
      25,
  );
});
test('RSS accepts actual opportunities and excludes advice articles', () => {
  const records = parseRss(rss, SOURCES[2]);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'Scholarship');
  assert.equal(records[0].url, 'https://example.edu/funding');
});
test('unavailable source pages are not reported as a successful empty fetch', () => {
  assert.throws(() => parseTelegram('<html>Site unavailable</html>', channel));
});
test('Telegram omits consulting promotions and emoji-prefixed advice', () => {
  const post = (text) =>
    `<div class="tgme_widget_message" data-post="studyqa/987"><div class="tgme_widget_message_text">${text}</div><time datetime="2026-11-01T10:00:00Z"></time></div>`;
  assert.equal(
    parseTelegram(
      post('✨Как попасть на стажировку? Подробный гид по подаче.'),
      channel,
    ).length,
    0,
  );
  assert.equal(
    parseTelegram(
      post(
        '🌍 Стипендия на магистратуру. <a href="https://stadika.ru/advisers/consult-request">Консультация</a>',
      ),
      channel,
    ).length,
    0,
  );
  assert.equal(
    parseTelegram(
      post(
        'Новая иностранная карта для оплаты. ' +
          'Банковское обслуживание. '.repeat(15) +
          'Стипендии и магистратура.',
      ),
      channel,
    ).length,
    0,
  );
});
test('invalid external URL protocols and credentials are rejected', () => {
  for (const url of [
    'javascript:alert(1)',
    'http://example.com',
    'https://user:pass@example.com',
    'https://127.0.0.1/x',
    'https://192.168.1.1',
  ])
    assert.equal(safeUrl(url), null);
  assert.equal(safeUrl('https://university.edu/x'), 'https://university.edu/x');
});
test('source outage retains saved announcements and last success date', async () => {
  const previous = {
    lastSuccessfulRefresh: '2026-11-01T00:00:00Z',
    items: parseTelegram(telegram, channel),
    sources: [{ id: 'studyqa', lastSuccessAt: '2026-11-01T00:00:00Z' }],
  };
  const result = await collectFeeds(
    previous,
    async () => {
      throw Error('offline');
    },
    new Date('2026-11-06T00:00:00Z'),
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.lastSuccessfulRefresh, previous.lastSuccessfulRefresh);
  assert(result.sources.every((s) => s.status === 'unavailable'));
  assert.equal(
    result.sources[0].lastSuccessAt,
    previous.sources[0].lastSuccessAt,
  );
});
test('successful sources merge and deduplicate without inventing verified details', async () => {
  const result = await collectFeeds(
    {},
    async (url) =>
      new Response(url.startsWith('https://t.me') ? telegram : rss),
    new Date('2026-11-06T00:00:00Z'),
  );
  assert.equal(result.items.length, 2);
  assert(result.items.every((r) => r.verified === false));
  assert(result.sources.every((s) => s.status === 'ok'));
  assert.equal(result.lastSuccessfulRefresh, '2026-11-06T00:00:00.000Z');
});
test('refresh endpoint authorization requires the exact configured secret', () => {
  assert.equal(authorized('Bearer test-value', 'test-value'), true);
  for (const [h, s] of [
    ['Bearer wrong', 'test-value'],
    ['test-value', 'test-value'],
    [undefined, 'test-value'],
    ['Bearer ', undefined],
  ])
    assert.equal(authorized(h, s), false);
});

test('source bodies are limited by bytes, including streamed and declared sizes', async () => {
  await assert.rejects(readSourceText(new Response('é'.repeat(20)), 30));
  await assert.rejects(
    readSourceText(
      new Response('small', { headers: { 'Content-Length': '100' } }),
      30,
    ),
  );
  assert.equal(await readSourceText(new Response('readable'), 30), 'readable');
});
test('Atom feeds use alternate article links instead of self links', () => {
  const xml =
    '<feed><entry><title>Master scholarship 2027</title><link rel="self" href="https://example.edu/feed"/><link rel="alternate" href="https://example.edu/scholarship"/><updated>2026-11-06T00:00:00Z</updated><summary>Applications open.</summary></entry></feed>';
  assert.equal(
    parseRss(xml, SOURCES[2])[0].url,
    'https://example.edu/scholarship',
  );
});
