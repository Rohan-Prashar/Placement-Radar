import {
  Opportunity,
  PriorityItem,
  ResourceItem,
  ResourceProgressMap,
  SkillScores,
  TodayTask,
  UserProfile,
} from './types';
import { RESOURCE_CATALOG, COMPANY_PRACTICE_CATALOG, CompanyPracticeLink } from './resourcesCatalog';

export interface SubjectRecommendation {
  subject: string;
  subjectKey: string;
  radarScore: number;
  priorityLevel: 'critical' | 'high' | 'important' | 'maintain';
  isTopPriority: boolean;
  skillConfidence: number;
  primaryResource: ResourceItem;
  alternativeResource?: ResourceItem;
  recommendedFocusTopics: string[];
  startWithTopic: string;
  estimatedSessionMinutes: number;
  learningMode: string;
  whyRecommended: string;
  matchingCompany?: string;
  pyqLink?: CompanyPracticeLink;
}

export interface UpcomingDriveRecommendation {
  company: string;
  daysRemaining: number;
  assessmentType: string;
  headline: string;
  primarySubjects: {
    subject: string;
    resourceTitle: string;
    provider: string;
    url: string;
    stars: number;
  }[];
  companyPractice: CompanyPracticeLink;
}

/**
 * Maps subject keys to default topics tailored to student confidence (0-10)
 */
export function getTopicsForConfidence(
  subjectKey: string,
  confidence: number
): { focus: string[]; mode: string } {
  const isLow = confidence < 4;
  const isMid = confidence >= 4 && confidence < 8;

  switch (subjectKey) {
    case 'dsa':
      if (isLow) {
        return {
          focus: ['Arrays', 'Strings', 'Sorting', 'Binary Search'],
          mode: 'Foundational Data Structures',
        };
      }
      if (isMid) {
        return {
          focus: ['Arrays', 'Binary Search', 'Sliding Window', 'Two Pointers'],
          mode: 'Core Interview Patterns',
        };
      }
      return {
        focus: ['Dynamic Programming', 'Graphs', 'Trees', 'Heaps'],
        mode: 'Advanced Problem Solving',
      };

    case 'aptitude':
      if (isLow) {
        return {
          focus: ['Number System', 'Percentages', 'Ratio & Proportion', 'Averages'],
          mode: 'Fundamental Arithmetic',
        };
      }
      if (isMid) {
        return {
          focus: ['Percentages', 'Profit & Loss', 'Time & Work', 'Logical Reasoning'],
          mode: 'Placement Speed Drills',
        };
      }
      return {
        focus: ['Time, Speed & Distance', 'Permutation & Combination', 'Probability', 'Data Interpretation'],
        mode: 'High-Accuracy Assessment Drills',
      };

    case 'dbms':
      if (isLow) {
        return {
          focus: ['DBMS Fundamentals', 'ER Model', 'Keys', 'Basic SQL'],
          mode: 'Core Database Foundations',
        };
      }
      if (isMid) {
        return {
          focus: ['SQL Joins', 'Group By', 'Aggregate Functions', 'Normalization (1NF-BCNF)'],
          mode: 'High-Yield SQL & Schema Rules',
        };
      }
      return {
        focus: ['Indexing (B-Trees)', 'ACID Transactions', 'Concurrency Control', 'Query Optimization'],
        mode: 'Database Internals & Systems',
      };

    case 'os':
      if (isLow) {
        return {
          focus: ['Processes', 'Threads', 'CPU Scheduling (FCFS, Round Robin)'],
          mode: 'OS Architecture Fundamentals',
        };
      }
      if (isMid) {
        return {
          focus: ['Deadlocks', 'Synchronization', 'Paging', 'Virtual Memory'],
          mode: 'Core OS Interview Concepts',
        };
      }
      return {
        focus: ['Page Replacement (LRU)', 'Thrashing', 'File Systems', 'Multi-threading Concurrency'],
        mode: 'Systems Engineering Depth',
      };

    case 'networks':
      if (isLow) {
        return {
          focus: ['OSI Model', 'TCP/IP Model', 'IP Addressing'],
          mode: 'Networking Layer Foundations',
        };
      }
      if (isMid) {
        return {
          focus: ['TCP vs UDP', 'HTTP/HTTPS', 'DNS', '3-Way Handshake'],
          mode: 'Core Transport & Application Protocols',
        };
      }
      return {
        focus: ['Routing Protocols (OSPF, BGP)', 'Subnetting', 'Network Security', 'SSL/TLS Handshake'],
        mode: 'Advanced Network Topologies',
      };

    case 'projects':
      if (isLow) {
        return {
          focus: ['Git', 'Frontend', 'REST APIs', 'Basic CRUD'],
          mode: 'Hands-on Full-Stack Fundamentals',
        };
      }
      if (isMid) {
        return {
          focus: ['React State Management', 'Node.js Backend', 'Databases', 'Authentication'],
          mode: 'Production Feature Implementation',
        };
      }
      return {
        focus: ['System Architecture', 'Deployment Pipelines', 'Database Caching', 'Performance Optimization'],
        mode: 'Scalable Full-Stack Engineering',
      };

    case 'system_design':
      if (isLow) {
        return {
          focus: ['Client-Server Architecture', 'Monolith vs Microservices', 'Horizontal Scaling'],
          mode: 'Basic Scalability Concepts',
        };
      }
      if (isMid) {
        return {
          focus: ['Load Balancing', 'Caching Strategies', 'Database Sharding', 'API Design'],
          mode: 'Core Distributed Systems',
        };
      }
      return {
        focus: ['Distributed Systems', 'CAP Theorem', 'Message Queues', 'Rate Limiting'],
        mode: 'Advanced System Architecture',
      };

    case 'interview':
      if (isLow) {
        return {
          focus: ['Self Introduction', 'Resume Discussion', 'Basic HR Questions'],
          mode: 'Introductory Interview Preparation',
        };
      }
      if (isMid) {
        return {
          focus: ['Technical Interview Breakdown', 'Project Explanation', 'Behavioral Questions'],
          mode: 'Structured Round Delivery',
        };
      }
      return {
        focus: ['Mock Interview Simulation', 'Edge Case Defense', 'Complex Architecture Explanation'],
        mode: 'Live Composure & Technical Defense',
      };

    case 'communication':
      if (isLow) {
        return {
          focus: ['Self Introduction', 'Speaking Practice', 'Clear Sentence Phrasing'],
          mode: 'Verbal Clarity & Composure',
        };
      }
      if (isMid) {
        return {
          focus: ['Interview Communication', 'Behavioral Answers', 'STAR Framework'],
          mode: 'Structured Storytelling',
        };
      }
      return {
        focus: ['Professional Communication', 'Executive Summaries', 'Answering Difficult Questions'],
        mode: 'Persuasive Technical Communication',
      };

    default:
      return {
        focus: ['Core Foundations', 'Interview Questions'],
        mode: 'Concept Practice',
      };
  }
}

