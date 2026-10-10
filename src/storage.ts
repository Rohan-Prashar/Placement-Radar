import { AppData, Opportunity, SkillScores, UserProfile } from './types';
import {
  calculateDeterministicPriorities,
  calculateReadinessScore,
  generateDeterministicPlan,
  generateDeterministicSkip,
} from './radarEngine';

const STORAGE_KEY = 'placement_radar_app_data_v1';

export const INITIAL_DEMO_PROFILE: UserProfile = {
  name: 'Alex',
  targetRole: 'Software Developer',
  currentYear: 'Final Year',
  placementTimelineDays: 30,
  dailyStudyHours: 2,
  targetOpportunityTypes: ['Product Companies', 'Service Companies', 'Startups'],
};

export const INITIAL_DEMO_SKILLS: SkillScores = {
  dsa: 6,
  aptitude: 4,
  dbms: 5,
  os: 2,
  networks: 5,
  projects: 8,
  communication: 4,
  interview: 4,
};

export const INITIAL_DEMO_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-1',
    company: 'Infosys Campus Drive',
    daysRemaining: 1, // Scenario B default for emergency pivot showcase, or switchable to 8
    assessmentType: 'Aptitude + Coding',
    requiredSkills: ['Aptitude', 'Coding'],
    role: 'Systems Engineer',
  },
  {
    id: 'opp-2',
    company: 'XYZ Tech Startup',
    daysRemaining: 18,
    assessmentType: 'Pair Coding + System Design',
    requiredSkills: ['DSA', 'Coding', 'System Design'],
    role: 'Fullstack SDE 1',
  },
];

export function getInitialAppData(): AppData {
  const profile = { ...INITIAL_DEMO_PROFILE };
  const skills = { ...INITIAL_DEMO_SKILLS };
  const opportunities = [...INITIAL_DEMO_OPPORTUNITIES];

  const priorities = calculateDeterministicPriorities(skills, opportunities, profile.targetRole);
  const readinessScore = calculateReadinessScore(skills, opportunities);
  const scenario = 'emergency';
  const todayPlan = generateDeterministicPlan(priorities, scenario);
  const skipToday = generateDeterministicSkip(scenario);

  return {
    profile,
    skills,
    opportunities,
    radarState: {
      lastCalculatedAt: new Date().toISOString(),
      scenario,
      needsRecalculation: false,
      readinessScore,
      summaryInsight:
        'Your nearest deadline is tomorrow (Infosys Campus Drive). Aptitude confidence is 4/10 and acts as a Stage 1 elimination gatekeeper. Dedicating 40 minutes today yields the highest pass probability.',
      priorities,
      todayPlan,
      skipToday,
      aiReasoning:
        'Your aptitude confidence is 4/10, your nearest assessment is tomorrow, and aptitude is a major part of the assessment. This gives aptitude the highest short-term impact.',
      isAiGenerated: false,
    },
    settings: {
      aiAggressiveness: 'Balanced',
      notificationsEnabled: true,
      preferredStudyDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    resourceProgress: {
      'dsa-striver-a2z': {
        status: 'studying',
        completedTopics: ['Arrays'],
        saved: true,
      },
      'aptitude-indiabix': {
        status: 'studying',
        completedTopics: [],
        saved: true,
      },
    },
  };
}

export const storage = {
  load(): AppData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getInitialAppData();
      const parsed = JSON.parse(raw);
      // Validate structure minimally
      if (!parsed.profile || !parsed.skills || !parsed.opportunities) {
        return getInitialAppData();
      }
      return parsed;
    } catch {
      return getInitialAppData();
    }
  },

  save(data: AppData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  },

  reset(): AppData {
    const fresh = getInitialAppData();
    this.save(fresh);
    return fresh;
  },
};
