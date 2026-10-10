import { SkillScores, Opportunity, PriorityItem, PriorityLevel, SkipTopic, TodayTask } from './types';

// Role relevance configuration (tuned per target role)
export const ROLE_RELEVANCE_CONFIG: Record<string, Record<string, number>> = {
  'Software Developer': {
    dsa: 95,
    aptitude: 65,
    dbms: 80,
    os: 75,
    networks: 65,
    projects: 85,
    communication: 65,
    interview: 75,
  },
  'Full Stack Developer': {
    dsa: 85,
    aptitude: 60,
    dbms: 90,
    os: 60,
    networks: 70,
    projects: 95,
    communication: 70,
    interview: 75,
  },
  'Data Analyst': {
    dsa: 60,
    aptitude: 90,
    dbms: 95,
    os: 40,
    networks: 40,
    projects: 85,
    communication: 75,
    interview: 70,
  },
  DEFAULT: {
    dsa: 85,
    aptitude: 70,
    dbms: 75,
    os: 65,
    networks: 60,
    projects: 80,
    communication: 65,
    interview: 70,
  },
};

export const SKILL_METADATA: Record<keyof SkillScores, { label: string; desc: string }> = {
  aptitude: { label: 'Quantitative & Logical Aptitude', desc: 'Speed math, percentages, ratios, work & time, logical reasoning' },
  dsa: { label: 'Data Structures & Algorithms', desc: 'Arrays, strings, trees, graphs, dynamic programming, hashing' },
  dbms: { label: 'DBMS & SQL Queries', desc: 'SQL joins, indexing, normalization, transactions, ACID properties' },
  os: { label: 'Operating Systems', desc: 'Processes, threads, CPU scheduling, deadlocks, virtual memory' },
  networks: { label: 'Computer Networks', desc: 'TCP/IP, OSI model, DNS, HTTP/HTTPS, routing protocols' },
  projects: { label: 'Projects & Architecture', desc: 'Full-stack systems, API design, tech trade-offs, live deployments' },
  communication: { label: 'Communication & Behavioral', desc: 'Clarity, concise storytelling, HR fit, scenario questions' },
  interview: { label: 'Live Interview & Mock Practice', desc: 'Whiteboarding composure, problem breakdown out loud, speed recall' },
};

export interface TimelineOption {
  id: string;
  label: string;
  days: number;
}

export const TIMELINE_OPTIONS: TimelineOption[] = [
  { id: '1w', label: '1 week', days: 7 },
  { id: '2w', label: '2 weeks', days: 14 },
  { id: '1m', label: '1 month', days: 30 },
  { id: '2m', label: '2 months', days: 60 },
  { id: '3m', label: '3 months', days: 90 },
  { id: '4m', label: '4 months', days: 120 },
  { id: '5m', label: '5 months', days: 150 },
  { id: '6m', label: '6 months', days: 180 },
  { id: '6m_plus', label: '6+ months', days: 210 },
  { id: 'custom', label: 'Custom', days: 150 },
];

/**
 * Returns formatted timeline label and approximate days description
 */
export function formatTimelineDisplay(days: number): { label: string; approximateDays: string } {
  if (days <= 7) return { label: '1 Week', approximateDays: `Approximately ${days} days until placement.` };
  if (days <= 14) return { label: '2 Weeks', approximateDays: `Approximately ${days} days until placement.` };
  if (days >= 28 && days <= 35) return { label: '1 Month', approximateDays: `Approximately ${days} days until placement.` };
  if (days >= 55 && days <= 65) return { label: '2 Months', approximateDays: `Approximately ${days} days until placement.` };
  if (days >= 85 && days <= 95) return { label: '3 Months', approximateDays: `Approximately ${days} days until placement.` };
  if (days >= 115 && days <= 125) return { label: '4 Months', approximateDays: `Approximately ${days} days until placement.` };
  if (days >= 145 && days <= 155) return { label: '5 Months', approximateDays: `Approximately ${days} days until placement.` };
  if (days >= 175 && days <= 185) return { label: '6 Months', approximateDays: `Approximately ${days} days until placement.` };
  if (days > 185) {
    const months = Math.round(days / 30);
    return { label: `${months}+ Months`, approximateDays: `Approximately ${days} days until placement.` };
  }
  return { label: `${days} Days`, approximateDays: `Approximately ${days} days until placement.` };
}

