// Reviewed editorial inputs. Network validation stages failed sources instead of publishing them.
import { readFileSync, writeFileSync } from 'node:fs';
const date = '2026-11-12',
  D = JSON.parse(readFileSync('data/development.json')),
  R = JSON.parse(readFileSync('data/resources.json')),
  records = [],
  reviewQueue = [];
const make = (kind, id, name, extra) => ({
  kind,
  id,
  name,
  checkedOn: date,
  ...extra,
});
const source = (label, url) => [label, url];
const universities = [
  [
    'kaist',
    'KAIST',
    'South Korea',
    'Daejeon',
    'East Asia',
    ['mse', 'electrical', 'cs', 'ai'],
    'Materials research includes energy storage, thin films, characterization and computational materials laboratories.',
    'Use the department laboratory directory to identify supervised research directions; individual lab access is not guaranteed.',
    'https://mse.kaist.ac.kr/?mid=mse_lab_en',
    'https://admission.kaist.ac.kr/intl-graduate/Discover/ExplorePrograms',
  ],
  [
    'nazarbayev',
    'Nazarbayev University',
    'Kazakhstan',
    'Astana',
    'Central Asia',
    ['mse', 'biotechnology', 'environment'],
    'National Laboratory Astana includes computational materials, renewable-energy and life-science research.',
    'Explore energy and advanced-materials research groups and contact official programme offices about supervised student participation.',
    'https://nu.edu.kz/research/capabilities/research-centers/',
    'https://nu.edu.kz/admissions/',
  ],
  [
    'iit-bombay',
    'Indian Institute of Technology Bombay',
    'India',
    'Mumbai',
    'South Asia',
    ['mse', 'electrical', 'mechanical'],
    'The Centre of Excellence in Nanoelectronics and nanofabrication infrastructure support devices, circuits and related research.',
    'The official facility describes research access and training; participation depends on programme, project and facility rules.',
    'https://www.iitbnf.iitb.ac.in/iitbnf/about-iitbnf/cen.php',
    'https://acad.iitb.ac.in/admissions',
  ],
  [
    'nyuad',
    'NYU Abu Dhabi',
    'United Arab Emirates',
    'Abu Dhabi',
    'Middle East',
    ['physics', 'cs', 'economics', 'media'],
    'Undergraduate research runs across academic divisions, with a research-intensive senior capstone.',
    'Students undertake mentored capstone work and may explore competitive summer-research or conference grants.',
    'https://nyuad.nyu.edu/en/academics/undergraduate/undergraduate-research.html',
    'https://nyuad.nyu.edu/en/admissions.html',
  ],
  [
    'waterloo',
    'University of Waterloo',
    'Canada',
    'Waterloo',
    'North America',
    ['mechanical', 'software', 'cs', 'business'],
    'The university combines academic study with structured co-operative work terms and programme-specific applied projects.',
    'Co-op students alternate study with supervised work terms, subject to programme progression, job approval and work authorization.',
    'https://uwaterloo.ca/co-operative-education/about-co-op',
    'https://uwaterloo.ca/future-students/admissions',
  ],
  [
    'kaust',
    'King Abdullah University of Science and Technology',
    'Saudi Arabia',
    'Thuwal',
    'Middle East',
    ['mse', 'chemistry', 'biomedical', 'cs', 'environment'],
    'Core Labs include imaging and characterization, nanofabrication, bioscience, analytical chemistry, prototyping and computational facilities.',
    'Research training and shared facilities support graduate research and approved projects; booking and safety conditions apply.',
    'https://corelabs.kaust.edu.sa/labs',
    'https://admissions.kaust.edu.sa/',
  ],
  [
    'kyoto',
    'Kyoto University',
    'Japan',
    'Kyoto',
    'East Asia',
    ['mse', 'chemistry', 'biology'],
    'iCeMS connects cell-material science with interdisciplinary research on materials and biological systems.',
    'Explore research groups and programme-specific student research routes; a laboratory listing does not guarantee a position.',
    'https://www.icems.kyoto-u.ac.jp/en/',
    'https://www.kyoto-u.ac.jp/en/education-campus/education-and-admissions',
  ],
  [
    'tohoku',
    'Tohoku University',
    'Japan',
    'Sendai',
    'East Asia',
    ['mse', 'physics', 'mathematics'],
    'AIMR connects materials research with mathematical approaches and international research collaboration.',
    'Use the institute research-group information alongside official university admissions and student programmes.',
    'https://www.wpi-aimr.tohoku.ac.jp/en/',
    'https://www.tohoku.ac.jp/en/academics/admissions.html',
  ],
  [
    'polyu',
    'The Hong Kong Polytechnic University',
    'Hong Kong',
    'Hong Kong',
    'East Asia',
    ['mechanical', 'civil', 'mse', 'design'],
    'The Industrial Centre supports practical engineering learning, manufacturing technologies and interdisciplinary projects.',
    'Explore supervised technical training and project facilities through the Industrial Centre and your department.',
    'https://www.polyu.edu.hk/ic/',
    'https://www.polyu.edu.hk/study/',
  ],
  [
    'hku',
    'The University of Hong Kong',
    'Hong Kong',
    'Hong Kong',
    'East Asia',
    ['mechanical', 'electrical', 'cs', 'design'],
    'Innovation Academy and Innovation Wing support hands-on engineering projects, making and interdisciplinary activity.',
    'Check student membership, induction and project rules before assuming access to particular equipment.',
    'https://innoacademy.engg.hku.hk/',
    'https://admissions.hku.hk/',
  ],
  [
    'aalto',
    'Aalto University',
    'Finland',
    'Espoo',
    'Europe',
    ['design', 'business', 'mechanical'],
    'Design Factory connects interdisciplinary product development, prototyping and collaboration.',
    'Explore project-based learning and maker-oriented collaboration; course and workspace access depend on membership and programme rules.',
    'https://designfactory.aalto.fi/',
    'https://www.aalto.fi/en/admission-services',
  ],
  [
    'ashesi',
    'Ashesi University',
    'Ghana',
    'Berekuso',
    'Africa',
    ['mechanical', 'electrical', 'cs', 'business'],
    'The engineering curriculum uses interdisciplinary design, practical tools and team projects.',
    'Senior projects may combine disciplines and supervised industry-linked problem solving.',
    'https://ashesi.edu.gh/wp-content/uploads/2025/07/Ashesi_Academic_Catalog_2024_25_compressed.pdf',
    'https://ashesi.edu.gh/admissions/',
  ],
  [
    'tecmx',
    'Tecnológico de Monterrey',
    'Mexico',
    'Monterrey',
    'Latin America',
    ['mechanical', 'business', 'biotechnology'],
    'The official research programme connects scientific and technological work with interdisciplinary research areas.',
    'Inspect individual research groups and campus-specific student projects before choosing a programme.',
    'https://tec.mx/en/research',
    'https://tec.mx/en/admissions-and-scholarships',
  ],
  [
    'iitm',
    'Indian Institute of Technology Madras',
    'India',
    'Chennai',
    'South Asia',
    ['mechanical', 'electrical', 'mse'],
    'The official research overview describes engineering and science research, centres and collaboration.',
    'Explore department laboratories and project routes through official academic offices; access is programme-specific.',
    'https://www.iitm.ac.in/research',
    'https://www.iitm.ac.in/academics/study-at-iitm',
  ],
  [
    'auckland',
    'University of Auckland',
    'New Zealand',
    'Auckland',
    'Oceania',
    ['mechanical', 'biomedical', 'environment'],
    'The university research portal connects research institutes, facilities and interdisciplinary activity.',
    'Use faculty research and student programme pages to identify supervised projects and research study routes.',
    'https://www.auckland.ac.nz/en/research.html',
    'https://www.auckland.ac.nz/en/study/applications-and-admissions.html',
  ],
  [
    'nus-yale',
    'Yale-NUS historical programme watchlist',
    'Singapore',
    'Singapore',
    'Southeast Asia',
    [],
    null,
    null,
    null,
    null,
  ],
].filter((x) => x[6]);
for (const [
  id,
  name,
  country,
  city,
  region,
  fields,
  research,
  experience,
  url,
  admission,
] of universities)
  records.push(
    make('university', 'university-' + id, name, {
      country,
      city,
      region,
      fieldIds: fields,
      institutionType:
        id === 'nyuad'
          ? 'International liberal-arts and research campus'
          : id === 'ashesi'
            ? 'Liberal-arts-oriented university with engineering'
            : 'University / technical or research institution; consult official profile',
      research,
      experience,
      campus: city,
      partnership:
        'No specific dual-degree or exchange partnership is asserted here. Verify current agreements with the programme or international office.',
      interdisciplinary:
        'The cited research or teaching initiative connects relevant disciplines; programme flexibility is subject to faculty rules.',
      admissions: { 'Official admissions and programme routes': admission },
      careerServices:
        'Use official institution career and student-service pages; placement is not guaranteed.',
      locationSummary: `Explore the ${city} location guide and institutional housing, transport and international-student resources.`,
      locationId: 'location-' + country.toLowerCase().replace(/[^a-z]+/g, '-'),
      note: 'Capabilities are documented; individual access, supervision, places, funding and admission are not guaranteed.',
      sources: [
        source('Official research / student capability source', url),
        source('Official admissions / programme routes', admission),
      ],
      verification:
        'Official capability and admissions links checked; unverified subcategories are explicitly not asserted.',
    }),
  );