/**
 * Returns estimated session time based on timeline and urgency
 */
export function getEstimatedSessionTime(
  timelineDays: number,
  isEmergency: boolean,
  priorityLevel: string
): number {
  if (isEmergency || timelineDays <= 2) {
    return priorityLevel === 'critical' ? 35 : 25;
  }
  if (timelineDays <= 7) {
    return priorityLevel === 'critical' ? 40 : 30;
  }
  if (timelineDays <= 14) {
    return 45;
  }
  if (timelineDays <= 60) {
    return 50;
  }
  return 60; // Long-term runway
}

/**
 * Generates personalized "Why this resource" explanation
 */
export function generateWhyExplanation(params: {
  subject: string;
  isTopPriority: boolean;
  score: number;
  level: string;
  confidence: number;
  timelineDays: number;
  isEmergency: boolean;
  nearestOpp: Opportunity | null;
  matchingOppCompany: string | null;
}): string {
  const {
    subject,
    isTopPriority,
    level,
    confidence,
    timelineDays,
    isEmergency,
    nearestOpp,
    matchingOppCompany,
  } = params;

  if (isEmergency || timelineDays <= 2) {
    if (matchingOppCompany) {
      return `Recommended because your ${matchingOppCompany} assessment is tomorrow, confidence is ${confidence}/10, and this gives immediate cutoff impact.`;
    }
    return `Recommended because your nearest assessment is tomorrow and high-frequency practice yields immediate score gain.`;
  }

  if (isTopPriority) {
    if (matchingOppCompany) {
      return `Recommended because ${subject} is your #1 Radar priority with ${matchingOppCompany} coming up in ${nearestOpp?.daysRemaining || 8} days.`;
    }
    return `Recommended because ${subject} is your #1 Radar priority and your confidence is ${confidence}/10.`;
  }

  if (matchingOppCompany) {
    return `Recommended because your upcoming ${matchingOppCompany} drive requires passing ${subject} evaluation.`;
  }

  if (timelineDays >= 60) {
    if (confidence <= 4) {
      return `Recommended because you have ${timelineDays} days runway to systematically fix this ${confidence}/10 confidence gap.`;
    }
    return `Recommended for steady progression toward target interview readiness without cramming.`;
  }

  if (level === 'critical' || level === 'high') {
    return `Recommended because your Radar priority is ${level.toUpperCase()} and this resource covers the exact topics you need next.`;
  }

  return `Recommended to maintain solid proficiency (Confidence ${confidence}/10) with light revision.`;
}

