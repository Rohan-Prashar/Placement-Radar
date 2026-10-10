# Placement Radar 🎯

> **“Stop guessing what to prepare next.”**

Placement Radar is an AI decision layer that continuously prioritizes placement preparation based on **skill gaps, upcoming opportunities, assessment requirements, target-role relevance, deadline urgency, and available preparation time**.

Built for **Problem Statement 4: Open Innovation — Student Pain Points**.

---

## 🌟 The Central Differentiator: Dynamic Contextual Reprioritization

Traditional placement tools act like static timetables, generic question banks, or chatbot wrappers. Placement Radar solves the real student problem: **choice paralysis under limited time and shifting deadlines**.

- **Scenario A (Normal Horizon - 8 Days Left):**
  - **Aptitude**: Priority 91 (Critical)
  - **DSA**: Priority 82 (High)
  - **DBMS**: Priority 71 (Important)
  - **Projects**: Priority 42 (Maintain)
- **Scenario B (Emergency Pivot - 1 Day Left):**
  - **Aptitude**: Priority 98 (Critical)
  - **Timed Coding**: Priority 94 (Critical)
  - **Mock Speed Assessment**: Priority 91 (High)
  - **DSA**: Priority 78 (High)
  - **Projects**: Priority 25 (Maintain)

**The student's skill scores do not change. The context changes. Therefore, the recommended preparation changes.**

---

## 🚫 Key Feature: "Don't Spend Time On" Anti-Planning

Preparation is not about studying everything—it is about knowing what **NOT** to study when deadlines are close.
- When an aptitude exam is tomorrow, Radar explicitly advises skipping **Advanced Graph Algorithms** or **Microservices Schemas** and directs hours into **Quantitative Aptitude + Timed Coding**.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.
- **Backend**: Express server (`server.ts`) hosting the API decision proxy with `@google/genai` TypeScript SDK.
- **Deterministic Priority Engine**: Local mathematical weighting:
  $$\text{Priority} = (\text{Skill Gap} \times 0.35) + (\text{Urgency} \times 0.30) + (\text{Assessment Relevance} \times 0.20) + (\text{Role Relevance} \times 0.15)$$
- **AI Role**: Server-side Gemini 3.8 Flash (`gemini-3.8-flash`) generates structured explanations, 2-hour daily execution plans, and "what to skip" rationales with deterministic fallback.
- **Persistence**: Clean typed `localStorage` persistence layer (`src/storage.ts`).

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v20+ recommended)
- npm or yarn

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
 Note that even if `GEMINI_API_KEY` is not provided, the system executes gracefully using the local deterministic engine.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎮 Signature Demo Flow for Judges

1. On the landing page, click **"Try Demo"** to immediately load **Alex's** profile (`Software Developer`, 30 days horizon, 2 hours/day).
2. Examine the **Dashboard** metrics, **Placement Radar**, **Today's 2-Hour Plan**, and **Upcoming Deadlines**.
3. Use the persistent **Judge Demo Controller** at the top or the **Opportunities** page to switch between:
   - `Scenario 1: 🚨 Infosys in 1 Day` (Emergency Pivot)
   - `Scenario 2: 📅 Normal Horizon (8 Days)`
4. Click **[ ⚡ Recalculate Radar ]**. Watch priorities and the daily plan reconfigure in real time without refreshing!
5. Open any task in **Today's Plan** to inspect the interactive countdown sprint timer and session objectives.
