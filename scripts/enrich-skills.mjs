import { readFileSync, writeFileSync } from 'node:fs';
const p = 'data/development.json',
  d = JSON.parse(readFileSync(p));
const emerging = {
  mse: [
    'Computational materials science',
    'Materials informatics',
    'CALPHAD awareness',
    'Density-functional-theory awareness',
    'Machine learning for materials discovery',
    'Automated microscopy analysis',
    'Battery materials',
    'Semiconductor packaging',
    'Thin-film processing',
    'Additive manufacturing',
    'Circular materials design',
    'Life-cycle assessment',
  ],
  mechanical: ['Digital-twin validation', 'Design for additive manufacturing'],
  electrical: [
    'Edge AI and embedded inference',
    'Power-electronics thermal reliability',
  ],
  civil: [
    'Building information modelling and asset data',
    'Low-carbon construction assessment',
  ],
  'chemical-engineering': [
    'Process digital twins and uncertainty',
    'Electrified process design',
  ],
  biomedical: ['Medical-device data integrity', 'Digital-health validation'],
  cs: [
    'Retrieval-augmented generation',
    'AI evaluation',
    'Vector databases',
    'Secure software supply chains',
    'Privacy engineering',
  ],
  ai: [
    'Responsible AI',
    'Model monitoring',
    'Agentic workflow evaluation',
    'MLOps',
  ],
  'data-science': ['Data governance', 'Dataset shift monitoring'],
  cybersecurity: [
    'Software supply-chain integrity',
    'Privacy threat modelling',
  ],
  software: [
    'Cloud-native service reliability',
    'AI-assisted code review and verification',
  ],
  medicine: [
    'Clinical-data literacy',
    'Evidence-based medicine',
    'Clinical-trial fundamentals',
  ],
  dentistry: ['Digital dental-workflow evidence', 'Patient-data privacy'],
  nursing: ['Digital-health literacy', 'Patient-safety incident learning'],
  pharmacy: [
    'Pharmacovigilance data literacy',
    'Evidence appraisal in drug development',
  ],
  veterinary: [
    'One Health surveillance',
    'Biosecurity and zoonotic-disease awareness',
  ],
  biology: ['Reproducible bioinformatics', 'Biodiversity data stewardship'],
  biotechnology: [
    'Bioprocess data integrity',
    'Synthetic-biology governance awareness',
  ],
  chemistry: ['Automated spectroscopy analysis', 'Green-chemistry metrics'],
  physics: [
    'Scientific machine-learning validation',
    'Open experimental-data analysis',
  ],
  mathematics: ['Uncertainty quantification', 'Formal verification awareness'],
  environment: [
    'Environmental remote-sensing validation',
    'Life-cycle inventory analysis',
  ],
  architecture: [
    'Building performance simulation',
    'Embodied-carbon assessment',
  ],
  business: [
    'Product analytics',
    'AI-assisted operations assessment',
    'Sustainability reporting',
  ],
  economics: [
    'Causal-inference sensitivity analysis',
    'Reproducible policy-data analysis',
  ],
  finance: [
    'Scenario analysis',
    'Financial-model risk assessment',
    'Sustainability-reporting data',
  ],
  law: [
    'AI governance and legal-source verification',
    'Privacy and data-protection analysis',
  ],
  psychology: [
    'Open-science preregistration',
    'Measurement invariance awareness',
  ],
  education: [
    'Learning analytics and privacy',
    'Accessible digital assessment',
  ],
  design: [
    'Accessible interaction evaluation',
    'Responsible generative-design critique',
  ],
  media: ['Synthetic-media verification', 'Audience-data ethics'],
  politics: [
    'Computational text-analysis validity',
    'Public-policy algorithm accountability',
  ],
  'international-relations': [
    'Open-source conflict-data verification',
    'Technology-governance analysis',
  ],
};
for (const m of d.skillMaps) {
  for (const name of emerging[m.fieldId] || []) {
    const id =
      m.fieldId + '-emerging-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (m.skills.some((s) => s.id === id)) continue;
    m.skills.push({
      id,
      name,
      category: 'Emerging skills',
      level: 'Intermediate',
      description: `Critically explore ${name.toLowerCase()} in ${m.name.toLowerCase()}, including assumptions, evidence quality and limitations.`,
      why: `Useful for discussing a modern ${m.name.toLowerCase()} workflow without confusing a demonstration with professional competence.`,
      evidence: `A documented ${name.toLowerCase()} example with provenance, evaluation, an alternative approach and limitations.`,
      project: m.project,
      estimatedWeeks: '4–8 weeks of part-time exploration; editorial estimate',
    });
  }
  for (const s of m.skills) {
    s.relatedFields = [m.fieldId];
    s.relatedCareers = m.roles;
    s.interpretations = {
      Beginner: `Explain ${s.name.toLowerCase()} using a worked example and explicit assumptions.`,
      Intermediate: `Apply ${s.name.toLowerCase()} to a field-relevant artifact, compare alternatives and document limitations.`,
      Advanced: `Evaluate a complex ${s.name.toLowerCase()} workflow critically, test robustness and explain decisions to a reviewer. This is not a licensing assessment.`,
    };
    s.prerequisites =
      s.level === 'Beginner'
        ? 'Introductory subject knowledge; ask for supervision for practical work.'
        : `Review the foundational concepts in the ${m.name} map before applying this skill.`;
    s.courseIds = m.courses;
    s.projectIds = [`project-${m.fieldId}-1`, `project-${m.fieldId}-2`];
    s.opportunityIds = d.opportunities
      .filter((o) => o.fieldIds?.includes(m.fieldId))
      .slice(0, 2)
      .map((o) => 'programme-' + o.id);
    s.assessment = `Use a rubric: correctness, assumptions, reproducibility, safety, communication and response to feedback. Review the ${s.name.toLowerCase()} artifact with a qualified tutor or supervisor where appropriate.`;
    s.checkedOn = '2026-11-12';
    s.regulatoryAwareness =
      'Identify local ethics, safety, licensing and data-use rules before practical or professional work. A self-reported status is not a credential.';
  }
}
for (const stage of ['Early-career professional', 'Experienced professional'])
  if (!d.stages.includes(stage)) d.stages.splice(d.stages.length - 1, 0, stage);
writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
console.log({
  maps: d.skillMaps.length,
  skills: d.skillMaps.reduce((n, m) => n + m.skills.length, 0),
});