const leaders = [
  [
    'lisa-su',
    'Lisa Su',
    'AMD chair and chief executive officer',
    'AMD',
    ['mse', 'electrical', 'business'],
    'Electrical-engineering bachelor’s, master’s and doctorate degrees at MIT.',
    'Texas Instruments, IBM and Freescale leadership and technical roles before AMD.',
    'Joined AMD in 2012; became CEO in 2014; the company biography describes technical and operating leadership.',
    'https://ir.amd.com/governance/board-of-directors',
    'A progression from device and semiconductor research into product and organizational responsibility is documented. A student can practise connecting technical evidence with a clear product constraint; this does not establish why the appointment or company outcomes occurred.',
    'A semiconductor-data analysis with a short recommendation memo.',
  ],
  [
    'jensen-huang',
    'Jensen Huang',
    'NVIDIA co-founder, president and chief executive officer',
    'NVIDIA',
    ['electrical', 'cs', 'business'],
    'BSEE at Oregon State University and MSEE at Stanford University.',
    'AMD and LSI Logic roles before NVIDIA.',
    'Founded NVIDIA in 1993 and has held its president and CEO roles since founding, according to the company biography.',
    'https://www.nvidia.com/en-us/about-nvidia/board-of-directors/jensen-huang/',
    'The source documents semiconductor experience before founding and long-term organizational responsibility. Distinguish a technical product idea, the team needed to execute it and the business assumptions. Founder outcomes also depend on resources, timing and institutions that a student cannot recreate by copying a résumé.',
    'A small computing prototype with measured performance and explicit tradeoffs.',
  ],
  [
    'fei-fei-li',
    'Fei-Fei Li',
    'Stanford professor and publicly documented AI research leader',
    'Stanford University',
    ['ai', 'cs', 'physics'],
    'Physics BA at Princeton; electrical-engineering PhD at Caltech.',
    'Stanford AI Lab director and Google Cloud AI/ML leadership roles are described in the Stanford profile.',
    'The institutional profile documents ImageNet, Stanford HAI and World Labs work.',
    'https://www.cs.stanford.edu/people/fei-fei-li',
    'The documented work connects dataset construction, research evaluation and organizational collaboration. A realistic student lesson is to define a dataset and evaluation protocol carefully, then inspect whose needs and errors are represented. It is not evidence that one dataset or degree caused a leadership outcome.',
    'A bounded public-data evaluation project with a model card and bias discussion.',
  ],
  [
    'frances-arnold',
    'Frances Arnold',
    'Publicly documented Caltech researcher and directed-evolution pioneer',
    'California Institute of Technology',
    ['biotechnology', 'chemical-engineering', 'chemistry'],
    'Mechanical and aerospace engineering at Princeton; chemical-engineering PhD at UC Berkeley.',
    'Solar-energy research preceded graduate work and Caltech research.',
    'Her Nobel autobiography describes a move from energy research to chemical engineering and directed enzyme evolution.',
    'https://www.nobelprize.org/prizes/chemistry/2018/arnold/biographical/',
    'The autobiography documents changes in funding and research direction, followed by learning unfamiliar methods. Students can practise updating a research question when constraints change. Laboratory resources, mentorship and historical circumstances matter; the appropriate beginner activity is a literature or computational study, not unsupervised genetic experimentation.',
    'An evidence map comparing how research questions and methods changed over time.',
  ],
];
for (const [
  id,
  name,
  role,
  organization,
  fields,
  education,
  previousRoles,
  work,
  url,
  analysis,
  lesson,
] of leaders)
  records.push(
    make('professional', 'professional-' + id, name, {
      role,
      organization,
      fieldIds: fields,
      contentType: 'Leadership analysis',
      education,
      previousRoles,
      facts: [
        { text: role, source: url },
        { text: education, source: url },
        { text: previousRoles, source: url },
        { text: work, source: url },
      ],
      analysis,
      analysisDetails: {
        'Problem / industry':
          'See the verified work above; the analysis focuses on the documented technical or institutional setting.',
        Transitions:
          'The education and selected role transitions above are documented. They are not a required sequence.',
        'Technical practice': lesson,
        'Communication and leadership':
          'Interpretation: practise explaining decisions, responding to critique and documenting your own contribution.',
        'Institutional advantages':
          'The named institutions and employers are documented; the source does not quantify access advantages or their causal effect.',
        'Risks and evidence gaps':
          id === 'frances-arnold'
            ? 'The autobiography describes funding and research-direction changes. Do not generalize one account to every researcher.'
            : 'The selected biography does not provide a complete failure history, decision record or causal evaluation.',
        'What cannot be copied':
          'Historical timing, institutional resources, team contributions and senior responsibilities are not reproduced by copying a CV.',
      },
      limitations:
        'Public-source summary and labelled editorial interpretation. No endorsement, private CV, success guarantee or causal claim. Role information can change.',
      sources: [source('Intentional public institutional biography', url)],
      projectIds: ['project-' + fields[0] + '-1'],
      courseIds: D.skillMaps.find((m) => m.fieldId === fields[0]).courses,
    }),
  );
