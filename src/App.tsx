import React, { useState, useEffect } from 'react';
import {
  Compass,
  LayoutDashboard,
  Radar,
  BrainCircuit,
  Briefcase,
  CheckSquare,
  Settings as SettingsIcon,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  X,
  Target,
  Menu,
  BookOpen,
} from 'lucide-react';
import { AppData, Opportunity, PriorityItem, ResourceProgressItem, SkillScores, TodayTask, UserProfile } from './types';
import { storage } from './storage';
import {
  calculateDeterministicPriorities,
  calculateReadinessScore,
  generateDeterministicPlan,
  generateDeterministicSkip,
  SKILL_METADATA,
  formatTimelineDisplay,
  TIMELINE_OPTIONS,
} from './radarEngine';
import {
  getResourceForTask,
  getPrimaryResourceForSkill,
  getTopicsForConfidence,
} from './resourcesEngine';
import { COMPANY_PRACTICE_CATALOG } from './resourcesCatalog';
import { RadarVisualization } from './components/RadarVisualization';
import { TaskDetailModal } from './components/TaskDetailModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { LandingPage } from './components/LandingPage';
import { StudyResourcesView } from './components/StudyResourcesView';

export default function App() {
  const [appData, setAppData] = useState<AppData>(() => storage.load());
  const [currentRoute, setCurrentRoute] = useState<string>('landing'); // 'landing' | 'onboarding' | 'dashboard' | 'radar' | 'skills' | 'opportunities' | 'today' | 'resources' | 'settings'
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Modals & Drawers
  const [selectedTask, setSelectedTask] = useState<TodayTask | null>(null);
  const [whyDrawerItem, setWhyDrawerItem] = useState<PriorityItem | null>(null);
  const [addOppModalOpen, setAddOppModalOpen] = useState<boolean>(false);

  // New opportunity form state
  const [newOppCompany, setNewOppCompany] = useState('');
  const [newOppDays, setNewOppDays] = useState('7');
  const [newOppType, setNewOppType] = useState('Aptitude + Coding');
  const [newOppSkills, setNewOppSkills] = useState('Aptitude, Coding');

  // Sync to storage on state change
  useEffect(() => {
    storage.save(appData);
  }, [appData]);

  const showToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  /**
   * Signature Core Function: Recalculate Radar
   * Runs deterministic priority calculation first, then queries backend Gemini API
   * for human explanations, 2-hour daily plan, and "what to skip".
   */
  const handleRecalculateRadar = async (forcedScenario?: 'normal' | 'emergency') => {
    setIsRecalculating(true);
    const scenarioToUse = forcedScenario || appData.radarState.scenario;

    // 1. Calculate deterministic priority items
    const newPriorities = calculateDeterministicPriorities(
      appData.skills,
      appData.opportunities,
      appData.profile.targetRole,
      appData.profile.placementTimelineDays
    );
    const newReadiness = calculateReadinessScore(
      appData.skills,
      appData.opportunities,
      appData.profile.placementTimelineDays
    );

    // Fallback deterministic today plan and skip
    let fallbackPlan = generateDeterministicPlan(
      newPriorities,
      scenarioToUse,
      appData.profile.placementTimelineDays
    );
    let fallbackSkip = generateDeterministicSkip(scenarioToUse, appData.profile.placementTimelineDays);
    let aiReasoning =
      scenarioToUse === 'emergency'
        ? 'Your aptitude confidence is 4/10, your nearest assessment is tomorrow, and aptitude is a major part of the assessment. This gives aptitude the highest short-term impact.'
        : appData.profile.placementTimelineDays >= 60
        ? `With approximately ${appData.profile.placementTimelineDays} days runway until placement season, urgency is low. Focus on deep conceptual foundation and eliminating your largest skill gaps.`
        : 'With 8 days until Infosys and 18 days until XYZ Startup, consistent daily practice in Aptitude and DSA provides maximum dual-coverage.';
    let summary =
      scenarioToUse === 'emergency'
        ? 'Your nearest deadline is tomorrow. Your highest-impact focus today is Quantitative Aptitude.'
        : appData.profile.placementTimelineDays >= 60
        ? `Long-term horizon active (${formatTimelineDisplay(appData.profile.placementTimelineDays).label}). Focus on building deep fundamentals.`
        : 'Your nearest deadline is in 8 days. Your highest-impact focus today is Aptitude & DSA.';

    try {
      // 2. Call server-side proxy route for structured Gemini response
      const res = await fetch('/api/radar/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: appData.profile,
          skills: appData.skills,
          opportunities: appData.opportunities,
          deterministicPriorities: newPriorities,
          scenario: scenarioToUse,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.aiReasoning) aiReasoning = data.aiReasoning;
        if (data.summary) summary = data.summary;
        if (Array.isArray(data.todayPlan) && data.todayPlan.length > 0) {
          fallbackPlan = data.todayPlan.map((p: any, idx: number) => ({
            id: `task-${idx + 1}`,
            topic: p.topic || 'Core Prep',
            title: p.title || 'Practice Task',
            durationMinutes: p.durationMinutes || 30,
            priority: p.priority || 'high',
            description: p.description || '',
            objective: p.objective || '',
            recommendedActivity: p.recommendedActivity || '',
            completed: idx === 0, // keep first task done for preview
          }));
        }
        if (Array.isArray(data.skipToday) && data.skipToday.length > 0) {
          fallbackSkip = data.skipToday;
        }
      }
    } catch (err) {
      console.warn('Recalculate call failed, utilizing deterministic engine fallback:', err);
    } finally {
      // 3. Update application state smoothly
      setTimeout(() => {
        setAppData((prev) => ({
          ...prev,
          radarState: {
            ...prev.radarState,
            lastCalculatedAt: new Date().toISOString(),
            scenario: scenarioToUse,
            needsRecalculation: false,
            readinessScore: newReadiness,
            summaryInsight: summary,
            priorities: newPriorities,
            todayPlan: fallbackPlan,
            skipToday: fallbackSkip,
            aiReasoning,
            isAiGenerated: true,
          },
        }));
        setIsRecalculating(false);
        showToast('✓ Radar recalculated', 'Assessment urgency changed your priorities.');
      }, 350);
    }
  };

  /**
   * Signature Demo: Emergency Pivot Switcher
   * Switches Infosys between 8 days left and 1 day left and recalculates
   */
  const handleScenarioSwitch = (scenario: 'normal' | 'emergency') => {
    const updatedOpportunities = appData.opportunities.map((opp) => {
      if (opp.company.toLowerCase().includes('infosys')) {
        return {
          ...opp,
          daysRemaining: scenario === 'emergency' ? 1 : 8,
        };
      }
      return opp;
    });

    setAppData((prev) => ({
      ...prev,
      opportunities: updatedOpportunities,
      radarState: {
        ...prev.radarState,
        scenario,
        needsRecalculation: true,
      },
    }));

    handleRecalculateRadar(scenario);
  };

  /**
   * Try Demo Profile loader
   */
  const handleLoadDemo = () => {
    const fresh = storage.reset();
    setAppData(fresh);
    setCurrentRoute('dashboard');
    showToast('Alex Demo Profile Loaded', 'Software Developer target with Infosys and XYZ Startup opportunities loaded.');
  };

  const handleFinishOnboarding = (profile: UserProfile, skills: SkillScores) => {
    const freshOpps = [...appData.opportunities];
    const newPriorities = calculateDeterministicPriorities(
      skills,
      freshOpps,
      profile.targetRole,
      profile.placementTimelineDays
    );
    const newReadiness = calculateReadinessScore(skills, freshOpps, profile.placementTimelineDays);
    const initialScenario = profile.placementTimelineDays <= 7 ? 'emergency' : 'normal';
    const todayPlan = generateDeterministicPlan(newPriorities, initialScenario, profile.placementTimelineDays);
    const skipToday = generateDeterministicSkip(initialScenario, profile.placementTimelineDays);

    const timelineInfo = formatTimelineDisplay(profile.placementTimelineDays);
    const summaryInsight =
      profile.placementTimelineDays >= 60
        ? `Long-term preparation active (${timelineInfo.label} runway). Your highest-impact focus is building deep fundamentals in ${newPriorities[0]?.topic || 'Core Skills'}.`
        : 'Your nearest deadline is upcoming. Focus on high-yield assessment preparation.';

    const aiReasoning =
      profile.placementTimelineDays >= 60
        ? `With ${timelineInfo.approximateDays.toLowerCase()} urgency is low. Prioritizing large foundational skill gaps and role requirements produces the strongest long-term placement trajectory.`
        : 'Your nearest assessment deadline requires targeted preparation in critical cutoff topics.';

    const updated: AppData = {
      ...appData,
      profile,
      skills,
      radarState: {
        lastCalculatedAt: new Date().toISOString(),
        scenario: initialScenario,
        needsRecalculation: false,
        readinessScore: newReadiness,
        summaryInsight,
        priorities: newPriorities,
        todayPlan,
        skipToday,
        aiReasoning,
        isAiGenerated: false,
      },
    };

    setAppData(updated);
    storage.save(updated);
    setCurrentRoute('dashboard');
    showToast('Radar Initialized', `Welcome ${profile.name}! Your priority radar is active.`);
  };

  const handleToggleTaskComplete = (taskId: string) => {
    setAppData((prev) => {
      const updatedPlan = prev.radarState.todayPlan.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      return {
        ...prev,
        radarState: {
          ...prev.radarState,
          todayPlan: updatedPlan,
        },
      };
    });
  };

  const handleUpdateResourceProgress = (
    resourceId: string,
    partial: Partial<ResourceProgressItem>
  ) => {
    setAppData((prev) => {
      const current = prev.resourceProgress || {};
      const existing = current[resourceId] || {
        status: 'not_started',
        completedTopics: [],
        saved: false,
      };
      return {
        ...prev,
        resourceProgress: {
          ...current,
          [resourceId]: { ...existing, ...partial },
        },
      };
    });
  };


  const handleSkillChange = (key: keyof SkillScores, val: number) => {
    setAppData((prev) => {
      const nextSkills = { ...prev.skills, [key]: val };
      const nextReadiness = calculateReadinessScore(nextSkills, prev.opportunities);
      return {
        ...prev,
        skills: nextSkills,
        radarState: {
          ...prev.radarState,
          needsRecalculation: true,
          readinessScore: nextReadiness,
        },
      };
    });
  };

  const handleAddOpportunity = () => {
    if (!newOppCompany.trim()) return;
    const days = parseInt(newOppDays) || 7;
    const opp: Opportunity = {
      id: `opp-${Date.now()}`,
      company: newOppCompany.trim(),
      daysRemaining: days,
      assessmentType: newOppType,
      requiredSkills: newOppSkills.split(',').map((s) => s.trim()).filter(Boolean),
    };

    setAppData((prev) => ({
      ...prev,
      opportunities: [opp, ...prev.opportunities],
      radarState: {
        ...prev.radarState,
        needsRecalculation: true,
      },
    }));

    setAddOppModalOpen(false);
    setNewOppCompany('');
    showToast('Opportunity Added', `${opp.company} scheduled in ${days} days. Radar marked for recalculation.`);
  };

  const handleDeleteOpportunity = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      opportunities: prev.opportunities.filter((o) => o.id !== id),
      radarState: {
        ...prev.radarState,
        needsRecalculation: true,
      },
    }));
    showToast('Opportunity Removed', 'Upcoming opportunity removed.');
  };

  // Nearest deadline helper
  const sortedOpps = [...appData.opportunities].sort((a, b) => a.daysRemaining - b.daysRemaining);
  const nearestOpp = sortedOpps[0] || null;

  // Task Completion count & percentage
  const completedTasks = appData.radarState.todayPlan.filter((t) => t.completed).length;
  const totalTasks = appData.radarState.todayPlan.length || 1;
  const planCompletionPct = Math.round((completedTasks / totalTasks) * 100);

  // Routing Views
  if (currentRoute === 'landing') {
    return (
      <LandingPage
        onStartOnboarding={() => setCurrentRoute('onboarding')}
        onLaunchDemo={handleLoadDemo}
      />
    );
  }

  if (currentRoute === 'onboarding') {
    return (
      <OnboardingWizard
        initialProfile={appData.profile}
        initialSkills={appData.skills}
        onComplete={handleFinishOnboarding}
        onCancel={() => setCurrentRoute('landing')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* ========================================== */}
      {/* TOP PERSISTENT CONTROLLER / SCENARIO BAR */}
      {/* ========================================== */}
      <header className="bg-slate-900 text-slate-100 text-xs sticky top-0 z-50 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-extrabold uppercase tracking-wider text-[11px] text-indigo-300">
            DEMO SCENARIOS:
          </span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            1-Click Contextual Reprioritization:
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-[11px]">
          {/* Scenario B: Emergency Pivot */}
          <button
            onClick={() => handleScenarioSwitch('emergency')}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 font-bold ${
              appData.radarState.scenario === 'emergency'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>🚨 Scenario B: Emergency Pivot (1d Left)</span>
          </button>

          {/* Scenario A: Normal Horizon */}
          <button
            onClick={() => handleScenarioSwitch('normal')}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 font-bold ${
              appData.radarState.scenario === 'normal'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>📅 Scenario A: Normal Horizon (8d Left)</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1 hidden md:block" />

          {/* Recalculate Radar Button */}
          <button
            onClick={() => handleRecalculateRadar()}
            disabled={isRecalculating}
            className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Recalculating...' : 'Recalculate Radar'}</span>
          </button>

          <button
            onClick={handleLoadDemo}
            className="px-2 py-1 rounded text-slate-400 hover:text-white transition"
          >
            Reset Demo
          </button>
        </div>
      </header>

      {/* Recalculation Notification Banner when radar needs recalculation */}
      {appData.radarState.needsRecalculation && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold">Radar needs recalculation:</span>
            <span>Skills or deadlines modified. Update your priority order now.</span>
          </div>
          <button
            onClick={() => handleRecalculateRadar()}
            className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-xs transition"
          >
            ⚡ Recalculate Radar
          </button>
        </div>
      )}

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed top-14 right-6 z-50 max-w-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-white border-2 border-indigo-600 shadow-2xl rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-extrabold text-slate-900">{toastMessage.title}</h4>
              <p className="text-xs text-slate-600 mt-0.5">{toastMessage.desc}</p>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* APPLICATION SHELL */}
      {/* ========================================== */}
      <div className="flex-1 flex w-full relative">
        {/* DESKTOP SIDEBAR */}
        <aside className="h-screen w-64 flex flex-col fixed left-0 top-0 border-r border-slate-200 bg-white shadow-2xs z-40 hidden md:flex justify-between p-4 pt-14">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-indigo-700 tracking-tight">
                  PLACEMENT RADAR
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Placement Readiness
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="flex flex-col gap-1 mt-3">
              <button
                onClick={() => setCurrentRoute('dashboard')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
                  currentRoute === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setCurrentRoute('radar')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
                  currentRoute === 'radar'
                    ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Radar className="w-4 h-4" />
                <span>Placement Radar</span>
              </button>

              <button
                onClick={() => setCurrentRoute('skills')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
                  currentRoute === 'skills'
                    ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BrainCircuit className="w-4 h-4" />
                <span>My Skills</span>
              </button>

              <button
                onClick={() => setCurrentRoute('opportunities')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
                  currentRoute === 'opportunities'
                    ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Opportunities</span>
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-indigo-700 font-extrabold">
                  {appData.opportunities.length}
                </span>
              </button>

              <button
                onClick={() => setCurrentRoute('today')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
                  currentRoute === 'today'
                    ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Today's Plan</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              </button>

              <button
                onClick={() => setCurrentRoute('resources')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
                  currentRoute === 'resources'
                    ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Study Resources</span>
                <span className="ml-auto text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  Curated
                </span>
              </button>
            </nav>
          </div>

          {/* Quick Diagnostic & Bottom Profile */}
          <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => {
                setCurrentRoute('skills');
                showToast('Quick Diagnostic Active', 'Calibrate any slider to evaluate live score shifts.');
              }}
              className="w-full py-2 px-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Diagnostic</span>
            </button>

            <button
              onClick={() => setCurrentRoute('settings')}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                currentRoute === 'settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>

            {/* Bottom Profile card as requested */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                {appData.profile.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">{appData.profile.name}</h4>
                <p className="text-[11px] text-slate-500 truncate">{appData.profile.targetRole}</p>
                <span className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ● Radar Active
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN ROUTE VIEW */}
        <div className="flex-1 md:ml-64 flex flex-col min-h-screen pb-20 md:pb-8">
          {/* Top Bar Navigation */}
          <header className="flex justify-between items-center h-16 w-full px-6 sticky top-8 bg-white border-b border-slate-200 z-30 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="text-slate-900 font-bold text-sm capitalize">
                  {currentRoute === 'resources'
                    ? 'Study Resources'
                    : currentRoute === 'today'
                    ? "Today's Plan"
                    : currentRoute}
                </span>
                <span>/</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  ● Radar Active
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleRecalculateRadar()}
                disabled={isRecalculating}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                <span>Recalculate Radar</span>
              </button>

              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px] font-bold">
                <button
                  onClick={() => handleScenarioSwitch('emergency')}
                  className={`px-2.5 py-1 rounded transition ${
                    appData.radarState.scenario === 'emergency'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1 Day Left
                </button>
                <button
                  onClick={() => handleScenarioSwitch('normal')}
                  className={`px-2.5 py-1 rounded transition ${
                    appData.radarState.scenario === 'normal'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  8 Days Left
                </button>
              </div>

              <div
                onClick={() => setCurrentRoute('settings')}
                className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-indigo-600 transition"
              >
                {appData.profile.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </header>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 text-sm font-bold shadow-md z-30">
              <button
                onClick={() => {
                  setCurrentRoute('dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 ${
                  currentRoute === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => {
                  setCurrentRoute('radar');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 ${
                  currentRoute === 'radar' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <Radar className="w-4 h-4" />
                <span>Placement Radar</span>
              </button>
              <button
                onClick={() => {
                  setCurrentRoute('resources');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 ${
                  currentRoute === 'resources' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Study Resources</span>
              </button>
              <button
                onClick={() => {
                  setCurrentRoute('today');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 ${
                  currentRoute === 'today' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Today's Plan</span>
              </button>
              <button
                onClick={() => {
                  setCurrentRoute('skills');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 ${
                  currentRoute === 'skills' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <BrainCircuit className="w-4 h-4" />
                <span>My Skills</span>
              </button>
              <button
                onClick={() => {
                  setCurrentRoute('opportunities');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 ${
                  currentRoute === 'opportunities' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Opportunities ({appData.opportunities.length})</span>
              </button>
            </div>
          )}


          {/* ========================================== */}
          {/* VIEW: DASHBOARD */}
          {/* ========================================== */}
          {currentRoute === 'dashboard' && (
            <main className="p-4 sm:p-6 space-y-6">
              {/* Dashboard Hero Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-700 to-indigo-600 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-semibold mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>● Radar Active</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold">
                    Good morning, {appData.profile.name}.
                  </h1>
                  <p className="text-sm text-indigo-100 mt-1">
                    Your nearest deadline is {nearestOpp?.daysRemaining === 1 ? 'tomorrow' : `in ${nearestOpp?.daysRemaining || 8} days`}.
                  </p>
                  <p className="text-sm text-white font-bold mt-0.5">
                    Your highest-impact focus today is {appData.radarState.priorities[0]?.topic || 'Quantitative Aptitude'}.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setCurrentRoute('today')}
                    className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold shadow-xs hover:bg-slate-100 transition active:scale-95"
                  >
                    Start Today's Plan →
                  </button>
                  <button
                    onClick={() => setCurrentRoute('resources')}
                    className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition border border-white/20 flex items-center gap-1.5"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Study Resources</span>
                  </button>
                  <button
                    onClick={() => setCurrentRoute('radar')}
                    className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition border border-white/20"
                  >
                    Inspect Radar
                  </button>
                </div>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Placement Readiness</span>
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {appData.radarState.readinessScore}%
                    </span>
                    <span className="text-xs font-bold text-emerald-600 flex items-center">
                      +8% this week
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-500"
                      style={{ width: `${appData.radarState.readinessScore}%` }}
                    />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {nearestOpp ? 'Next Deadline' : 'Placement Runway'}
                    </span>
                    <Clock className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="my-3">
                    <span className="text-2xl font-extrabold text-rose-700 block">
                      {nearestOpp?.daysRemaining === 1
                        ? '🔴 1 DAY LEFT'
                        : nearestOpp
                        ? `📅 ${nearestOpp.daysRemaining} DAYS LEFT`
                        : `${formatTimelineDisplay(appData.profile.placementTimelineDays).label} RUNWAY`}
                    </span>
                    <p className="text-xs text-slate-600 truncate font-semibold mt-0.5">
                      {nearestOpp ? nearestOpp.company : `Target: ${appData.profile.targetRole}`}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {nearestOpp
                        ? nearestOpp.assessmentType
                        : formatTimelineDisplay(appData.profile.placementTimelineDays).approximateDays}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                      nearestOpp?.daysRemaining === 1
                        ? 'bg-rose-600 text-white animate-pulse'
                        : appData.profile.placementTimelineDays >= 60
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {nearestOpp?.daysRemaining === 1
                      ? 'EMERGENCY PIVOT'
                      : appData.profile.placementTimelineDays >= 60
                      ? `LONG-TERM (${formatTimelineDisplay(appData.profile.placementTimelineDays).label.toUpperCase()})`
                      : 'NORMAL HORIZON'}
                  </span>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Today's Focus</span>
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="my-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {appData.profile.dailyStudyHours} HOURS
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      / {appData.radarState.todayPlan.length} tasks
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {planCompletionPct}% complete ({totalTasks - completedTasks} tasks remaining)
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Biggest Risk</span>
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="my-3">
                    <span className="text-base font-bold text-rose-700 block truncate">
                      {appData.radarState.priorities[0]?.topic || 'Quantitative Aptitude'}
                    </span>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Confidence {appData.skills[appData.radarState.priorities[0]?.skillKey || 'aptitude']}/10
                    </p>
                  </div>
                  <button
                    onClick={() => setWhyDrawerItem(appData.radarState.priorities[0] || null)}
                    className="text-[11px] text-indigo-600 font-bold hover:underline text-left"
                  >
                    View AI Reasoning →
                  </button>
                </div>
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Priorities & What to Skip */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Your Placement Radar summary */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">Your Placement Radar</h3>
                        <p className="text-xs text-slate-500">
                          Priorities dynamically weighted by skill gap, proximity, and role relevance.
                        </p>
                      </div>
                      <button
                        onClick={() => setCurrentRoute('radar')}
                        className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                      >
                        Inspect Radar <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {appData.radarState.priorities.slice(0, 5).map((p, idx) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs font-bold text-slate-400 w-5">
                              0{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {p.topic}
                                </h4>
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${
                                    p.level === 'critical'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : p.level === 'high'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                      : p.level === 'important'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {p.level}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{p.reason}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="w-16 hidden sm:block bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  p.level === 'critical'
                                    ? 'bg-rose-600'
                                    : p.level === 'high'
                                    ? 'bg-orange-500'
                                    : p.level === 'important'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${p.score}%` }}
                              />
                            </div>
                            <span className="font-mono text-sm font-extrabold text-slate-900 w-7 text-right">
                              {p.score}
                            </span>
                            <button
                              onClick={() => setWhyDrawerItem(p)}
                              className="text-xs text-indigo-600 font-bold hover:underline whitespace-nowrap"
                            >
                              Why? →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendation callout */}
                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-start justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                            AI Priority Insight
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                          {appData.radarState.aiReasoning}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setCurrentRoute('resources')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Resources</span>
                      </button>
                      <button
                        onClick={() => setWhyDrawerItem(appData.radarState.priorities[0] || null)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shrink-0 hover:bg-indigo-700 transition"
                      >
                        Why is this #1? →
                      </button>
                    </div>
                  </div>

                  {/* DON'T SPEND TIME ON SECTION (Key Differentiator) */}
                  <div className="p-5 rounded-2xl bg-white border-2 border-rose-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-rose-700">🚫 Don't Spend Time On</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        Anti-Planning Filter
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {appData.radarState.skipToday.map((skip, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs text-rose-950">{skip.topic}</span>
                            <span className="text-[10px] text-rose-700 font-bold bg-white px-2 py-0.5 rounded shadow-2xs">
                              Skip Today
                            </span>
                          </div>
                          <p className="text-xs text-rose-900 mt-1 font-medium">{skip.reason}</p>
                          <div className="mt-2 pt-2 border-t border-rose-200/60 flex items-center gap-2 text-xs">
                            <span className="text-rose-950 font-bold">Focus instead →</span>
                            <span className="font-extrabold text-indigo-700">{skip.focusInstead}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      “Preparation is not about studying everything. It is about spending limited time where it has the highest cutoff impact.”
                    </p>
                  </div>
                </div>

                {/* Right 1 Col: Today's 2-Hour Plan & Upcoming Deadlines */}
                <div className="space-y-6">
                  {/* Today's 2-Hour Plan Card */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Today's 2-Hour Plan</h3>
                        <p className="text-[11px] text-slate-500">Your highest-impact preparation block</p>
                      </div>
                      <button
                        onClick={() => setCurrentRoute('today')}
                        className="text-xs text-indigo-600 font-bold hover:underline"
                      >
                        Full Plan
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {appData.radarState.todayPlan.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleTaskComplete(task.id)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setSelectedTask(task)}
                          >
                            <p
                              className={`text-xs font-semibold text-slate-900 truncate ${
                                task.completed ? 'line-through opacity-60' : ''
                              }`}
                            >
                              {task.title}
                            </p>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <span>{task.durationMinutes} min •</span>
                              <span className="text-indigo-600 font-semibold truncate max-w-[130px]">
                                {getResourceForTask(task).resourceTitle}
                              </span>
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              task.completed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {task.completed ? 'DONE' : 'NEXT'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentRoute('today')}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span>Start Today's Plan (2h) →</span>
                    </button>
                  </div>

                  {/* Upcoming Deadlines Card */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Upcoming Deadlines</h3>
                      <button
                        onClick={() => setAddOppModalOpen(true)}
                        className="text-xs text-indigo-600 font-bold hover:underline"
                      >
                        + Add
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {appData.opportunities.map((opp) => (
                        <div
                          key={opp.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 truncate">{opp.company}</h4>
                            <p className="text-[11px] text-slate-500 truncate">{opp.assessmentType}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[11px] shrink-0 ${
                              opp.daysRemaining <= 1
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {opp.daysRemaining === 1 ? '1 Day' : `${opp.daysRemaining} Days`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </main>
          )}

          {/* ========================================== */}
          {/* VIEW: PLACEMENT RADAR (PRIMARY FEATURE) */}
          {/* ========================================== */}
          {currentRoute === 'radar' && (
            <main className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                      Your Placement Radar
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      ● Active Telemetry
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Multi-factor evaluation engine showing your highest-leverage preparation priorities right now.
                  </p>
                </div>

                <button
                  onClick={() => handleRecalculateRadar()}
                  disabled={isRecalculating}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                  <span>Recalculate Radar</span>
                </button>
              </div>

              {/* Signature Scenario Switcher Banner inside Radar */}
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Interactive Urgency Telemetry Demo
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Toggle between normal horizon and emergency pivot to see priorities and schedules realign dynamically.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScenarioSwitch('normal')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      appData.radarState.scenario === 'normal'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:border-indigo-600'
                    }`}
                  >
                    📅 Normal Horizon (8 days remaining)
                  </button>
                  <button
                    onClick={() => handleScenarioSwitch('emergency')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      appData.radarState.scenario === 'emergency'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:border-rose-600'
                    }`}
                  >
                    🚨 Emergency Pivot (1 day remaining)
                  </button>
                </div>
              </div>

              {/* Radar Grid: Polygon + Ranked Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* 6 Cols: Scalable SVG Polygon */}
                <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col items-center">
                  <div className="w-full flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        8-Dimensional Competency Polygon
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Indigo: Candidate Profile • Dashed Slate: Target Role Benchmark
                      </p>
                    </div>
                  </div>

                  <RadarVisualization skills={appData.skills} />

                  <p className="text-xs text-slate-500 text-center mt-3">
                    Adjust your ratings in{' '}
                    <span
                      onClick={() => setCurrentRoute('skills')}
                      className="text-indigo-600 font-bold cursor-pointer underline"
                    >
                      My Skills
                    </span>{' '}
                    to observe real-time geometric and priority shifts.
                  </p>
                </div>

                {/* 6 Cols: Ranked Priorities with Visual Breakdown */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Priority Rankings</h3>
                    <span className="text-xs text-slate-500">
                      Scenario: {appData.radarState.scenario === 'emergency' ? '1 Day Left' : '8 Days Left'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {appData.radarState.priorities.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400">
                              0{idx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{item.topic}</h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                item.level === 'critical'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : item.level === 'high'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : item.level === 'important'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {item.level}
                            </span>
                          </div>
                          <span className="font-mono text-base font-extrabold text-slate-900">
                            {item.score}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600">{item.reason}</p>

                        {/* Visual Breakdown of Factors */}
                        <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-[11px]">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase tracking-wider">
                            Mathematical Breakdown:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <span className="text-slate-500 block">Skill Gap (35%)</span>
                              <span className="font-mono font-bold text-indigo-700">
                                {item.breakdown.skillGap} / 100
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Urgency (30%)</span>
                              <span className="font-mono font-bold text-rose-700">
                                {item.breakdown.urgency} / 100
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Assessment (20%)</span>
                              <span className="font-mono font-bold text-amber-700">
                                {item.breakdown.assessmentRelevance} / 100
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Role (15%)</span>
                              <span className="font-mono font-bold text-slate-700">
                                {item.breakdown.roleRelevance} / 100
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => setWhyDrawerItem(item)}
                            className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <span>Why this matters →</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </main>
          )}

          {/* ========================================== */}
          {/* VIEW: MY SKILLS */}
          {/* ========================================== */}
          {currentRoute === 'skills' && (
            <main className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">My Skills</h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Calibrate your self-confidence (0 - 10). When a skill changes, the Radar updates readiness and alerts for recalculation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Placement Readiness:</span>
                  <span className="text-2xl font-mono font-extrabold text-indigo-700">
                    {appData.radarState.readinessScore}%
                  </span>
                </div>
              </div>

              {/* Strongest & Needs Attention Banner */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    Strongest Areas: Projects (8/10), DSA (6/10)
                  </span>
                  <span className="font-bold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                    Needs Attention: Operating Systems (2/10), Aptitude (4/10)
                  </span>
                </div>
                <button
                  onClick={() => handleRecalculateRadar()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                >
                  Save & Recalculate
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(appData.skills) as (keyof SkillScores)[]).map((key) => {
                  const meta = SKILL_METADATA[key];
                  const val = appData.skills[key];
                  return (
                    <div
                      key={key}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{meta.label}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{meta.desc}</p>
                        </div>
                        <span className="font-mono font-extrabold text-sm text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {val} / 10
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={val}
                        onChange={(e) => handleSkillChange(key, parseInt(e.target.value) || 0)}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>0: Novice</span>
                        <span>5: Moderate</span>
                        <span>10: Interview-Ready</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          )}

          {/* ========================================== */}
          {/* VIEW: OPPORTUNITIES */}
          {/* ========================================== */}
          {currentRoute === 'opportunities' && (
            <main className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Opportunities & Drives
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Manage your upcoming campus interviews. Urgency and assessment requirements automatically reprioritize your radar.
                  </p>
                </div>
                <button
                  onClick={() => setAddOppModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Opportunity</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {appData.opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className={`p-5 rounded-2xl bg-white border shadow-2xs flex flex-col justify-between ${
                      opp.daysRemaining <= 2 ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                            opp.daysRemaining <= 1
                              ? 'bg-rose-600 text-white animate-pulse'
                              : opp.daysRemaining <= 8
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {opp.daysRemaining === 1 ? '🔴 1 Day Remaining' : `${opp.daysRemaining} Days Remaining`}
                        </span>
                        <button
                          onClick={() => handleDeleteOpportunity(opp.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Delete opportunity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{opp.company}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{opp.role || 'Software Track'}</p>

                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Stage 1 Round Format:
                        </span>
                        <p className="font-semibold text-slate-800">{opp.assessmentType}</p>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {opp.requiredSkills.map((sk, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                      <span className="text-[11px] text-slate-500">
                        Urgency factor: <strong className="text-slate-900">{opp.daysRemaining <= 2 ? 'Critical' : 'Normal'}</strong>
                      </span>
                      <button
                        onClick={() => setCurrentRoute('radar')}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Inspect Radar →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          )}

          {/* ========================================== */}
          {/* VIEW: TODAY'S PLAN (2-HOUR PLAN) */}
          {/* ========================================== */}
          {currentRoute === 'today' && (
            <main className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    Today's 2-Hour Plan
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    A limited 120-minute daily preparation block focused exclusively on your highest-yield tasks.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                    2.0 Hours Block
                  </span>
                </div>
              </div>

              {/* Progress Summary Header */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-900">
                      {planCompletionPct}% complete ({totalTasks - completedTasks} of {totalTasks} tasks remaining)
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-indigo-600">
                    {completedTasks * 30}m of 120m executed
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${planCompletionPct}%` }}
                  />
                </div>

                {completedTasks === totalTasks && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-2 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Today's highest-impact preparation is complete! Great work staying focused.</span>
                  </div>
                )}
              </div>

              {/* Tasks List */}
              <div className="space-y-4">
                {appData.radarState.todayPlan.map((task) => (
                  <div
                    key={task.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTaskComplete(task.id)}
                        className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700">
                            {task.durationMinutes} MIN
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase ${
                              task.priority === 'critical'
                                ? 'bg-rose-50 text-rose-700'
                                : task.priority === 'high'
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.priority}
                          </span>
                          <span className="text-xs font-bold text-slate-500">{task.topic}</span>
                        </div>
                        <h4
                          className={`text-base font-bold text-slate-900 ${
                            task.completed ? 'line-through opacity-60' : ''
                          }`}
                        >
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">{task.description}</p>

                        {/* Resource Connection for Today's Plan */}
                        {(() => {
                          const resInfo = getResourceForTask(task);
                          return (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <span className="text-slate-500">
                                Practice: <strong className="text-slate-800">{resInfo.practiceTopic}</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500">
                                Resource: <strong className="text-indigo-700">{resInfo.resourceTitle}</strong>
                              </span>
                              <div className="flex items-center gap-2 ml-auto sm:ml-0">
                                <a
                                  href={resInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                                >
                                  <span>Open Resource</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                {resInfo.pyqUrl && (
                                  <a
                                    href={resInfo.pyqUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>• PYQs</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                      <button
                        onClick={() => setSelectedTask(task)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-xs flex items-center gap-1.5 active:scale-95"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Start Task</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </main>
          )}

          {/* ========================================== */}
          {/* VIEW: STUDY RESOURCES (NEW FEATURE) */}
          {/* ========================================== */}
          {currentRoute === 'resources' && (
            <StudyResourcesView
              appData={appData}
              onUpdateProgress={handleUpdateResourceProgress}
              onNavigateToRadar={() => setCurrentRoute('radar')}
              onNavigateToSkills={() => setCurrentRoute('skills')}
              onShowToast={showToast}
            />
          )}


          {/* ========================================== */}
          {/* VIEW: SETTINGS */}
          {/* ========================================== */}
          {currentRoute === 'settings' && (
            <main className="p-4 sm:p-6 space-y-6">
              <div className="pb-4 border-b border-slate-200">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Settings & Preferences
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Manage candidate profile, AI aggressiveness, and simulation states.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                {/* Profile Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4 text-indigo-600" />
                    <span>Profile Details</span>
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Candidate Name
                    </label>
                    <input
                      type="text"
                      value={appData.profile.name}
                      onChange={(e) =>
                        setAppData({
                          ...appData,
                          profile: { ...appData.profile, name: e.target.value },
                        })
                      }
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Role
                    </label>
                    <input
                      type="text"
                      value={appData.profile.targetRole}
                      onChange={(e) =>
                        setAppData({
                          ...appData,
                          profile: { ...appData.profile, targetRole: e.target.value },
                        })
                      }
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Placement Timeline
                    </label>
                    <select
                      value={
                        TIMELINE_OPTIONS.some((o) => o.days === appData.profile.placementTimelineDays)
                          ? TIMELINE_OPTIONS.find((o) => o.days === appData.profile.placementTimelineDays)?.id
                          : 'custom'
                      }
                      onChange={(e) => {
                        const opt = TIMELINE_OPTIONS.find((o) => o.id === e.target.value);
                        if (opt && opt.id !== 'custom') {
                          setAppData({
                            ...appData,
                            profile: { ...appData.profile, placementTimelineDays: opt.days },
                            radarState: { ...appData.radarState, needsRecalculation: true },
                          });
                        }
                      }}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {TIMELINE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.days} days)
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-indigo-700 font-medium mt-1">
                      {formatTimelineDisplay(appData.profile.placementTimelineDays).approximateDays}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Daily Study Time Budget
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={appData.profile.dailyStudyHours}
                      onChange={(e) =>
                        setAppData({
                          ...appData,
                          profile: {
                            ...appData.profile,
                            dailyStudyHours: parseInt(e.target.value) || 2,
                          },
                        })
                      }
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* AI & Reset Controls */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>AI Engine Aggressiveness</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Conservative', 'Balanced', 'Aggressive'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() =>
                          setAppData({
                            ...appData,
                            settings: { ...appData.settings, aiAggressiveness: mode },
                          })
                        }
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                          appData.settings.aiAggressiveness === mode
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setAppData((prev) => ({
                          ...prev,
                          radarState: {
                            ...prev.radarState,
                            todayPlan: prev.radarState.todayPlan.map((t) => ({
                              ...t,
                              completed: false,
                            })),
                          },
                        }));
                        showToast('Progress Reset', 'Today’s task checklist cleared.');
                      }}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition text-xs font-bold"
                    >
                      Reset Today's Progress (Keep Profile)
                    </button>

                    <button
                      onClick={handleLoadDemo}
                      className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition text-xs font-bold"
                    >
                      Reset to Alex Default Demo Data
                    </button>
                  </div>
                </div>
              </div>
            </main>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* WHY THIS MATTERS / AI REASONING MODAL */}
      {/* ========================================== */}
      {whyDrawerItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  AI Priority Insight: {whyDrawerItem.topic}
                </h3>
              </div>
              <button
                onClick={() => setWhyDrawerItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Why This is High Priority */}
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1">
                Why this is {whyDrawerItem.level.toUpperCase()} Priority
              </span>
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-slate-800 leading-relaxed font-medium">
                "{whyDrawerItem.whyThisMatters}"
              </div>
            </div>

            {/* Visual Factor Breakdown */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Visual Factor Breakdown
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">Urgency Factor</span>
                  <span className="text-rose-700">{whyDrawerItem.breakdown.urgency} / 100</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-600 h-full rounded-full"
                    style={{ width: `${whyDrawerItem.breakdown.urgency}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">Skill Gap</span>
                  <span className="text-indigo-700">{whyDrawerItem.breakdown.skillGap} / 100</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${whyDrawerItem.breakdown.skillGap}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">Assessment Relevance</span>
                  <span className="text-amber-700">
                    {whyDrawerItem.breakdown.assessmentRelevance} / 100
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${whyDrawerItem.breakdown.assessmentRelevance}%` }}
                  />
                </div>
              </div>
            </div>

            {/* WHAT TO STUDY, RECOMMENDED RESOURCE, & COMPANY PRACTICE */}
            {(() => {
              const skillKey = whyDrawerItem.skillKey;
              const confidence = appData.skills[skillKey] ?? 5;
              const { focus } = getTopicsForConfidence(skillKey, confidence);
              const primaryRes = getPrimaryResourceForSkill(skillKey);
              const userProg = primaryRes ? appData.resourceProgress?.[primaryRes.id] : undefined;
              const isStudying = userProg?.status === 'studying';
              const pyq =
                COMPANY_PRACTICE_CATALOG.find((c) =>
                  whyDrawerItem.whyThisMatters.toLowerCase().includes(c.company.toLowerCase())
                ) || COMPANY_PRACTICE_CATALOG[0];

              return (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  {/* WHAT TO STUDY */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                        What to Study Next
                      </h4>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Confidence {confidence}/10
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {focus.slice(0, 3).map((topic, i) => (
                        <div
                          key={topic}
                          className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-1.5"
                        >
                          <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RECOMMENDED RESOURCE */}
                  {primaryRes && (
                    <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                          Recommended Resource
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {primaryRes.provider}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{primaryRes.title}</h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {primaryRes.description}
                      </p>
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <a
                          href={primaryRes.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1 shadow-2xs"
                        >
                          <span>Open Resource</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => {
                            handleUpdateResourceProgress(primaryRes.id, {
                              status: isStudying ? 'not_started' : 'studying',
                            });
                            showToast(
                              isStudying ? 'Removed from Studying' : 'Marked as Studying',
                              primaryRes.title
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition"
                        >
                          {isStudying ? 'Studying ✓' : 'Mark as Studying'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* COMPANY PRACTICE */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Company Practice
                      </span>
                      <strong className="text-slate-800 truncate block">{pyq.title}</strong>
                    </div>
                    <a
                      href={pyq.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <span>Practice PYQs</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })()}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setWhyDrawerItem(null);
                  setCurrentRoute('resources');
                }}
                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>View in Study Resources →</span>
              </button>
              <button
                onClick={() => setWhyDrawerItem(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Timer Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onToggleComplete={handleToggleTaskComplete}
        />
      )}

      {/* Add Opportunity Modal */}
      {addOppModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <span>Add Placement Opportunity</span>
              </h3>
              <button
                onClick={() => setAddOppModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Organization</label>
                <input
                  type="text"
                  placeholder="e.g. Google, Microsoft, TCS"
                  value={newOppCompany}
                  onChange={(e) => setNewOppCompany(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Days Until Assessment</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={newOppDays}
                  onChange={(e) => setNewOppDays(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assessment Type</label>
                <input
                  type="text"
                  value={newOppType}
                  onChange={(e) => setNewOppType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Required Skills (comma separated)</label>
                <input
                  type="text"
                  value={newOppSkills}
                  onChange={(e) => setNewOppSkills(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setAddOppModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOpportunity}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
              >
                Save & Update Radar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 w-full z-40 flex justify-around items-center px-3 py-2 md:hidden bg-white shadow-lg border-t border-slate-200">
        <button
          onClick={() => setCurrentRoute('dashboard')}
          className={`flex flex-col items-center justify-center px-3 py-1 text-xs font-bold ${
            currentRoute === 'dashboard' ? 'text-indigo-600 bg-indigo-50 rounded-xl' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </button>
        <button
          onClick={() => setCurrentRoute('radar')}
          className={`flex flex-col items-center justify-center px-3 py-1 text-xs font-bold ${
            currentRoute === 'radar' ? 'text-indigo-600 bg-indigo-50 rounded-xl' : 'text-slate-500'
          }`}
        >
          <Radar className="w-5 h-5" />
          <span className="text-[10px]">Radar</span>
        </button>
        <button
          onClick={() => setCurrentRoute('resources')}
          className={`flex flex-col items-center justify-center px-3 py-1 text-xs font-bold ${
            currentRoute === 'resources' ? 'text-indigo-600 bg-indigo-50 rounded-xl' : 'text-slate-500'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px]">Resources</span>
        </button>
        <button
          onClick={() => setCurrentRoute('today')}
          className={`flex flex-col items-center justify-center px-3 py-1 text-xs font-bold ${
            currentRoute === 'today' ? 'text-indigo-600 bg-indigo-50 rounded-xl' : 'text-slate-500'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px]">Today</span>
        </button>
        <button
          onClick={() => setCurrentRoute('skills')}
          className={`flex flex-col items-center justify-center px-3 py-1 text-xs font-bold ${
            currentRoute === 'skills' ? 'text-indigo-600 bg-indigo-50 rounded-xl' : 'text-slate-500'
          }`}
        >
          <BrainCircuit className="w-5 h-5" />
          <span className="text-[10px]">Skills</span>
        </button>
        <button
          onClick={() => setCurrentRoute('opportunities')}
          className={`flex flex-col items-center justify-center px-3 py-1 text-xs font-bold ${
            currentRoute === 'opportunities' ? 'text-indigo-600 bg-indigo-50 rounded-xl' : 'text-slate-500'
          }`}
        >
          <Briefcase className="w-5 h-5" />
          <span className="text-[10px]">Jobs</span>
        </button>
      </nav>
    </div>
  );
}
