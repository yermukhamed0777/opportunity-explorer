import { readFileSync, writeFileSync } from 'node:fs';
const p = 'data/curated-intelligence.json',
  c = JSON.parse(readFileSync(p)),
  D = JSON.parse(readFileSync('data/development.json'));
const funding = c.records.find((r) => r.id === 'funding-yenching');
if (funding) {
  funding.name = 'Yenching Academy 2027 entry fellowship · international route';
  funding.eligibility =
    'This November deadline is for international non-Chinese applicants. Hong Kong, Macao and Taiwan applicants have a separate route and January deadline in the official notice. Partner-university preselection may apply.';
  funding.funding.insurance = null;
  funding.funding.travel = 'One round-trip travel fare listed by provider';
  funding.funding.researchAllowance = 'Field-study costs listed by provider';
}
const countries = [
  [
    'Hong Kong',
    'Hong Kong',
    'HKD',
    'East Asia',
    'Cantonese and English; institutional language policies vary',
    'https://www.studyinhongkong.edu.hk/en/live-in-hong-kong/cost-of-living.php',
    'https://www.immd.gov.hk/eng/services/visas/study.html',
    'Approximate provider range checked 12 November 2026: HK$30,000–50,000/year for other living expenses; housing is separate. Provider lists university housing around HK$5,000–15,000/semester. These are planning estimates, not a quote.',
  ],
  [
    'Singapore',
    'Singapore',
    'SGD',
    'Southeast Asia',
    'English is widely used in university instruction; verify each programme',
    'https://nus.edu.sg/gro/global-programmes/student-exchange/incoming-exchangers',
    'https://www.ica.gov.sg/reside/STP/apply',
    'NUS exchange-student planning estimates: S$1,150–2,050/month on campus or S$1,550–3,400 off campus; exclusions and housing assumptions apply. Checked 12 November 2026.',
  ],
  [
    'United Kingdom',
    'London and other university cities',
    'GBP',
    'Europe',
    'English; programme and support options vary',
    'https://study-uk.britishcouncil.org/moving-uk/cost-studying',
    'https://www.gov.uk/student-visa',
    'British Council planning estimates: £1,300–1,400/month in London and £900–1,300 elsewhere; check actual housing and current costs. Checked 12 November 2026.',
  ],
  [
    'United States',
    'Cambridge / Pasadena and other university cities',
    'USD',
    'North America',
    'English; check institution language and support services',
    'https://educationusa.state.gov/your-5-steps-us-study/finance-your-studies',
    'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html',
    null,
  ],
  [
    'Switzerland',
    'Lausanne / Zurich',
    'CHF',
    'Europe',
    'Local and teaching languages vary by canton and programme',
    'https://www.studyinswitzerland.plus/',
    'https://www.sem.admin.ch/sem/en/home/themen/aufenthalt/nicht_eu_efta/aus_weiterbildung.html',
    null,
  ],
  [
    'Australia',
    'Melbourne and other university cities',
    'AUD',
    'Oceania',
    'English; check programme requirements and support',
    'https://www.studyaustralia.gov.au/en/life-in-australia/living-and-education-costs',
    'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
    null,
  ],
  [
    'Canada',
    'Waterloo and other university cities',
    'CAD',
    'North America',
    'English / French contexts vary; Waterloo is primarily English-speaking',
    'https://uwaterloo.ca/future-students/financing/budget-calculator',
    'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html',
    null,
  ],
  [
    'Japan',
    'Kyoto / Sendai',
    'JPY',
    'East Asia',
    'Japanese is important for daily life; teaching language depends on programme',
    'https://www.studyinjapan.go.jp/en/life/livingcost-price/',
    'https://www.studyinjapan.go.jp/en/planning/immigration-procedures/',
    null,
  ],
  [
    'South Korea',
    'Daejeon',
    'KRW',
    'East Asia',
    'Korean for much daily life; verify English-taught programme provision',
    'https://www.studyinkorea.go.kr/en/life/livingExpense.do',
    'https://www.studyinkorea.go.kr/en/plan/visaAndStay.do',
    null,
  ],
  [
    'Kazakhstan',
    'Astana',
    'KZT',
    'Central Asia',
    'Kazakh and Russian; verify each programme’s teaching language',
    'https://nu.edu.kz/',
    'https://www.gov.kz/situations/149/intro?lang=en',
    null,
  ],
  [
    'United Arab Emirates',
    'Abu Dhabi',
    'AED',
    'Middle East',
    'Arabic and English contexts; programme language varies',
    'https://nyuad.nyu.edu/en/campus-life.html',
    'https://u.ae/en/information-and-services/education/higher-education/student-visa',
    null,
  ],
  [
    'India',
    'Mumbai / Chennai',
    'INR',
    'South Asia',
    'English and local languages; programme language varies',
    'https://studyinindia.gov.in/',
    'https://indianvisaonline.gov.in/',
    null,
  ],
  [
    'Ghana',
    'Berekuso',
    'GHS',
    'Africa',
    'English and local languages; verify programme support',
    'https://ashesi.edu.gh/',
    'https://gis.gov.gh/',
    null,
  ],
  [
    'Mexico',
    'Monterrey',
    'MXN',
    'Latin America',
    'Spanish and programme-dependent English provision',
    'https://tec.mx/en',
    'https://www.gob.mx/sre/acciones-y-programas/visa-de-residente-temporal-estudiante',
    null,
  ],
  [
    'New Zealand',
    'Auckland',
    'NZD',
    'Oceania',
    'English; Māori language and cultural context are part of the wider setting',
    'https://www.studywithnewzealand.govt.nz/',
    'https://www.immigration.govt.nz/study/',
    null,
  ],
  [
    'South Africa',
    'Cape Town',
    'ZAR',
    'Africa',
    'Multilingual environment; check programme and student support',
    'https://uct.ac.za/',
    'https://www.dha.gov.za/',
    null,
  ],
  [
    'Brazil',
    'São Paulo',
    'BRL',
    'Latin America',
    'Portuguese is important for daily life and many programmes',
    'https://www.usp.br/internationaloffice/en/',
    'https://www.gov.br/mre/en/consular-services/visa',
    null,
  ],
  [
    'Finland',
    'Espoo',
    'EUR',
    'Europe',
    'Finnish and Swedish local contexts; English provision varies by programme',
    'https://www.studyinfinland.fi/',
    'https://migri.fi/en/studying-in-finland',
    null,
  ],
];
let i = 0,
  checks = new Map();