/**
 * Continuous tiered urgency function that works across 1 day through 180+ days.
 *
 * Product Principle:
 * "More time = optimize for growth.
 * Less time = optimize for immediate impact."
 *
 * 0–2 days   = Critical (95–100)
 * 3–7 days   = High (80–90)
 * 8–14 days  = Elevated (58–75)
 * 15–30 days = Moderate (35–50)
 * 31–60 days = Low (20–30)
 * 61–120 days = Long-term (10–18)
 * 121+ days  = Foundation / Long-term (5–10)
 */
export function calculateUrgency(daysRemaining: number): number {
  if (daysRemaining <= 0) return 100;
  if (daysRemaining <= 2) return 96; // 1-2 days (Critical)
  if (daysRemaining <= 7) return 82; // 3-7 days (High)
  if (daysRemaining <= 14) return 60; // 8-14 days (Elevated)
  if (daysRemaining <= 30) return 38; // 15-30 days (Moderate)
  if (daysRemaining <= 60) return 24; // 1-2 months (Low)
  if (daysRemaining <= 120) return 14; // 2-4 months (Long-term)
  return 8; // 121+ days (Foundation / Long-term)
}

/**
 * Calculates skill gap normalized to 0-100.
 * Confidence of 10 gives gap = 0. Score of 0 gives gap = 100.
 * Confidence of 2 gives gap = 80.
 * Confidence of 4 gives gap = 60.
 */
export function calculateSkillGap(skillScore: number): number {
  const clamped = Math.max(0, Math.min(10, skillScore));
  return (10 - clamped) * 10;
}

/**
 * Calculates assessment relevance based on whether upcoming drives explicitly list the skill.
 */
export function calculateAssessmentRelevance(
  skillKey: keyof SkillScores,
  opportunities: Opportunity[]
): { relevance: number; closestDays: number; matchingCompany: string | null } {
  if (!opportunities.length) return { relevance: 20, closestDays: 999, matchingCompany: null };

  const skillNameMap: Record<keyof SkillScores, string[]> = {
    aptitude: ['aptitude', 'quantitative', 'speed', 'logic', 'math'],
    dsa: ['dsa', 'coding', 'algorithms', 'data structures', 'pair coding'],
    dbms: ['dbms', 'sql', 'database'],
    os: ['os', 'operating systems', 'core cs'],
    networks: ['cn', 'networks', 'computer networks'],
    projects: ['projects', 'system design', 'architecture', 'pair coding', 'full stack', 'web'],
    communication: ['communication', 'hr', 'behavioral', 'interview'],
    interview: ['interview', 'pair coding', 'mock', 'coding'],
  };

  const matches = skillNameMap[skillKey] || [];
  let highestRelevance = 15;
  let closestDays = 999;
  let matchingCompany: string | null = null;

  for (const opp of opportunities) {
    const oppText = `${opp.assessmentType} ${opp.requiredSkills.join(' ')}`.toLowerCase();
    const isDirectMatch = matches.some((keyword) => oppText.includes(keyword));

    if (isDirectMatch) {
      // Relevance scales with proximity
      const proximityBoost =
        opp.daysRemaining <= 2 ? 100 : opp.daysRemaining <= 8 ? 85 : opp.daysRemaining <= 30 ? 70 : 40;
      if (proximityBoost > highestRelevance) {
        highestRelevance = proximityBoost;
      }
      if (opp.daysRemaining < closestDays) {
        closestDays = opp.daysRemaining;
        matchingCompany = opp.company;
      }
    }
  }

  return { relevance: highestRelevance, closestDays, matchingCompany };
}

/**
 * Dynamic Priority Engine that adapts weights according to the user's timeline:
 *
 * When timeline is long-term (>= 60 days):
 * - Urgency is naturally low; weight shifts toward skill gaps (50%) and role relevance (25%).
 * - Large skill gaps (e.g. OS: 2/10, DSA: 6/10) take priority for foundational development.
 * - Maintain already-strong areas (e.g. Projects: 8/10).
 *
 * When timeline is short-term (< 30 days):
 * - Urgency (30%) and immediate assessment relevance (20%) take precedence.
 * - Prevents cutoff eliminations in approaching drives.
 */
