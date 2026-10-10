import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

// Initialize GoogleGenAI server-side with User-Agent header for telemetry
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('GEMINI_API_KEY not found in environment. Server will use deterministic fallbacks.');
}

// POST /api/radar/recalculate
// Expects: { profile, skills, opportunities, deterministicPriorities, scenario }
// Returns: structured AI reasoning, enhanced task titles, skip recommendations
app.post('/api/radar/recalculate', async (req, res) => {
  const { profile, skills, opportunities, deterministicPriorities, scenario } = req.body;

  // If Gemini is not configured, send graceful fallback without crashing
  if (!ai) {
    return res.json({
      success: true,
      fallback: true,
      aiReasoning: scenario === 'emergency'
        ? "Your aptitude confidence is 4/10, your nearest assessment is tomorrow, and aptitude is a major part of the assessment. This gives aptitude the highest short-term impact."
        : "With 8 days until Infosys and 18 days until XYZ Startup, consistent practice in Aptitude and DSA provides maximum dual-coverage.",
      summary: scenario === 'emergency'
        ? "Your nearest deadline is tomorrow. Focus on speed aptitude and timed coding."
        : "Foundational horizon active. Daily DSA and Aptitude practice will prepare you for upcoming drives.",
    });
  }

  try {
    const isLongTerm = (profile?.placementTimelineDays || 30) >= 60;
    const prompt = `
You are the AI decision layer for PLACEMENT RADAR, an algorithmic placement readiness system.
Candidate Profile:
Name: ${profile?.name || 'Alex'}
Target Role: ${profile?.targetRole || 'Software Developer'}
Daily Study Time: ${profile?.dailyStudyHours || 2} hours
Placement Timeline: ${profile?.placementTimelineDays || 30} days (${isLongTerm ? 'Long-term foundation building' : 'Short-term / Active season'})
Assessment Scenario: ${scenario === 'emergency' ? 'EMERGENCY PIVOT (Infosys Assessment in 1 Day)' : isLongTerm ? 'LONG-TERM HORIZON (Foundational skill development)' : 'NORMAL HORIZON (Infosys Assessment in 8 Days)'}

Candidate Skills (out of 10):
${JSON.stringify(skills)}

Upcoming Opportunities:
${JSON.stringify(opportunities)}

Deterministic Priority Engine Rankings:
${JSON.stringify(deterministicPriorities?.map((p: any) => ({ topic: p.topic, score: p.score, level: p.level })))}

Task:
1. Explain concisely why the top priority is #1 right now based on skill gaps, timeline runway, and role requirements. If timeline is long-term (e.g. 5 months / 150 days), prioritize deep conceptual foundations over immediate test cramming.
2. Produce a clear, realistic 2-hour daily execution plan (3 to 4 tasks summing to 120 minutes total).
3. Specify 2 topics the student MUST SKIP TODAY and what to focus on instead (anti-planning discipline).

Return strictly JSON matching this structure:
{
  "summary": "1 sentence executive summary of today's focus",
  "aiReasoning": "Concise 2-sentence explanation of why the top priority was chosen over other subjects",
  "todayPlan": [
    {
      "topic": "string",
      "title": "string",
      "durationMinutes": 40,
      "priority": "critical | high | important | maintain",
      "description": "string",
      "objective": "string",
      "recommendedActivity": "string"
    }
  ],
  "skipToday": [
    {
      "topic": "string",
      "reason": "string",
      "focusInstead": "string"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            aiReasoning: { type: Type.STRING },
            todayPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  title: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  priority: { type: Type.STRING },
                  description: { type: Type.STRING },
                  objective: { type: Type.STRING },
                  recommendedActivity: { type: Type.STRING },
                },
                required: ['topic', 'title', 'durationMinutes', 'priority', 'description'],
              },
            },
            skipToday: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  focusInstead: { type: Type.STRING },
                },
                required: ['topic', 'reason', 'focusInstead'],
              },
            },
          },
          required: ['summary', 'aiReasoning', 'todayPlan', 'skipToday'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      fallback: false,
      ...parsed,
    });
  } catch (error: any) {
    console.error('Gemini API call failed, using deterministic fallback:', error?.message || error);
    // Never crash or expose stack traces to client
    return res.json({
      success: true,
      fallback: true,
      aiReasoning: scenario === 'emergency'
        ? "Your aptitude confidence is 4/10, your nearest assessment is tomorrow, and aptitude is a major part of the assessment. This gives aptitude the highest short-term impact."
        : "With 8 days until Infosys and 18 days until XYZ Startup, consistent practice in Aptitude and DSA provides maximum dual-coverage.",
      summary: scenario === 'emergency'
        ? "Your nearest deadline is tomorrow. Focus on speed aptitude and timed coding."
        : "Foundational horizon active. Daily DSA and Aptitude practice will prepare you for upcoming drives.",
    });
  }
});

// Production static assets or Vite middleware in dev
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, server.js may be located at root or in dist/
    let distPath = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(path.resolve(distPath, 'index.html')) && fs.existsSync(path.resolve(__dirname, 'index.html'))) {
      distPath = __dirname;
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Placement Radar listening on port ${PORT}`);
  });
}

startServer();
