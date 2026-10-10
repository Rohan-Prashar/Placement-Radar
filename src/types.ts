export interface SkillScores {
  dsa: number; // 0-10
  aptitude: number; // 0-10
  dbms: number; // 0-10
  os: number; // 0-10
  networks: number; // 0-10
  projects: number; // 0-10
  communication: number; // 0-10
  interview: number; // 0-10
}

export type SkillKey = keyof SkillScores;

export interface Opportunity {
  id: string;
  company: string;
  daysRemaining: number;
  assessmentType: string;
  requiredSkills: string[]; // e.g. ['Aptitude', 'Coding', 'DSA', 'System Design']
  role?: string;
}

export interface UserProfile {
  name: string;
  targetRole: string; // e.g. "Software Developer"
  currentYear: string; // e.g. "3rd Year" | "Final Year"
  placementTimelineDays: number; // e.g. 30
  dailyStudyHours: number; // e.g. 2
  targetOpportunityTypes: string[]; // e.g. ["Product Companies", "Service Companies", "Startups"]
}

export type PriorityLevel = 'critical' | 'high' | 'important' | 'maintain';

export interface PriorityScoreBreakdown {
  skillGap: number; // 0 - 100
  urgency: number; // 0 - 100
  assessmentRelevance: number; // 0 - 100
  roleRelevance: number; // 0 - 100
}

export interface PriorityItem {
  id: string;
  topic: string;
  skillKey: SkillKey;
  score: number; // 0 - 100
  level: PriorityLevel;
  reason: string;
  whyThisMatters: string;
  breakdown: PriorityScoreBreakdown;
}

export interface TodayTask {
  id: string;
  topic: string;
  title: string;
  durationMinutes: number;
  priority: PriorityLevel;
  description: string;
  objective?: string;
  recommendedActivity?: string;
  completed: boolean;
}

export interface SkipTopic {
  topic: string;
  reason: string;
  focusInstead: string;
}

export interface RadarState {
  lastCalculatedAt: string;
  scenario: 'normal' | 'emergency';
  needsRecalculation: boolean;
  readinessScore: number; // 0 - 100
  summaryInsight: string;
  priorities: PriorityItem[];
  todayPlan: TodayTask[];
  skipToday: SkipTopic[];
  aiReasoning: string;
  isAiGenerated: boolean;
}

export interface AppSettings {
  aiAggressiveness: 'Conservative' | 'Balanced' | 'Aggressive';
  notificationsEnabled: boolean;
  preferredStudyDays: string[];
}

export interface ResourceItem {
  id: string;
  subject: string;
  subjectKey: SkillKey | 'system_design';
  title: string;
  provider: string;
  type: string;
  url: string;
  pyqUrl?: string;
  description: string;
  level:
    | 'Beginner'
    | 'Intermediate'
    | 'Advanced'
    | 'Beginner to Advanced'
    | 'Beginner to Intermediate'
    | 'Intermediate to Advanced';
  estimatedTime: string;
  topics: string[];
  isAlternative?: boolean;
}

export interface ResourceProgressItem {
  status: 'not_started' | 'studying' | 'completed';
  completedTopics: string[];
  saved?: boolean;
}

export type ResourceProgressMap = Record<string, ResourceProgressItem>;

export interface AppData {
  profile: UserProfile;
  skills: SkillScores;
  opportunities: Opportunity[];
  radarState: RadarState;
  settings: AppSettings;
  resourceProgress?: ResourceProgressMap;
}