/**
 * Computes all 9 subject recommendations strictly ordered by Radar priority score
 */
export function calculateAllResourceRecommendations(params: {
  profile: UserProfile;
  skills: SkillScores;
  priorities: PriorityItem[];
  opportunities: Opportunity[];
  scenario: 'normal' | 'emergency';
  progress?: ResourceProgressMap;
}): SubjectRecommendation[] {
  const { profile, skills, priorities, opportunities, scenario, progress = {} } = params;
  const isEmergency = scenario === 'emergency' || profile.placementTimelineDays <= 2;

  // Build lookup of radar scores and priority levels
  const priorityMap = new Map<string, PriorityItem>();
  priorities.forEach((p) => {
    priorityMap.set(p.skillKey, p);
  });

  // Calculate System Design synthetic priority score if not in standard 8 skills:
  // Derived from projects (60%) and target role relevance (40%)
  const projectsPriority = priorityMap.get('projects');
  const dsaPriority = priorityMap.get('dsa');
  const roleBonus =
    profile.targetRole.includes('Full Stack') || profile.targetRole.includes('Developer') ? 10 : 0;
  const sysDesignScore = Math.max(
    30,
    Math.min(95, Math.round(((projectsPriority?.score || 50) * 0.6 + (dsaPriority?.score || 50) * 0.4) + roleBonus - 8))
  );

  let sysDesignLevel: 'critical' | 'high' | 'important' | 'maintain' = 'important';
  if (sysDesignScore >= 88) sysDesignLevel = 'critical';
  else if (sysDesignScore >= 72) sysDesignLevel = 'high';
  else if (sysDesignScore >= 50) sysDesignLevel = 'important';
  else sysDesignLevel = 'maintain';

  // 9 canonical subjects with their subjectKey
  const subjectDefs: {
    subject: string;
    subjectKey: string;
    skillConfidence: number;
    score: number;
    level: 'critical' | 'high' | 'important' | 'maintain';
    matchingCompany: string | null;
  }[] = [
    {
      subject: 'Data Structures & Algorithms',
      subjectKey: 'dsa',
      skillConfidence: skills.dsa ?? 5,
      score: priorityMap.get('dsa')?.score ?? 70,
      level: priorityMap.get('dsa')?.level ?? 'high',
      matchingCompany: null,
    },
    {
      subject: 'Aptitude',
      subjectKey: 'aptitude',
      skillConfidence: skills.aptitude ?? 5,
      score: priorityMap.get('aptitude')?.score ?? 65,
      level: priorityMap.get('aptitude')?.level ?? 'high',
      matchingCompany: null,
    },
    {
      subject: 'DBMS & SQL',
      subjectKey: 'dbms',
      skillConfidence: skills.dbms ?? 5,
      score: priorityMap.get('dbms')?.score ?? 60,
      level: priorityMap.get('dbms')?.level ?? 'important',
      matchingCompany: null,
    },
    {
      subject: 'Operating Systems',
      subjectKey: 'os',
      skillConfidence: skills.os ?? 5,
      score: priorityMap.get('os')?.score ?? 55,
      level: priorityMap.get('os')?.level ?? 'important',
      matchingCompany: null,
    },
    {
      subject: 'Computer Networks',
      subjectKey: 'networks',
      skillConfidence: skills.networks ?? 5,
      score: priorityMap.get('networks')?.score ?? 50,
      level: priorityMap.get('networks')?.level ?? 'maintain',
      matchingCompany: null,
    },
    {
      subject: 'Projects / Full Stack',
      subjectKey: 'projects',
      skillConfidence: skills.projects ?? 7,
      score: priorityMap.get('projects')?.score ?? 68,
      level: priorityMap.get('projects')?.level ?? 'high',
      matchingCompany: null,
    },
    {
      subject: 'System Design',
      subjectKey: 'system_design',
      skillConfidence: Math.max(1, Math.min(10, Math.round((skills.projects + skills.dsa) / 2))),
      score: sysDesignScore,
      level: sysDesignLevel,
      matchingCompany: null,
    },
    {
      subject: 'Interview Preparation',
      subjectKey: 'interview',
      skillConfidence: skills.interview ?? 5,
      score: priorityMap.get('interview')?.score ?? 62,
      level: priorityMap.get('interview')?.level ?? 'important',
      matchingCompany: null,
    },
    {
      subject: 'Communication',
      subjectKey: 'communication',
      skillConfidence: skills.communication ?? 5,
      score: priorityMap.get('communication')?.score ?? 50,
      level: priorityMap.get('communication')?.level ?? 'maintain',
      matchingCompany: null,
    },
  ];

  // Match opportunities
  const sortedOpps = [...opportunities].sort((a, b) => a.daysRemaining - b.daysRemaining);
  const nearestOpp = sortedOpps[0] || null;

  subjectDefs.forEach((def) => {
    for (const opp of sortedOpps) {
      const oppText = `${opp.assessmentType} ${opp.requiredSkills.join(' ')}`.toLowerCase();
      if (
        (def.subjectKey === 'aptitude' && oppText.includes('aptitude')) ||
        (def.subjectKey === 'dsa' && (oppText.includes('coding') || oppText.includes('dsa'))) ||
        (def.subjectKey === 'system_design' && oppText.includes('system design')) ||
        (def.subjectKey === 'projects' && (oppText.includes('project') || oppText.includes('pair coding')))
      ) {
        def.matchingCompany = opp.company;
        break;
      }
    }
  });

  // Sort subjects strictly according to existing Placement Radar priority score (descending)
  subjectDefs.sort((a, b) => b.score - a.score);

  // Map to recommendations
  const recommendations: SubjectRecommendation[] = subjectDefs.map((def, idx) => {
    const isTopPriority = idx === 0;

    // Retrieve primary and alternative resources from catalog
    const primaryResource =
      RESOURCE_CATALOG.find((r) => r.subjectKey === def.subjectKey && !r.isAlternative) ||
      RESOURCE_CATALOG.find((r) => r.subjectKey === def.subjectKey)!;

    const alternativeResource = RESOURCE_CATALOG.find(
      (r) => r.subjectKey === def.subjectKey && r.isAlternative
    );

    // Topic personalization by confidence
    const { focus, mode } = getTopicsForConfidence(def.subjectKey, def.skillConfidence);

    // If emergency, adapt topics to rapid high-yield revision
    let effectiveFocus = [...focus];
    if (isEmergency) {
      if (def.subjectKey === 'aptitude') {
        effectiveFocus = ['Percentages & Speed Formulas', 'Time & Work Shortcuts', 'Ratio Drills'];
      } else if (def.subjectKey === 'dsa') {
        effectiveFocus = ['Arrays & Two Pointers', 'Binary Search Boundary Checks'];
      } else if (def.subjectKey === 'dbms') {
        effectiveFocus = ['Top 10 SQL Joins', 'ACID Properties Quick Revision'];
      }
    }

    // Check user progress on completed topics for this resource
    const userProg = progress[primaryResource.id];
    const completedList = userProg?.completedTopics || [];

    // Filter to find the next uncompleted topic to start with
    const nextUncompletedTopic =
      effectiveFocus.find((t) => !completedList.includes(t)) ||
      primaryResource.topics.find((t) => !completedList.includes(t)) ||
      effectiveFocus[0];

    const estimatedSessionMinutes = getEstimatedSessionTime(
      profile.placementTimelineDays,
      isEmergency,
      def.level
    );

    const whyRecommended = generateWhyExplanation({
      subject: def.subject,
      isTopPriority,
      score: def.score,
      level: def.level,
      confidence: def.skillConfidence,
      timelineDays: profile.placementTimelineDays,
      isEmergency,
      nearestOpp,
      matchingOppCompany: def.matchingCompany,
    });

    // PYQ Practice link
    let pyqLink: CompanyPracticeLink | undefined;
    if (def.matchingCompany) {
      pyqLink = COMPANY_PRACTICE_CATALOG.find((c) =>
        def.matchingCompany?.toLowerCase().includes(c.company.toLowerCase())
      );
    }
    if (!pyqLink) {
      pyqLink = COMPANY_PRACTICE_CATALOG.find((c) => c.company === 'General');
    }

    return {
      subject: def.subject,
      subjectKey: def.subjectKey,
      radarScore: def.score,
      priorityLevel: def.level,
      isTopPriority,
      skillConfidence: def.skillConfidence,
      primaryResource,
      alternativeResource,
      recommendedFocusTopics: effectiveFocus,
      startWithTopic: nextUncompletedTopic,
      estimatedSessionMinutes,
      learningMode: isEmergency ? 'Emergency Cutoff Revision' : mode,
      whyRecommended,
      matchingCompany: def.matchingCompany || undefined,
      pyqLink,
    };
  });

  return recommendations;
}

