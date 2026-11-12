import { readFileSync } from 'node:fs';
import { canonicalUrl } from './intelligence-core.js';
export const intelligence = JSON.parse(
  readFileSync(new URL('../data/intelligence.json', import.meta.url), 'utf8'),
);
export const approvedHosts = new Set(
  intelligence.records.flatMap((r) =>
    r.sources.map((s) => new URL(canonicalUrl(s[1])).hostname),
  ),
);
export function sourceRegistry(records = intelligence.records) {
  const sources = new Map();
  for (const r of records)
    for (const [, value] of r.sources || []) {
      const url = canonicalUrl(value),
        old = sources.get(url);
      if (old) {
        old.recordIds.push(r.id);
        old.frequencyDays = Math.min(
          old.frequencyDays,
          ['opportunity', 'scholarship'].includes(r.kind)
            ? 1
            : r.kind === 'course'
              ? 30
              : 90,
        );
      } else
        sources.set(url, {
          url,
          recordIds: [r.id],
          frequencyDays: ['opportunity', 'scholarship'].includes(r.kind)
            ? 1
            : r.kind === 'course'
              ? 30
              : 90,
        });
    }
  return [...sources.values()];
}
