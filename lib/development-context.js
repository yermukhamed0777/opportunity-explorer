// Only explicitly permitted, reviewed profile records enter model context.
export async function developmentContext(db, userId) {
  const pref = await db
    .from('preferences')
    .select('basic,field_ids,goals,allow_profile_ai')
    .eq('user_id', userId)
    .maybeSingle();
  if (pref.error || !pref.data?.allow_profile_ai)
    return { profileConsent: false };
  const requests = await Promise.all([
    db
      .from('profile_records')
      .select('kind,title,organization,details')
      .eq('user_id', userId)
      .eq('ai_allowed', true)
      .limit(30),
    db
      .from('user_skills')
      .select('skill_id,state,evidence')
      .eq('user_id', userId)
      .limit(40),
    db
      .from('course_progress')
      .select('course_id,state')
      .eq('user_id', userId)
      .limit(30),
    db
      .from('activities')
      .select('title,due_date,state')
      .eq('user_id', userId)
      .limit(20),
    db.from('plans').select('goal,weekly_hours').eq('user_id', userId).limit(5),
    db
      .from('plan_items')
      .select('title,state,week_start,weekly_hours,due_date')
      .eq('user_id', userId)
      .limit(25),
  ]);
  if (requests.some((x) => x.error))
    throw Error('Your permitted profile context could not load. Please retry.');
  const basic = pref.data.basic || {};
  const selected = Object.fromEntries(
    [
      'stage',
      'graduation',
      'location',
      'format',
      'hours',
      'languages',
      'budget',
    ].map((k) => [k, String(basic[k] || '').slice(0, 150)]),
  );
  return {
    profileConsent: true,
    basic: selected,
    fields: pref.data.field_ids,
    goals: pref.data.goals,
    records: requests[0].data.map((x) => ({
      ...x,
      details: x.details.slice(0, 600),
    })),
    skills: requests[1].data.map((x) => ({
      ...x,
      evidence: x.evidence.slice(0, 200),
    })),
    courses: requests[2].data,
    activities: requests[3].data,
    plans: requests[4].data,
    tasks: requests[5].data,
  };
}