export function calculateDeterministicPriorities(
  skills: SkillScores,
  opportunities: Opportunity[],
  targetRole: string,
  placementTimelineDays: number = 30
): PriorityItem[] {
  const roleWeights = ROLE_RELEVANCE_CONFIG[targetRole] || ROLE_RELEVANCE_CONFIG.DEFAULT;

  // Adaptive weighting according to preparation horizon
  const isLongTerm = placementTimelineDays >= 60; // 2+ months away
  const isMidTerm = placementTimelineDays >= 28 && placementTimelineDays < 60; // ~1 month away

  const weights = isLongTerm
    ? { skillGap: 0.50, urgency: 0.10, assessment: 0.15, role: 0.25 }
    : isMidTerm
    ? { skillGap: 0.40, urgency: 0.20, assessment: 0.20, role: 0.20 }
    : { skillGap: 0.35, urgency: 0.30, assessment: 0.20, role: 0.15 }; // Short-term default

  const results: PriorityItem[] = [];

  for (const [keyStr, score] of Object.entries(skills) as [keyof SkillScores, number][]) {
    const skillGap = calculateSkillGap(score);
    const { relevance: assessmentRelevance, closestDays, matchingCompany } = calculateAssessmentRelevance(
      keyStr,
      opportunities
    );

    // If an opportunity is explicitly scheduled, use its proximity; otherwise use the student's overall timeline
    const effectiveDays = closestDays < 999 ? closestDays : placementTimelineDays;
    const urgency = calculateUrgency(effectiveDays);
    const roleRelevance = roleWeights[keyStr] ?? 60;

    const rawScore =
      skillGap * weights.skillGap +
      urgency * weights.urgency +
      assessmentRelevance * weights.assessment +
      roleRelevance * weights.role;

    const finalScore = Math.round(Math.min(100, Math.max(0, rawScore)));

    let level: PriorityLevel = 'maintain';
    if (finalScore >= 88) level = 'critical';
    else if (finalScore >= 72) level = 'high';
    else if (finalScore >= 50) level = 'important';
    else level = 'maintain';

    const label = SKILL_METADATA[keyStr].label;

    let reason = '';
    let whyThisMatters = '';

    if (closestDays <= 2 && matchingCompany) {
      reason = `Assessment tomorrow (${matchingCompany}) requires passing this round.`;
      whyThisMatters = `Your confidence is ${score}/10, your nearest assessment is tomorrow, and ${label} is a major part of the assessment. This gives it the highest short-term cutoff impact.`;
    } else if (closestDays <= 8 && matchingCompany) {
      reason = `Primary filter for ${matchingCompany} (${closestDays} days remaining). Current confidence ${score}/10.`;
      whyThisMatters = `${matchingCompany} eliminates candidates in Stage 1 filters. Shoring up this gap in the 8-day window ensures you clear initial cutoffs.`;
    } else if (isLongTerm) {
      if (skillGap >= 60) {
        reason = `Major foundational gap (${score}/10) with ${placementTimelineDays} days runway. Perfect time for deep mastery.`;
        whyThisMatters = `With ${formatTimelineDisplay(placementTimelineDays).label.toLowerCase()} until placement season, urgency is low. This affords you the runway to build deep conceptual mastery in ${label} without cramming.`;
      } else if (skillGap >= 30) {
        reason = `Core capability for ${targetRole}. Focus on steady progression and pattern mastery.`;
        whyThisMatters = `Consistent weekly practice will elevate this from a moderate level (${score}/10) to top-tier interview readiness.`;
      } else {
        reason = `Strong area (${score}/10). Maintain proficiency with light weekly refreshers.`;
        whyThisMatters = `Already at strong confidence (${score}/10). With long-term runway, allocate peak hours to bigger skill gaps.`;
      }
    } else if (skillGap >= 50) {
      reason = `Significant confidence gap (${score}/10) for your target ${targetRole} track.`;
      whyThisMatters = `Foundational strength is required for upcoming technical assessments. Building confidence now avoids last-minute panic.`;
    } else {
      reason = `Adequately prepared (Confidence ${score}/10). Keep skills fresh with light review.`;
      whyThisMatters = `You have solid competence here. Safe to maintain without consuming precious peak sprint hours right now.`;
    }

    results.push({
      id: keyStr,
      topic: label,
      skillKey: keyStr,
      score: finalScore,
      level,
      reason,
      whyThisMatters,
      breakdown: {
        skillGap: Math.round(skillGap),
        urgency: Math.round(urgency),
        assessmentRelevance: Math.round(assessmentRelevance),
        roleRelevance: Math.round(roleRelevance),
      },
    });
  }

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Calculates Placement Readiness Score:
 * Directional feedback based on skill confidence weighted against nearest opportunity requirements and timeline runway
 */
export function calculateReadinessScore(
  skills: SkillScores,
  opportunities: Opportunity[],
  placementTimelineDays: number = 30
): number {
  const vals = Object.values(skills);
  const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length;
  let baseScore = avg * 10; // 0 - 100

  // Penalty if an assessment is imminent (<= 2 days) and key stage-1 skills are low
  const closestDays = opportunities.length
    ? Math.min(...opportunities.map((o) => o.daysRemaining))
    : placementTimelineDays;

  if (closestDays <= 2 && skills.aptitude < 6) {
    baseScore = Math.max(25, baseScore - 12);
  }

  return Math.min(96, Math.max(20, Math.round(baseScore)));
}

/**
 * Deterministic fallback for Today's Plan (2 hours = 120 minutes total)
 * Adapts tasks to long-term foundation building vs immediate cutoff drilling
 */
export function generateDeterministicPlan(
  priorities: PriorityItem[],
  scenario: 'normal' | 'emergency',
  placementTimelineDays: number = 30
): TodayTask[] {
  if (scenario === 'emergency') {
    // 1-day emergency pivot: drill heavy speed aptitude and timed test simulation
    return [
      {
        id: 'task-1',
        topic: 'Quantitative Aptitude',
        title: 'Complete 15 timed speed drill questions (Percentages & Work)',
        durationMinutes: 40,
        priority: 'critical',
        description: 'Solve 15 speed arithmetic questions under strict 2.5 min per question ceiling.',
        objective: 'Improve rapid formula recall and question triage for tomorrow’s first round.',
        recommendedActivity: 'Work through 5 percentage change questions, 5 time/work questions, and 5 ratio questions with a stopwatch.',
        completed: true,
      },
      {
        id: 'task-2',
        topic: 'Timed Coding / DSA',
        title: '2 timed speed problems under 15-minute constraints',
        durationMinutes: 35,
        priority: 'critical',
        description: 'Practice 2 easy-medium two-pointer array problems with immediate runtime focus.',
        objective: 'Ensure syntactical muscle memory and clean boundary condition handling.',
        recommendedActivity: 'Write and run optimal two-sum or palindrome substring solution without consulting notes.',
        completed: false,
      },
      {
        id: 'task-3',
        topic: 'Mock Speed Round',
        title: 'Mock 25-minute MCQ assessment simulation',
        durationMinutes: 25,
        priority: 'high',
        description: 'Simulate the exact Infosys pattern under test time pressure.',
        objective: 'Train skip discipline: never get stuck on a single question for > 2 minutes.',
        recommendedActivity: 'Complete a rapid 20-question mixed aptitude and pseudocode test block.',
        completed: false,
      },
      {
        id: 'task-4',
        topic: 'Interview Practice',
        title: '90-second crisp project & self-intro pitch',
        durationMinutes: 20,
        priority: 'maintain',
        description: 'Practice speaking aloud in front of a camera or mirror.',
        objective: 'Deliver crisp problem statement, tech stack, and hardest bug resolved without rambling.',
        recommendedActivity: 'Record 2 takes on your phone and verify you stay under 90 seconds.',
        completed: false,
      },
    ];
  }

  // Long-term preparation (e.g. 5 months / 150 days runway)
  if (placementTimelineDays >= 90) {
    const topGap1 = priorities[0];
    const topGap2 = priorities[1];
    return [
      {
        id: 'task-1',
        topic: topGap1?.topic || 'Core Fundamentals',
        title: `Deep Concept Study: ${topGap1?.topic || 'DSA & Systems'}`,
        durationMinutes: 45,
        priority: 'high',
        description: `Dedicate focused time to foundational principles in ${topGap1?.topic || 'your top skill gap'}.`,
        objective: 'Understand core algorithmic principles and system architecture thoroughly without rushing.',
        recommendedActivity: 'Implement data structures from scratch and trace memory allocations.',
        completed: false,
      },
      {
        id: 'task-2',
        topic: topGap2?.topic || 'Problem Solving',
        title: `Guided Problem Solving: ${topGap2?.topic || 'Algorithms'}`,
        durationMinutes: 40,
        priority: 'high',
        description: 'Solve 2 foundational pattern problems focusing on clean code and invariant reasoning.',
        objective: 'Solidify pattern recognition for recurring interview question archetypes.',
        recommendedActivity: 'Implement standard algorithms and document edge cases and trade-offs.',
        completed: false,
      },
      {
        id: 'task-3',
        topic: 'Projects & Architecture',
        title: 'Project Engineering: Feature Implementation & Testing',
        durationMinutes: 35,
        priority: 'important',
        description: 'Build robust architectural features in your full-stack portfolio application.',
        objective: 'Gain real-world engineering depth that stands out in technical rounds.',
        recommendedActivity: 'Write integration tests and optimize database query indexing.',
        completed: false,
      },
    ];
  }

  // Normal horizon (8–30 days)
  return [
    {
      id: 'task-1',
      topic: 'Quantitative Aptitude',
      title: 'Aptitude: Speed arithmetic & formula revision',
      durationMinutes: 40,
      priority: 'critical',
      description: 'Strengthen weak areas in ratios, percentages, and logical series.',
      objective: 'Establish reliable accuracy on foundational aptitude patterns for Infosys Stage 1.',
      recommendedActivity: 'Solve 12 curated questions covering work-rate and profit/loss.',
      completed: true,
    },
    {
      id: 'task-2',
      topic: 'DSA (Data Structures)',
      title: 'DSA: 2 medium array & hashmap problems',
      durationMinutes: 35,
      priority: 'high',
      description: 'Solve 2 problems focusing on two pointers and sliding window subarrays.',
      objective: 'Solidify core technical interview patterns required for startup coding rounds.',
      recommendedActivity: 'Solve sliding window maximum and two-sum variation on LeetCode/GeeksforGeeks.',
      completed: false,
    },
    {
      id: 'task-3',
      topic: 'DBMS & SQL',
      title: 'DBMS: SQL Joins, Indexing & Group By syntax',
      durationMinutes: 25,
      priority: 'important',
      description: 'Practice writing 5 SQL queries with LEFT vs INNER JOIN and B-Tree indexing concepts.',
      objective: 'Clear technical screening MCQ hurdles commonly asked in IT drives.',
      recommendedActivity: 'Write nested aggregation queries and review primary vs foreign key constraints.',
      completed: false,
    },
    {
      id: 'task-4',
      topic: 'Interview Practice',
      title: 'Interview: Technical pitch and project trade-offs',
      durationMinutes: 20,
      priority: 'maintain',
      description: 'Review project architecture and prepare responses for edge-case choices.',
      objective: 'Articulate architectural trade-offs calmly.',
      recommendedActivity: 'Practice answering: "Why did you choose this database over alternatives?"',
      completed: false,
    },
  ];
}

/**
 * Generates the "Don't Spend Time On" Anti-Planning filter based on timeline and scenario
 */
export function generateDeterministicSkip(
  scenario: 'normal' | 'emergency',
  placementTimelineDays: number = 30
): SkipTopic[] {
  if (scenario === 'emergency') {
    return [
      {
        topic: 'Advanced Graph Algorithms (Dijkstra, Segment Trees)',
        reason: 'Zero ROI for tomorrow’s aptitude-heavy screening. Graphs are not tested in Infosys Stage 1.',
        focusInstead: 'Aptitude Speed Drills + Timed Coding',
      },
      {
        topic: 'Polishing READMEs & Portfolio UI Styling',
        reason: 'Projects are evaluated in later rounds. You must clear tomorrow’s quantitative cutoff first.',
        focusInstead: 'Quantitative Aptitude Formula Sheet',
      },
    ];
  }

  if (placementTimelineDays >= 90) {
    return [
      {
        topic: 'Cramming Rapid Shortcuts & Formula Tricks',
        reason: 'You have plenty of runway. Memorizing speed tricks before understanding core mathematical and algorithmic concepts leads to shallow retention.',
        focusInstead: 'Deep Conceptual Understanding & Code Invariants',
      },
      {
        topic: 'Company-Specific Assessment Dumps',
        reason: 'Company round patterns change year-over-year. Focus on foundational DSA and systems rather than memorizing old test papers.',
        focusInstead: 'Core DSA & Full-Stack System Architecture',
      },
    ];
  }

  return [
    {
      topic: 'High-Level Microservices System Design',
      reason: 'Low short-term return on investment while campus screening tests quantitative and DSA fundamentals.',
      focusInstead: 'Core DSA Arrays + Aptitude Drills',
    },
    {
      topic: 'Exotic Dynamic Programming (Bitmask DP)',
      reason: 'Over-indexing on rare 1% problems causes choice paralysis and neglects everyday array/string patterns.',
      focusInstead: 'Two Pointers & Hashmap Fundamentals',
    },
  ];
}