const urls = [...new Set(countries.flatMap((x) => [x[5], x[6]]))];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
        checks.set(u, r.ok);
        await r.body?.cancel();
      } catch {
        checks.set(u, false);
      }
    }
  }),
);
for (const [
  country,
  city,
  currency,
  region,
  languages,
  study,
  visa,
  cost,
] of countries) {
  const id = 'location-' + country.toLowerCase().replace(/[^a-z]+/g, '-');
  if (c.records.some((r) => r.id === id)) continue;
  if (!checks.get(study) || !checks.get(visa)) {
    c.reviewQueue.push({
      id,
      name: country + ' location guide',
      reason: 'Official study or immigration source needs review.',
      sources: [
        ['Study', study],
        ['Government visa information', visa],
      ],
    });
    continue;
  }
  c.records.push({
    id,
    kind: 'location',
    name: city + ' · student planning guide',
    country,
    city,
    currency,
    region,
    fieldIds: [],
    checkedOn: '2026-11-12',
    costRange: cost,
    guide: {
      Languages: languages,
      'Climate and travel preparation':
        'Check the local meteorological service and institution’s arrival guide for seasonal conditions and warnings. No city-specific climate statistic has been independently established here.',
      'Academic calendar':
        'Calendars vary by institution, course and intake. Confirm teaching, examination and vacation dates before booking travel.',
      Transport:
        'Compare the actual campus commute, public transport access and accessibility before choosing housing. Use institutional transport guidance.',
      Housing:
        'Contact the official housing office early. Compare university and private options, deposits, contract dates and accessibility; no housing allocation is guaranteed.',
      Healthcare:
        'Confirm insurance obligations, campus health support and eligibility for local services before arrival.',
      'International-student support':
        'Use the institution’s official international office, orientation, disability/accessibility service and student-advice channels.',
      'Campus surroundings and culture':
        'Review the specific campus and local community, student organizations and a realistic commute. This country-level guide does not characterize every neighbourhood.',
      'Safety resources':
        'Use official campus security, government emergency guidance and travel advice; no city is declared risk-free.',
      'Part-time work':
        'Check the linked official government source for your exact visa conditions, programme and employer requirements. No work entitlement is inferred.',
      'Post-study context':
        'Consult the current official government pathways and eligibility conditions. Graduation does not guarantee a work visa.',
      'Planning questions':
        'Check teaching language, laboratory access, disability accommodations, total budget, academic dates and support before deciding.',
    },
    limitations:
      'Dated source-linked planning guide, not immigration, healthcare, financial or legal advice. Unestablished details are explicitly identified. Budget ranges are approximate and are not visa financial thresholds.',
    sources: [
      ['Official study / institution planning source', study],
      ['Official government immigration context', visa],
    ],
    verification:
      'Study and government-source links checked. Detailed legal entitlements and unsupported cost estimates are not asserted.',
  });
}
const admissions = {
  cityu: 'https://www.cityu.edu.hk/admo/',
  hkust: 'https://join.hkust.edu.hk/',
  nus: 'https://nus.edu.sg/oam/',
  ntu: 'https://www.ntu.edu.sg/admissions',
  mit: 'https://mitadmissions.org/',
  epfl: 'https://www.epfl.ch/education/admission/',
  eth: 'https://ethz.ch/en/studies.html',
  imperial: 'https://www.imperial.ac.uk/study/apply/',
  caltech: 'https://www.admissions.caltech.edu/',
  monash: 'https://www.monash.edu/admissions',
  uct: 'https://uct.ac.za/students/applications',
  usp: 'https://www.usp.br/internationaloffice/en/',
};
await Promise.all(
  Object.entries(admissions).map(async ([id, url]) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        c.universityEnrichment[id] = {
          ...c.universityEnrichment[id],
          admissions: {
            'Official admissions / international-study portal': url,
          },
        };
      }
      await r.body?.cancel();
    } catch {}
  }),
);
writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
console.log(
  JSON.stringify({
    locations: c.records.filter((x) => x.kind === 'location').length,
    reviewQueue: c.reviewQueue.length,
  }),
);