const people = JSON.parse(readFileSync('../research/nobel-profiles.json'))
  .filter((p) => p.status === 200 && p.year !== '2001')
  .slice(0, 21);
for (const p of people) {
  const fields =
    p.category === 'Economic Sciences'
      ? ['economics', 'finance']
      : p.category === 'Physiology or Medicine'
        ? ['medicine', 'biotechnology']
        : p.category === 'Chemistry'
          ? ['chemistry', 'mse', 'biotechnology']
          : ['physics', 'ai'];
  const topic =
    p.category === 'Economic Sciences'
      ? p.year === '2024'
        ? 'institutions and economic prosperity'
        : p.year === '2023'
          ? 'women’s labour-market outcomes'
          : 'banks and financial crises'
      : p.category === 'Physiology or Medicine'
        ? p.year === '2024'
          ? 'microRNA and gene regulation'
          : p.year === '2023'
            ? 'modified mRNA and vaccine research'
            : 'ancient genomes and human evolution'
        : p.category === 'Chemistry'
          ? p.year === '2024'
            ? p.name === 'David Baker'
              ? 'computational protein design'
              : 'protein-structure prediction'
            : p.year === '2023'
              ? 'quantum dots'
              : 'click and bioorthogonal chemistry'
          : p.year === '2024'
            ? 'neural-network methods in machine learning'
            : p.year === '2023'
              ? 'attosecond methods for electron dynamics'
              : 'quantum entanglement experiments';
  records.push(
    make('professional', 'professional-nobel-' + p.id, p.name.trim(), {
      role: 'Publicly documented ' + p.year + ' Nobel-recognized work',
      organization: (p.affiliation || []).join(' / ') + ' (at the cited award)',
      fieldIds: fields,
      contentType: 'Public professional profile',
      education: null,
      previousRoles: null,
      facts: [
        {
          text: `The official ${p.year} award record recognizes work in ${p.category.toLowerCase()}.`,
          source: p.url,
        },
        {
          text: `The cited record documents contributions related to ${topic}.`,
          source: p.url,
        },
        {
          text:
            'Award-time affiliation: ' +
            (p.affiliation || ['Not listed']).join(' / '),
          source: p.url,
        },
      ],
      analysis: `Interpretation: study how a question about ${topic} was turned into methods and evidence. Reconstruct one limited result or explain one published method, and distinguish your own contribution from the original team’s work. An award is not proof that a particular degree, personality or activity caused success.`,
      analysisDetails: {
        'Student-scale lesson':
          'Begin with a literature or public-data project and document an uncertainty or competing explanation.',
        'Evidence boundary':
          'This is a verified public-work profile, not a complete career biography. Education and earlier roles are not inferred from an award affiliation.',
        'What cannot be copied':
          'The original research resources, collaborators, historical opportunity and award selection are not a repeatable recipe.',
      },
      limitations:
        'Only the stated public work and award-time affiliation are summarized. Education, full career history, failures and current appointments require additional primary-source review. No endorsement or guarantee.',
      sources: [source('Official award and public-work record', p.url)],
      projectIds: ['project-' + fields[0] + '-1'],
      courseIds: D.skillMaps.find((m) => m.fieldId === fields[0]).courses,
      verification:
        'Public work and award-time affiliation verified; career-history gaps are explicit.',
    }),
  );
}
const funding = [
  [
    'hkpfs',
    'Hong Kong PhD Fellowship Scheme 2027/28',
    'Research Grants Council',
    'Hong Kong',
    ['PhD or doctoral degree'],
    'Applicants pursuing a new full-time PhD at a participating Hong Kong university; check programme and applicant rules.',
    'https://www.ugc.edu.hk/eng/rgc/funding_opport/hkpfs/index.html',
    {
      stipend: 'Provider lists stipend support; confirm the 2027/28 amount.',
      travel:
        'Conference / research-related travel support; confirm current amount.',
      tuition: null,
      accommodation: null,
      insurance: null,
      researchAllowance: null,
      coverage: 'Fellowship support; university arrangements vary',
      amount: null,
    },
    'Open',
    '2026-12-01',
    '2026-12-01T12:00:00+08:00',
    'https://cerg1.ugc.edu.hk/hkpfs/InitApplication.jsp',
  ],
  [
    'yenching',
    'Yenching Academy 2027 entry fellowship · international route',
    'Peking University',
    'China',
    ['Master’s degree', 'Recent graduate'],
    'This November deadline is for international non-Chinese applicants. Hong Kong, Macao and Taiwan applicants have a separate route and date in the official notice; partner-university preselection may apply.',
    'https://yenchingacademy.pku.edu.cn/ADMISSIONS.htm',
    {
      tuition: true,
      stipend: true,
      travel: null,
      accommodation: true,
      insurance: true,
      researchAllowance: null,
      coverage:
        'Provider fellowship; check current components and renewal rules',
      amount: null,
    },
    'Open',
    '2026-11-30',
    '2026-11-30T09:00:00+08:00',
    'https://yenchingacademy.pku.edu.cn/ADMISSIONS.htm',
  ],
  [
    'stipendium',
    'Stipendium Hungaricum',
    'Tempus Public Foundation',
    'Hungary',
    ['Undergraduate degree', 'Master’s degree', 'PhD or doctoral degree'],
    'Eligibility and offered programmes depend on sending-partner agreements and applicant background.',
    'https://stipendiumhungaricum.hu/apply/',
    {
      tuition: true,
      stipend: true,
      travel: null,
      accommodation: 'Contribution or dormitory conditions vary',
      insurance: 'Programme healthcare provisions; check current call',
      researchAllowance: null,
      coverage: 'Benefits may not cover all living expenses',
      amount: null,
    },
    'Expected to reopen',
    null,
    null,
    null,
  ],
  [
    'daad',
    'DAAD scholarships',
    'German Academic Exchange Service',
    'Germany',
    ['Master’s degree', 'PhD or doctoral degree', 'Recent graduate'],
    'Programme-specific awards for graduates, doctoral researchers and other eligible applicants; use the official database.',
    'https://www.daad.de/en/studying-in-germany/scholarships/daad-scholarships/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'erasmus',
    'Erasmus Mundus Joint Masters scholarships',
    'European Union',
    'Multiple countries',
    ['Master’s degree', 'Recent graduate'],
    'Apply through the individual joint-master programme; eligible degrees, nationality routes and dates vary.',
    'https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'chevening',
    'Chevening Scholarships',
    'UK government',
    'United Kingdom',
    ['Master’s degree', 'Recent graduate', 'Early-career professional'],
    'Eligible-country and programme rules apply; consult the current country page and application cycle.',
    'https://www.chevening.org/scholarships/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'commonwealth',
    'Commonwealth Master’s Scholarships',
    'Commonwealth Scholarship Commission',
    'United Kingdom',
    ['Master’s degree'],
    'Nationality, residence, nomination and award-route conditions apply.',
    'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'fulbright',
    'Fulbright Foreign Student Program',
    'Fulbright programme',
    'United States',
    ['Master’s degree', 'PhD or doctoral degree'],
    'Country-specific application, funding and eligible-study rules; no universal deadline is asserted.',
    'https://foreign.fulbrightonline.org/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'gates',
    'Gates Cambridge Scholarship',
    'Gates Cambridge Trust',
    'United Kingdom',
    ['Master’s degree', 'PhD or doctoral degree'],
    'Postgraduate eligibility and deadlines depend on course and applicant route.',
    'https://www.gatescambridge.org/apply/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'clarendon',
    'Clarendon Scholarships',
    'University of Oxford',
    'United Kingdom',
    ['Master’s degree', 'PhD or doctoral degree'],
    'Consideration follows the relevant graduate course application process and its funding deadline.',
    'https://www.ox.ac.uk/clarendon',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'australia-awards',
    'Australia Awards Scholarships',
    'Australian government',
    'Australia',
    ['Undergraduate degree', 'Master’s degree'],
    'Participating-country, development-priority and return conditions vary by country programme.',
    'https://www.dfat.gov.au/people-to-people/australia-awards/australia-awards-scholarships',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'manaaki',
    'Manaaki New Zealand Scholarships',
    'New Zealand government',
    'New Zealand',
    ['Undergraduate degree', 'Master’s degree', 'PhD or doctoral degree'],
    'Eligible-country and study-priority conditions apply; use the current official country guidance.',
    'https://www.nzscholarships.govt.nz/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'turkiye',
    'Türkiye Scholarships',
    'Türkiye Scholarships programme',
    'Türkiye',
    ['Undergraduate degree', 'Master’s degree', 'PhD or doctoral degree'],
    'Programme-specific level, nationality and applicant conditions apply.',
    'https://www.turkiyeburslari.gov.tr/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'swiss',
    'Swiss Government Excellence Scholarships',
    'Swiss government',
    'Switzerland',
    ['PhD or doctoral degree', 'Master’s degree'],
    'Country-specific research and arts routes; host-supervisor and nomination conditions may apply.',
    'https://www.sbfi.admin.ch/scholarships_eng',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'mext',
    'MEXT Scholarships',
    'Government of Japan',
    'Japan',
    ['Undergraduate degree', 'Master’s degree', 'PhD or doctoral degree'],
    'Embassy and university recommendation routes have different calls and applicant conditions.',
    'https://www.studyinjapan.go.jp/en/planning/scholarships/mext-scholarships/',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
  [
    'gks',
    'Global Korea Scholarship',
    'NIIED / Study in Korea',
    'South Korea',
    ['Undergraduate degree', 'Master’s degree', 'PhD or doctoral degree'],
    'Use the current undergraduate or graduate announcement and embassy/university route.',
    'https://www.studyinkorea.go.kr/en/plan/scholarship.do',
    {},
    'Deadline not announced',
    null,
    null,
    null,
  ],
];
for (const [
  id,
  name,
  organization,
  country,
  stages,
  eligibility,
  url,
  components,
  status,
  finalDeadline,
  deadlineAt,
  applicationUrl,
] of funding)
  records.push(
    make('scholarship', 'funding-' + id, name, {
      organization,
      country,
      region: ['Hong Kong', 'China', 'South Korea', 'Japan'].includes(country)
        ? 'East Asia'
        : country === 'Australia' || country === 'New Zealand'
          ? 'Oceania'
          : country === 'United States'
            ? 'North America'
            : 'Europe / international',
      fieldIds: D.majors.map((m) => m.id),
      stages,
      nationalities: [],
      eligibility,
      funding: {
        tuition: null,
        stipend: null,
        travel: null,
        accommodation: null,
        insurance: null,
        researchAllowance: null,
        coverage:
          'Consult the official award notice; no full-funding claim is made.',
        amount: null,
        ...components,
      },
      status,
      finalDeadline,
      deadlineAt,
      deadlineVerified: !!deadlineAt,
      openVerified: status === 'Open',
      applicationUrl: applicationUrl || url,
      url,
      documents: [],
      format: 'Programme-dependent',
      duration: null,
      requiredSkills: [],
      sources: [
        source('Official funding programme', url),
        ...(id === 'hkpfs'
          ? [
              source(
                'Current-cycle application and exact deadline',
                'https://cerg1.ugc.edu.hk/hkpfs/Explanatory/Explanatory_Init_App.jsp',
              ),
            ]
          : []),
      ],
      limitations:
        'Award availability, components, eligibility and required documents must be checked in the current official call. Missing amounts and components are not assumed.',
      verification:
        status === 'Open'
          ? 'Current application cycle and exact source deadline checked'
          : 'Official programme overview; no current open cycle or universal deadline asserted.',
    }),
  );
const dataset = {
  default: {
    url: 'https://www.bls.gov/data/',
    note: 'Use official public aggregate data or clearly labelled synthetic examples; choose a dataset appropriate to the question.',
  },
  mse: {
    url: 'https://archive.ics.uci.edu/dataset/179/secom',
    note: 'UCI SECOM is suitable for the semiconductor-data project; use published property data for materials-selection exercises and verify each dataset’s licence.',
  },
  physics: {
    url: 'https://opendata.cern.ch/',
    note: 'Use an educational CERN Open Data sample and follow its documentation and reuse conditions.',
  },
  chemistry: {
    url: 'https://pubchem.ncbi.nlm.nih.gov/',
    note: 'PubChem offers public chemical information; choose a relevant property dataset and verify provenance.',
  },
  biology: {
    url: 'https://www.gbif.org/',
    note: 'GBIF public observations require licence, sampling-bias and location-sensitivity checks.',
  },
  medicine: {
    url: 'https://physionet.org/',
    note: 'Use openly permitted educational or synthetic data only; many PhysioNet datasets have additional credential and data-use restrictions.',
  },
  veterinary: {
    url: 'https://www.woah.org/en/what-we-do/animal-health-and-welfare/',
    note: 'Use public aggregate surveillance or educational guidance; no animal handling or clinical inference.',
  },
  environment: {
    url: 'https://climate.nasa.gov/',
    note: 'Follow links to official public climate datasets and inspect their measurement and aggregation documentation.',
  },
  law: {
    url: 'https://www.legislation.gov.uk/',
    note: 'Use official legal materials in a clearly specified jurisdiction; this project is not legal advice.',
  },
  economics: {
    url: 'https://data.worldbank.org/',
    note: 'Use public aggregate indicators with definitions, licence and reference dates.',
  },
  finance: {
    url: 'https://www.sec.gov/edgar/search/',
    note: 'Use public company filings and clearly labelled educational models; no investment recommendation.',
  },
};
const cvStages = [
  'High-school student',
  'University applicant',
  'First-year undergraduate',
  'Final-year undergraduate',
  'Research applicant',
  'Internship applicant',
  'Master’s applicant',
  'PhD applicant',
  'Recent graduate',
  'Early-career professional',
  'Experienced technical professional',
  'Career changer',
  'Founder / entrepreneurial applicant',
];
const sections = [
  [
    'Summary',
    'State your direction and the evidence relevant to this application.',
    'Fictional educational example: engineering learner developing reproducible data analysis and technical communication through a documented public-data project.',
  ],
  [
    'Education',
    'Include the qualification, institution and dates you can verify.',
    'Use your actual school or degree, institution, status and dates; do not imply a completed qualification while still enrolled.',
  ],
  [
    'Relevant coursework',
    'Select courses that explain preparation for the role or programme.',
    'List completed or clearly marked in-progress courses and connect one to a project artifact.',
  ],
  [
    'Technical skills',
    'Name methods you can demonstrate, with evidence.',
    'Fictional example: calibration analysis demonstrated in an annotated notebook with residual checks.',
  ],
  [
    'Software and tools',
    'Explain what you used a tool to accomplish.',
    'Fictional example: Python and a version-controlled notebook used to clean public data and reproduce a figure.',
  ],
  [
    'Laboratory / practical skills',
    'Only include techniques actually practised under appropriate supervision.',
    'If no laboratory experience exists, describe desk-based work honestly instead of inventing equipment access.',
  ],
  [
    'Projects',
    'Show the question, your contribution, method and result or limitation.',
    'Fictional example: compared published alloy data, checked units and presented a materials-selection tradeoff.',
  ],
  [
    'Research',
    'Distinguish a literature review, coursework and supervised original research.',
    'Fictional example: built a cited evidence table and identified inconsistent measurement methods; no claim of publication.',
  ],
  [
    'Internships',
    'Name real responsibilities and dates; identify your own contribution.',
    'If you have no internship, omit this section and expand a relevant project or volunteering contribution.',
  ],
  [
    'Employment',
    'Connect real responsibilities to the target without changing job titles.',
    'Describe an observed problem, what you did and the outcome you can support.',
  ],
  [
    'Certifications',
    'Use exact credential names and distinguish certificates from licences.',
    'Record the issuer and completion date; course completion does not authorize regulated practice.',
  ],
  [
    'Publications / presentations',
    'Give accurate authorship, venue and status.',
    'Label a class presentation as a class presentation and a manuscript draft as a draft.',
  ],
  [
    'Awards',
    'Use exact award names, levels and dates.',
    'Explain the competition context only where supported; do not invent a percentile.',
  ],
  [
    'Leadership',
    'Show decisions, coordination and accountability.',
    'Fictional example: organized the team’s review checklist and documented agreed changes before the handover.',
  ],
  [
    'Volunteering',
    'Describe a real contribution and its context.',
    'Fictional example: prepared accessible learning materials and revised them after supervisor feedback.',
  ],
  [
    'Languages',
    'Use honest proficiency descriptions or verified test results.',
    'State actual languages and evidence where relevant; no test score is invented.',
  ],
  [
    'Interests',
    'Include only interests that add relevant context.',
    'Optional: a specific technical or community interest you can discuss; omit generic filler.',
  ],
];
const cvFormats = cvStages.map((stage, i) =>
  make('cv', 'cv-format-' + (i + 1), stage + ' reference format', {
    summary:
      'An anonymized educational format with fictional example bullets. It is not a real person’s CV and is not ready to submit unchanged.',
    goalAdvice:
      stage.includes('PhD') || stage.includes('Research')
        ? 'Prioritize research questions, methods, authorship, supervision and evidence of independent inquiry.'
        : stage.includes('Experienced')
          ? 'Prioritize technical scope, accountable decisions and verified outcomes; compress early coursework.'
          : stage.includes('changer')
            ? 'Map transferable evidence to the new direction and distinguish existing capability from current learning.'
            : stage.includes('Founder')
              ? 'Explain the problem, product evidence, your contribution and uncertain business assumptions without claiming traction you cannot verify.'
              : 'Prioritize relevant education and projects, with clear status and evidence rather than senior-level employment expectations.',
    sections: sections.map(([name, why, example]) => ({ name, why, example })),
    bullets: [
      {
        weak: 'Worked on a materials project.',
        improved:
          'Compared the tensile behavior of three aluminum alloys using published stress–strain data, documented the analysis in Python and presented a materials-selection recommendation.',
        why: 'Fictional example supplied for learning: method, artifact and decision are specific. Use a number only if your own project supports it.',
      },
      {
        weak: 'Excellent teamwork and leadership.',
        improved:
          'Coordinated the project review checklist, recorded each member’s contribution and revised the handover after mentor feedback.',
        why: 'Describes observable actions rather than an unsupported trait.',
      },
    ],
    quantification:
      'Quantify only when the quantity is meaningful, attributable and supported by records. Use an accurate qualitative outcome when a number would imply unsupported impact. Never manufacture percentages, users, revenue or time savings.',
    academicVsIndustry:
      'Academic CVs may emphasize research, publications, presentations and methods. Industry résumés prioritize evidence relevant to the role and concise contribution/outcome bullets. Adapt length and order to the application instructions.',
    fieldIds: [],
    sources: [
      source(
        'Harvard career-service résumé and cover-letter guidance',
        'https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/',
      ),
    ],
    verification:
      'Editorial educational reference format; examples are explicitly fictional.',
  }),
);
const universityEnrichment = {
  cityu: {
    country: 'Hong Kong',
    city: 'Hong Kong',
    locationId: 'location-hong-kong',
  },
  hkust: {
    country: 'Hong Kong',
    city: 'Hong Kong',
    locationId: 'location-hong-kong',
  },
  nus: {
    country: 'Singapore',
    city: 'Singapore',
    locationId: 'location-singapore',
  },
  ntu: {
    country: 'Singapore',
    city: 'Singapore',
    locationId: 'location-singapore',
  },
  mit: {
    country: 'United States',
    city: 'Cambridge, Massachusetts',
    locationId: 'location-united-states',
  },
  epfl: {
    country: 'Switzerland',
    city: 'Lausanne',
    locationId: 'location-switzerland',
  },
  eth: {
    country: 'Switzerland',
    city: 'Zurich',
    locationId: 'location-switzerland',
  },
  imperial: {
    country: 'United Kingdom',
    city: 'London',
    locationId: 'location-united-kingdom',
  },
  caltech: {
    country: 'United States',
    city: 'Pasadena',
    locationId: 'location-united-states',
  },
  monash: {
    country: 'Australia',
    city: 'Melbourne',
    locationId: 'location-australia',
  },
  uct: {
    country: 'South Africa',
    city: 'Cape Town',
    locationId: 'location-south-africa',
  },
  usp: { country: 'Brazil', city: 'São Paulo', locationId: 'location-brazil' },
};
// Verify all factual record URLs. A failed source stages the whole record for review.
const checked = new Map();
let index = 0;
const urls = [...new Set(records.flatMap((r) => r.sources.map((s) => s[1])))];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (index < urls.length) {
      const url = urls[index++];
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(12000),
          redirect: 'follow',
        });
        checked.set(url, { ok: r.ok, status: r.status, url: r.url });
        await r.body?.cancel();
      } catch (e) {
        checked.set(url, { ok: false, error: e.message });
      }
    }
  }),
);
const approved = records.filter((r) => {
  const failed = r.sources.filter(([, u]) => !checked.get(u)?.ok);
  if (failed.length) {
    reviewQueue.push({
      id: r.id,
      name: r.name,
      reason:
        'One or more official source checks failed; excluded from publication.',
      sources: failed,
    });
    return false;
  }
  return true;
});
writeFileSync(
  'data/curated-intelligence.json',
  JSON.stringify(
    {
      records: approved,
      reviewQueue,
      universityEnrichment,
      cvFormats,
      datasets: dataset,
      pathwayNames: {
        mse: 'Semiconductor materials engineer',
        mechanical: 'Mechanical design engineer',
        electrical: 'Electronics and systems engineer',
        civil: 'Civil infrastructure engineer',
        'chemical-engineering': 'Chemical process engineer',
        biomedical: 'Biomedical materials researcher',
        cs: 'Computer scientist',
        ai: 'AI engineer',
        'data-science': 'Data scientist',
        cybersecurity: 'Cybersecurity analyst',
        software: 'Software engineer',
        medicine: 'Physician-scientist',
        dentistry: 'Dental research professional',
        nursing: 'Nursing research professional',
        pharmacy: 'Pharmacist / pharmaceutical researcher',
        veterinary: 'Veterinary researcher',
        biology: 'Biological researcher',
        biotechnology: 'Biotechnology researcher',
        chemistry: 'Chemical scientist',
        physics: 'Physics researcher',
        mathematics: 'Applied mathematician',
        environment: 'Sustainability consultant',
        architecture: 'Architectural design professional',
        business: 'Product and operations professional',
        economics: 'Economist',
        finance: 'Financial analyst',
        law: 'Legal research professional',
        psychology: 'Psychology researcher',
        education: 'Education professional',
        design: 'UX designer',
        media: 'Media and communication professional',
        politics: 'Policy analyst',
        'international-relations': 'International-relations professional',
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    approved: approved.length,
    byKind: Object.fromEntries(
      [...new Set(approved.map((x) => x.kind))].map((k) => [
        k,
        approved.filter((x) => x.kind === k).length,
      ]),
    ),
    reviewQueue: reviewQueue.length,
  }),
);