/**
 * Builds specific company recommendation block (e.g. Infosys Campus Drive)
 */
export function getCompanyDriveRecommendation(
  opportunities: Opportunity[]
): UpcomingDriveRecommendation | null {
  if (!opportunities.length) return null;

  const sorted = [...opportunities].sort((a, b) => a.daysRemaining - b.daysRemaining);
  const nearest = sorted[0];

  const matchingCompanyPractice =
    COMPANY_PRACTICE_CATALOG.find((c) =>
      nearest.company.toLowerCase().includes(c.company.toLowerCase())
    ) || COMPANY_PRACTICE_CATALOG[0];

  const primarySubjects: {
    subject: string;
    resourceTitle: string;
    provider: string;
    url: string;
    stars: number;
  }[] = [];

  const text = `${nearest.assessmentType} ${nearest.requiredSkills.join(' ')}`.toLowerCase();

  if (text.includes('aptitude')) {
    primarySubjects.push({
      subject: 'Aptitude',
      resourceTitle: 'IndiaBIX Quantitative Aptitude',
      provider: 'IndiaBIX',
      url: 'https://www.indiabix.com/aptitude/questions-and-answers/',
      stars: 5,
    });
  }

  if (text.includes('coding') || text.includes('dsa')) {
    primarySubjects.push({
      subject: 'Coding / DSA',
      resourceTitle: 'Striver A2Z DSA Sheet',
      provider: 'Take U Forward',
      url: 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2',
      stars: 5,
    });
  }

  if (text.includes('system design')) {
    primarySubjects.push({
      subject: 'System Design',
      resourceTitle: 'System Design Roadmap',
      provider: 'roadmap.sh',
      url: 'https://roadmap.sh/system-design',
      stars: 5,
    });
  }

  if (primarySubjects.length === 0) {
    primarySubjects.push(
      {
        subject: 'Aptitude & Speed Math',
        resourceTitle: 'IndiaBIX Aptitude',
        provider: 'IndiaBIX',
        url: 'https://www.indiabix.com/aptitude/questions-and-answers/',
        stars: 5,
      },
      {
        subject: 'Algorithmic Coding',
        resourceTitle: 'Striver A2Z DSA Sheet',
        provider: 'Take U Forward',
        url: 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2',
        stars: 5,
      }
    );
  }

  return {
    company: nearest.company,
    daysRemaining: nearest.daysRemaining,
    assessmentType: nearest.assessmentType,
    headline: `RECOMMENDED FOR ${nearest.company.toUpperCase()}`,
    primarySubjects,
    companyPractice: matchingCompanyPractice,
  };
}

