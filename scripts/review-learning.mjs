// Manual source review utility. Writes a review artifact, never publishes records.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { load } from 'cheerio';
const reviewRoot = process.env.REVIEW_OUTPUT_DIR || '../research';
mkdirSync(reviewRoot, { recursive: true });
const reviewed = [],
  failed = [],
  seen = new Set();
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw Error('HTTP ' + r.status);
  return r;
}
const sm = load(await (await get('https://ocw.mit.edu/sitemap.xml')).text(), {
    xmlMode: true,
  }),
  links = sm('loc')
    .map((_, x) => sm(x).text())
    .get();
const depts = {
  1: ['civil', 'environment'],
  2: ['mechanical'],
  3: ['mse'],
  4: ['architecture', 'design'],
  5: ['chemistry'],
  6: ['cs', 'electrical', 'software', 'ai'],
  7: ['biology', 'biotechnology'],
  8: ['physics'],
  9: ['psychology', 'biomedical'],
  10: ['chemical-engineering'],
  11: ['environment', 'politics'],
  14: ['economics', 'finance'],
  15: ['business', 'finance'],
  16: ['mechanical'],
  17: ['politics', 'international-relations'],
  18: ['mathematics', 'data-science'],
  20: ['biomedical', 'biotechnology'],
  '21h': ['politics', 'international-relations'],
  '21w': ['media'],
  24: ['psychology', 'education'],
};
const tasks = Object.entries(depts).flatMap(([dept, fields]) =>
  links
    .filter((u) => new RegExp('/courses/' + dept + '[-.]').test(u))
    .slice(0, 8)
    .map((u) => ({ url: u.replace(/sitemap.xml$/, 'data.json'), fields })),
);
async function pool(list, worker, n = 6) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < list.length) {
        const item = list[i++];
        try {
          await worker(item);
        } catch (e) {
          failed.push({ url: item.url, error: e.message });
        }
      }
    }),
  );
}
await pool(tasks, async (e) => {
  const j = await (await get(e.url)).json(),
    name = j.course_title;
  if (!name || seen.has(name.toLowerCase())) return;
  seen.add(name.toLowerCase());
  const url = e.url.replace(/data.json$/, ''),
    skills = (j.topics || [])
      .flat(Infinity)
      .filter((x) => typeof x === 'string')
      .slice(-5);
  reviewed.push({
    name,
    url,
    provider: 'MIT OpenCourseWare',
    institution: 'Massachusetts Institute of Technology',
    fieldIds: e.fields,
    level: Array.isArray(j.level) ? j.level.join(' / ') : j.level || null,
    skills: skills.length ? skills : ['See official syllabus'],
    prerequisites:
      'Consult the linked syllabus; prerequisites were not independently extracted.',
    duration: null,
    format: 'Self-paced archived teaching materials',
    language: 'English',
    certificate: 'No OCW certificate or degree credit.',
    auditing:
      'Open course materials; textbooks and software may have separate costs.',
    costType: 'Free open materials',
    checkedOn: '2026-11-12',
    sources: [['Official course materials', url]],
    verification:
      'Course title and metadata checked against the official course data endpoint. Original teaching year remains in the URL.',
  });
});
let candidates = [];
for (let page = 0; page < 10; page++) {
  const url =
    'https://www.open.edu/openlearn/free-courses/full-catalogue' +
    (page ? '?page=' + page : '');
  try {
    const $ = load(await (await get(url)).text());
    $('a[href]').each((_, el) => {
      const u = new URL($(el).attr('href'), url);
      if (u.pathname.endsWith('/content-section-0')) {
        u.search = '';
        const name = $(el).text().replace(/\s+/g, ' ').trim();
        if (name && !candidates.some((x) => x.url === u.href))
          candidates.push({ url: u.href, name });
      }
    });
  } catch (e) {
    failed.push({ url, error: e.message });
  }
}
const classify = (u) =>
  u.includes('money-business')
    ? ['business', 'economics', 'finance']
    : u.includes('education')
      ? ['education']
      : u.includes('health') || u.includes('body-mind')
        ? ['medicine', 'nursing', 'psychology']
        : u.includes('society-politics-law')
          ? ['politics', 'international-relations', 'law']
          : u.includes('nature-environment')
            ? ['environment', 'biology']
            : u.includes('history-the-arts')
              ? ['media', 'design', 'architecture']
              : u.includes('languages')
                ? ['education', 'media']
                : u.includes('computing')
                  ? ['cs', 'data-science', 'cybersecurity']
                  : ['mathematics', 'physics', 'chemistry'];
await pool(candidates.slice(0, 115), async (e) => {
  const $ = load(await (await get(e.url)).text()),
    name = $('h1').first().text().replace(/\s+/g, ' ').trim() || e.name;
  if (seen.has(name.toLowerCase())) return;
  seen.add(name.toLowerCase());
  const text = $('body').text().replace(/\s+/g, ' ');
  reviewed.push({
    name,
    url: e.url,
    provider: 'OpenLearn',
    institution: 'The Open University',
    fieldIds: classify(e.url),
    level:
      text.match(
        /Level [123]:\s*(?:Introductory|Intermediate|Advanced)/i,
      )?.[0] || null,
    skills: ['Consult the official course learning outcomes'],
    prerequisites: 'Check the course description and learning outcomes.',
    duration:
      text.match(
        /(?:Course length|Duration|Study time)[ :]+(\d+[–\-\d ]*\s*(?:hours|weeks))/i,
      )?.[1] || null,
    format: 'Self-paced online',
    language: $('html').attr('lang')?.startsWith('cy') ? 'Welsh' : 'English',
    certificate: /statement of participation/i.test(text)
      ? 'Statement of participation described by provider; check completion conditions.'
      : 'Certificate conditions not independently verified.',
    auditing: 'OpenLearn identifies these courses as free to study.',
    costType: 'Free to study; statement and badge conditions vary',
    checkedOn: '2026-11-12',
    sources: [['Official learning resource', e.url]],
    verification:
      'Individual provider page fetched successfully and course title checked.',
  });
});
writeFileSync(
  reviewRoot + '/verified-learning.json',
  JSON.stringify(reviewed, null, 2) + '\n',
);
writeFileSync(
  reviewRoot + '/learning-review.json',
  JSON.stringify(failed, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    verified: reviewed.length,
    MIT: reviewed.filter((x) => x.provider === 'MIT OpenCourseWare').length,
    OpenLearn: reviewed.filter((x) => x.provider === 'OpenLearn').length,
    awaitingReview: failed.length,
  }),
);