/**
 * Direct lookup helper for connecting Today's Plan tasks to resources
 */
export function getResourceForTask(task: TodayTask): {
  resourceTitle: string;
  provider: string;
  url: string;
  pyqUrl?: string;
  practiceTopic: string;
} {
  const text = `${task.topic} ${task.title}`.toLowerCase();

  if (text.includes('aptitude') || text.includes('math') || text.includes('speed drill')) {
    return {
      resourceTitle: 'IndiaBIX Quantitative Aptitude',
      provider: 'IndiaBIX',
      url: 'https://www.indiabix.com/aptitude/questions-and-answers/',
      pyqUrl: 'https://www.indiabix.com/placement-papers/companies/',
      practiceTopic: text.includes('work') ? 'Time & Work' : text.includes('ratio') ? 'Ratios & Proportions' : 'Percentages & Speed Math',
    };
  }

  if (text.includes('coding') || text.includes('dsa') || text.includes('pointer') || text.includes('algorithm')) {
    return {
      resourceTitle: 'Striver A2Z DSA Sheet',
      provider: 'Take U Forward',
      url: 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2',
      pyqUrl: 'https://takeuforward.org/interviews/must-do-questions-for-companies-like-amazon-microsoft-adobe/',
      practiceTopic: text.includes('sliding') ? 'Sliding Window' : text.includes('pointer') ? 'Two Pointers' : 'Arrays & Binary Search',
    };
  }

  if (text.includes('dbms') || text.includes('sql') || text.includes('query')) {
    return {
      resourceTitle: 'Gate Smashers DBMS Course',
      provider: 'Gate Smashers',
      url: 'https://www.youtube.com/playlist?list=PLxCzCOWd7aiFAN6I8CUCqq5GTKAaznw6t',
      pyqUrl: 'https://www.geeksforgeeks.org/dbms-interview-questions/',
      practiceTopic: 'SQL Joins & Indexing',
    };
  }

  if (text.includes('os') || text.includes('operating')) {
    return {
      resourceTitle: 'Gate Smashers Operating Systems',
      provider: 'Gate Smashers',
      url: 'https://www.youtube.com/playlist?list=PLxCzCOWd7aiGz9donHRrE9I3Mwn6XdP8p',
      pyqUrl: 'https://www.geeksforgeeks.org/operating-systems-interview-questions/',
      practiceTopic: 'Processes & Deadlocks',
    };
  }

  if (text.includes('network') || text.includes('tcp') || text.includes('cn')) {
    return {
      resourceTitle: 'Gate Smashers Computer Networks',
      provider: 'Gate Smashers',
      url: 'https://www.youtube.com/playlist?list=PLxCzCOWd7aiGFBD2-2joCpWOLUrDLvVV_',
      pyqUrl: 'https://www.geeksforgeeks.org/top-50-computer-network-interview-questions-and-answers/',
      practiceTopic: 'OSI & TCP/IP Protocol Stack',
    };
  }

  if (text.includes('mock') || text.includes('pyq') || text.includes('assessment simulation')) {
    return {
      resourceTitle: 'Infosys & IT Campus PYQ Papers',
      provider: 'GeeksforGeeks',
      url: 'https://www.geeksforgeeks.org/infosys-recruitment-process/',
      pyqUrl: 'https://www.indiabix.com/placement-papers/companies/',
      practiceTopic: 'Timed Mock Test Simulation',
    };
  }

  if (text.includes('project') || text.includes('architecture') || text.includes('design')) {
    return {
      resourceTitle: 'Full Stack Developer Roadmap',
      provider: 'roadmap.sh',
      url: 'https://roadmap.sh/full-stack',
      practiceTopic: 'API Architecture & Database Design',
    };
  }

  return {
    resourceTitle: 'Campus Placement Preparation Guide',
    provider: 'GeeksforGeeks',
    url: 'https://www.geeksforgeeks.org/campus-placement-preparation/',
    pyqUrl: 'https://www.indiabix.com/hr-interview/questions-and-answers/',
    practiceTopic: 'Technical Pitch & Project Explanation',
  };
}

/**
 * Returns primary resource for a given SkillKey
 */
export function getPrimaryResourceForSkill(skillKey: string): ResourceItem | undefined {
  return RESOURCE_CATALOG.find((r) => r.subjectKey === skillKey && !r.isAlternative);
}

