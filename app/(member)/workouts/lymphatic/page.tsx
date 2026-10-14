"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "flow-only",    label: "Just the Flow",       sub: "No hoop needed" },
  { id: "add-flow",     label: "Add Flow to my hoop",  sub: "You already hoop" },
  { id: "full-system",  label: "Full hoop + Flow",     sub: "The 90-day program" },
];

/* ── FULL SYSTEM PHASES ───────────────────────────────────────────── */
const PHASES = [
  {
    id: 1, name: "Awaken", days: "Days 1–30", duration: "10 min / day", color: "primary" as const,
    description: "Your only job this month is to show up. Short sessions, low pressure. The hoop gets your whole system moving — the Flow targets whatever zone is most stuck. You're building a habit, not running a marathon.",
    schedule: [
      { day: "Mon", type: "Hoop + Flow" }, { day: "Tue", type: "Hoop + Flow" },
      { day: "Wed", type: "Rest or walk" }, { day: "Thu", type: "Hoop + Flow" },
      { day: "Fri", type: "Hoop + Flow" }, { day: "Sat", type: "Hoop + walk" },
      { day: "Sun", type: "Full rest" },
    ],
    moves: [
      { name: "Activation Breath", duration: "2 min", flow: false, body: "Before you pick up the hoop. One hand on your belly, one on your chest. In for 4 counts through the nose — belly rises first. Out for 6 counts, fully empty. Ten rounds. If you feel a slight tingling, that's circulation picking up." },
      { name: "Steady Waist Hoop", duration: "5 min", flow: false, body: "Forward-back weight shift, feet flat. Breathe the whole time — in for 3 rotations, out for 3. If it drops, pick it up. Switch direction at the halfway mark. This is the primary mover." },
      { name: "Flow — Waist Zone", duration: "2 min", flow: true, body: "Right after hooping. Strap it snug at your waist or lower belly, Level 1 or 2. Sit or stand, keep breathing slowly. Most people feel a warm, releasing sensation within the first minute." },
      { name: "Closing Walk", duration: "1 min", flow: false, body: "March gently in place or walk a loop. Inhale for 4 steps, exhale for 4. End with 3 long exhales, arms overhead on the inhale and lowered slowly on the exhale." },
    ],
    milestones: [
      { day: "Day 7", title: "You might feel slightly puffier before you feel lighter.", body: "Fluid that was sitting still is now moving — it mobilizes before it drains. Drink more water. It resolves in 2–3 days." },
      { day: "Day 14", title: "Waistband feels different by end of day.", body: "Clothes may start fitting differently. This is real, not in your head." },
      { day: "Day 30", title: "Visible waist change and better energy.", body: "Better sleep, clearer skin, noticeably less bloating. The habit is the result at this stage — everything else follows." },
    ],
  },
  {
    id: 2, name: "Flow", days: "Days 31–60", duration: "20 min / day", color: "emerald" as const,
    description: "You've built the habit. Now you extend, add new movement, and start using the Flow on secondary zones — thighs, arms, calves. The results compound here.",
    schedule: [
      { day: "Mon", type: "Full sequence" }, { day: "Tue", type: "Full sequence" },
      { day: "Wed", type: "Walk + breathe" }, { day: "Thu", type: "Full sequence" },
      { day: "Fri", type: "Full sequence" }, { day: "Sat", type: "Active rest" },
      { day: "Sun", type: "Full rest" },
    ],
    moves: [
      { name: "Phase 1 (carry forward)", duration: "10 min", flow: false, body: "Activation breath, steady waist hoop, Flow on waist. Aim for unbroken hoop runs of 4 minutes or more this month." },
      { name: "Figure-8 Hip Trace", duration: "3 min", flow: false, body: "Hoop still spinning. Shift weight from left hip to right in a wide figure-8 — hips fully over each foot before crossing back. One full figure-8 should take 3–4 seconds. Slow is right. Two minutes one direction, one minute the other." },
      { name: "Flow — Thighs + Calves", duration: "4 min", flow: true, body: "Strap it to one thigh — inner or outer, wherever you hold the most fluid. Two minutes per leg, Level 2–3. Move to calves after if you have time. On your walk days: Flow on legs while seated counts." },
      { name: "Neck Rolls", duration: "2 min", flow: false, body: "Hoop down. Right ear toward right shoulder — hold 10 seconds. Chin to chest — 10 seconds. Left ear to left shoulder — 10 seconds. Back to center. Four slow rounds. Never roll all the way back." },
      { name: "Flow — Upper Arms", duration: "1 min", flow: true, body: "Strap just below the shoulder, 30 seconds each arm, Level 2–3. Keep the arm slightly away from your body. The arms respond fast." },
    ],
    milestones: [
      { day: "Day 37", title: "Less bloating after sessions.", body: "A flatter stomach within an hour of your session is common at this stage." },
      { day: "Day 45", title: "Thighs and calves visibly less puffy.", body: "Lower-body fluid retention is often the last thing to shift. It's shifting now." },
      { day: "Day 60", title: "Body composition changes you can see.", body: "Two months of consistent daily drainage. Waist, arms, thighs — measurable change." },
    ],
  },
  {
    id: 3, name: "Radiance", days: "Days 61–90", duration: "30 min / day", color: "violet" as const,
    description: "Full integration. The hoop and the Flow work as one daily practice. By now you're not following a program — you're just doing what your body expects.",
    schedule: [
      { day: "Mon", type: "Full sequence" }, { day: "Tue", type: "Full sequence" },
      { day: "Wed", type: "Full sequence" }, { day: "Thu", type: "Full sequence" },
      { day: "Fri", type: "Full sequence" }, { day: "Sat", type: "Walk + stretch" },
      { day: "Sun", type: "Full rest" },
    ],
    moves: [
      { name: "Phases 1 + 2 (carry forward)", duration: "20 min", flow: false, body: "Your full sequence — activation breath, hoop (aim for 6-minute unbroken runs), figure-8, Flow on waist + legs + arms, neck rolls. This is your base." },
      { name: "Flow — Deep Belly Session", duration: "5 min", flow: true, body: "Lie on your back, knees bent. Strap it to your lower belly, just above the hip bones. Level 3–4 — you've built up tolerance. Both hands resting lightly on top of the device. In for 4 counts, out for 6, for the full 5 minutes. If you feel gurgling in your stomach, that's exactly right. This is the most impactful 5 minutes of the whole program." },
      { name: "Full-Body Hoop Flow", duration: "3 min", flow: false, body: "No structure. Start with waist hooping, layer in figure-8 shifts, add arm passes, knee raises, side steps, slow turns. Whatever feels good. Keep breathing, keep the hoop going." },
      { name: "Flow — Legs Elevated Cool-Down", duration: "2 min", flow: true, body: "Legs up a wall or propped on a chair, above heart level. Strap to one thigh or calf, Level 1. Breathe naturally. Switch legs halfway through. End here — you're done." },
    ],
    milestones: [
      { day: "Day 70", title: "The overnight puffiness you thought was normal may have stopped.", body: "That's not a coincidence." },
      { day: "Day 80", title: "Getting sick less, recovering faster.", body: "Members commonly report fewer colds in the final stretch." },
      { day: "Day 90", title: "Day 90 is not the finish line.", body: "Most people continue with 10 minutes of hooping + 5 minutes of Flow on their primary zone. You've built something that works." },
    ],
  },
];

type PhaseColor = "primary" | "emerald" | "violet";
const ACCENT: Record<PhaseColor, { tab: string; dot: string; flow: string; text: string }> = {
  primary: { tab: "border-primary text-primary", dot: "bg-primary", flow: "bg-primary text-white", text: "text-primary" },
  emerald: { tab: "border-emerald-500 text-emerald-600", dot: "bg-emerald-500", flow: "bg-emerald-500 text-white", text: "text-emerald-600" },
  violet:  { tab: "border-violet-500 text-violet-600",  dot: "bg-violet-500",  flow: "bg-violet-500 text-white",  text: "text-violet-600"  },
};

export default function LymphaticGuidePage() {
  const [mode, setMode] = useState("full-system");
  const [activePhase, setActivePhase] = useState(0);

  const phase = PHASES[activePhase];
  const ac = ACCENT[phase.color];

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 md:px-8 md:py-8">

      {/* Hero */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Lymphatic Flow Guide</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-gray-900 md:text-4xl">
          Your drainage guide.
        </h1>
        <p className="mt-2 text-base text-gray-500 leading-relaxed max-w-lg">
          The Infinity Flow works on its own, alongside your hoop routine, or as part of a structured 90-day program. Choose the one that fits where you're at.
        </p>
      </div>

      {/* Video tutorials */}
      <div className="mt-7 space-y-5">
        {[
          {
            title: "How to use the Infinity Flow",
            sub: "Getting started · 4 min",
            src: "https://okntwdbbmyzw9bvc.public.blob.vercel-storage.com/videos/how-to-use-flow-8M3CanEXW9qqmkHv7kvMB4C22l8uq7.mp4",
          },
          {
            title: "Lymphatic tips & techniques",
            sub: "Education · 3 min",
            src: "https://okntwdbbmyzw9bvc.public.blob.vercel-storage.com/videos/lymphatic-tips-5R7cOGcutzLQnUidGHQJoDVaKYMrqF.mp4",
          },
        ].map((v) => (
          <div key={v.title}>
            <p className="mb-1.5 text-sm font-bold text-gray-900">{v.title}</p>
            <p className="mb-2 text-xs text-gray-400">{v.sub}</p>
            <video
              src={v.src}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-2xl bg-black"
              style={{ maxHeight: "420px" }}
            />
          </div>
        ))}
      </div>

      {/* Mode selector */}
      <div className="mt-6 flex flex-col gap-0 divide-y divide-gray-100 rounded-2xl border border-gray-100 overflow-hidden">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "flex items-center justify-between px-4 py-3.5 text-left transition-colors",
              mode === m.id ? "bg-primary/5" : "bg-white hover:bg-gray-50"
            )}
          >
            <div>
              <span className={cn("text-sm font-semibold", mode === m.id ? "text-primary" : "text-gray-900")}>{m.label}</span>
              <span className="ml-2 text-xs text-gray-400">{m.sub}</span>
            </div>
            {mode === m.id && <span className="size-2 rounded-full bg-primary shrink-0" />}
          </button>
        ))}
      </div>

      {/* ── FLOW ONLY ── */}
      {mode === "flow-only" && (
        <div className="mt-8">
          <p className="text-sm text-gray-500 leading-relaxed">
            10–15 minutes. You can do this in bed, on the couch, or at your desk. No hoop required.
          </p>

          <h2 className="mt-6 font-display text-xl font-bold text-gray-900">Before you start</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Drink a full glass of water. Lymph is mostly water — if you're dehydrated it can't move properly. Then do 10 slow deep breaths: belly rises on the inhale, fully empties on the exhale. This activates the main lymph pump in your chest before you touch the device.
          </p>

          <h2 className="mt-7 font-display text-xl font-bold text-gray-900">Zone by zone</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">Start at your belly, work down. Build up levels over the first week.</p>

          <div className="space-y-5">
            {[
              { zone: "Belly / waist", duration: "3–5 min", level: "Level 1–2", tip: "Lie down or sit. Strap just above your hip bones. Breathe slow and deep — the breath is what moves the fluid, the device loosens it." },
              { zone: "Thighs", duration: "2 min each leg", level: "Level 2–3", tip: "Sit with legs extended or bent. Inner thigh works best if you hold fluid there. You can go slightly higher on the thighs than on your belly." },
              { zone: "Calves", duration: "1 min each leg", level: "Level 1–2", tip: "Legs up on a pillow or the couch arm while you do this — gravity helps. Great for end-of-day puffiness." },
              { zone: "Upper arms", duration: "30 sec each arm", level: "Level 2–3", tip: "Just below the shoulder. Keep your arm slightly away from your body. The arms respond really fast." },
            ].map((z) => (
              <div key={z.zone} className="border-l-2 border-primary/30 pl-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900">{z.zone}</p>
                  <p className="text-xs text-gray-400">{z.duration} · {z.level}</p>
                </div>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{z.tip}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-gray-50 p-5 text-sm text-gray-500 leading-relaxed space-y-2">
            <p className="font-semibold text-gray-700 text-xs uppercase tracking-wider">A few things to know</p>
            <p>Don't use it over open skin, joints, the front of your neck, or if you're pregnant or have a pacemaker.</p>
            <p>You might feel slightly puffier the first few days. That's fluid mobilizing, not a problem. Drink more water.</p>
            <p>Daily beats intense. 10 minutes every day is worth more than 45 minutes once a week.</p>
            <p>Drink another full glass of water after every session.</p>
          </div>
        </div>
      )}

      {/* ── ADD FLOW ── */}
      {mode === "add-flow" && (
        <div className="mt-8">
          <p className="text-sm text-gray-500 leading-relaxed">
            You don't need to change your hoop routine at all. The Flow just plugs in — and the timing matters more than the duration.
          </p>

          <div className="mt-6 space-y-7">
            {[
              { when: "Right after you hoop", body: "This is the most important window. Your lymph is already moving from the hooping — applying the Flow immediately keeps that momentum going in the zones the hoop can't reach directly. Strap it to your waist first, then thighs. Even 3 minutes makes a real difference." },
              { when: "On rest days", body: "You don't have to earn the Flow with a workout. On days you skip the hoop, sit on the couch and run it on your legs for 10 minutes. Passive drainage still counts." },
              { when: "End of the day", body: "If you hold fluid in your legs by evening — 5 minutes of Flow with your feet elevated on a pillow is one of the easiest things you can do. Legs up + Flow on calves = the cheapest spa treatment you'll ever have." },
              { when: "Morning before anything", body: "The lymph system is most receptive first thing in the morning. 5 minutes of Flow on your belly before you get moving. Do this one consistently for 2 weeks and notice what changes." },
            ].map((t) => (
              <div key={t.when}>
                <p className="text-sm font-bold text-gray-900">{t.when}</p>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{t.body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 font-display text-xl font-bold text-gray-900">Where to put it</h2>
          <div className="mt-3 space-y-4">
            {[
              { zone: "Belly / waist", detail: "3–5 min · Level 1–2 · Just above the hip bones. Breathe deeply throughout." },
              { zone: "Thighs", detail: "2 min each · Level 2–3 · Inner or outer, wherever you hold the most fluid." },
              { zone: "Calves", detail: "1 min each · Level 1–2 · Legs elevated if possible." },
              { zone: "Upper arms", detail: "30 sec each · Level 2–3 · Just below the shoulder, arm slightly away from your body." },
            ].map((z) => (
              <div key={z.zone} className="border-l-2 border-primary/30 pl-4">
                <p className="text-sm font-bold text-gray-900">{z.zone}</p>
                <p className="mt-0.5 text-xs text-gray-400">{z.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FULL SYSTEM ── */}
      {mode === "full-system" && (
        <div className="mt-8">
          <p className="text-sm text-gray-500 leading-relaxed">
            Three phases over 90 days. Each one adds time and new Flow zones as your body adapts. Follow them in order — the progression matters.
          </p>

          {/* Quick reminders — plain text, no cards */}
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-500">
            <p><span className="font-semibold text-gray-800">Breathe fully.</span> Every complete exhale pushes lymph upward. The breath is doing real work.</p>
            <p><span className="font-semibold text-gray-800">Stack the tools.</span> Use the Flow right after hooping — your system is already primed.</p>
            <p><span className="font-semibold text-gray-800">Water is not optional.</span> Drink before and after every session. Without it, drainage stalls.</p>
            <p><span className="font-semibold text-gray-800">Morning wins.</span> 10 min hoop + 5 min Flow in the morning beats an hour of anything else later.</p>
          </div>

          {/* Phase tabs */}
          <div className="mt-8 flex border-b border-gray-100">
            {PHASES.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActivePhase(i)}
                className={cn(
                  "flex-1 border-b-2 pb-3 pt-2 text-center text-sm transition-colors",
                  activePhase === i
                    ? cn("font-semibold", ACCENT[p.color].tab)
                    : "border-transparent text-gray-400 hover:text-gray-700"
                )}
              >
                <span className="block text-xs font-bold">{p.days}</span>
                <span className="block text-xs">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex items-start gap-3">
              <div className={cn("mt-0.5 size-2.5 shrink-0 rounded-full", ac.dot)} />
              <p className="text-sm text-gray-500 leading-relaxed">{phase.description}</p>
            </div>
            <p className="mt-2 ml-5 text-xs text-gray-400">{phase.duration} · 5–6× per week</p>

            {/* Weekly schedule — simple pill row */}
            <div className="mt-5 ml-5 flex gap-1.5 flex-wrap">
              {phase.schedule.map(({ day, type }) => (
                <div key={day} className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  type === "Full rest" || type === "Rest or walk" || type === "Active rest" || type === "Walk + stretch" || type === "Walk + breathe"
                    ? "bg-gray-100 text-gray-400"
                    : "bg-primary/10 text-primary"
                )}>
                  {day}
                </div>
              ))}
              <p className="w-full mt-1 text-[11px] text-gray-400 pl-0.5">
                {phase.schedule.filter(s => !["Full rest","Rest or walk","Active rest","Walk + stretch","Walk + breathe"].includes(s.type)).map(s => s.type)[0]} days highlighted · rest days faded
              </p>
            </div>

            {/* Session moves — not cards, just a readable list */}
            <h3 className="mt-7 font-display text-lg font-bold text-gray-900">Your session</h3>
            <div className="mt-3 space-y-5">
              {phase.moves.map((move) => (
                <div key={move.name} className={cn("border-l-2 pl-4", move.flow ? "border-primary" : "border-gray-200")}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900">{move.name}</p>
                    <p className="text-xs text-gray-400">{move.duration}</p>
                    {move.flow && (
                      <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold", ac.flow)}>
                        <Zap className="size-2.5" /> Flow
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{move.body}</p>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <h3 className="mt-8 font-display text-lg font-bold text-gray-900">What to expect</h3>
            <div className="mt-3 space-y-4">
              {phase.milestones.map((m) => (
                <div key={m.day}>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{m.day}</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">{m.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500 leading-relaxed">{m.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Support — two columns of plain text */}
          <div className="mt-10 pt-8 border-t border-gray-100">
            <h2 className="font-display text-xl font-bold text-gray-900">The other 23 hours</h2>
            <p className="mt-1 text-sm text-gray-500">What you do outside your sessions compounds the results.</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 text-sm text-gray-500 leading-relaxed">
              <div>
                <p className="font-semibold text-gray-800 mb-2">Hydration</p>
                <p>2.5+ liters of water daily — more on session days. Warm water before your morning session. Herbal teas count. Alcohol directly inflames lymph node tissue, keep it low.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-2">Foods that help</p>
                <p>Leafy greens, berries, ginger, turmeric, beets. Cut back on processed sodium, refined sugar, and packaged fats. You don't need a diet overhaul — just lean toward real food.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-2">Sleep</p>
                <p>7–9 hours — the lymph system drains most actively during deep sleep. Left-side sleeping reduces pressure on the main lymph duct. Phone down 30 minutes before bed.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-2">Flow tips</p>
                <p>Start Level 1 for the first week. Passive use (desk, couch) counts — even 10 minutes while sitting moves fluid. Always drink water right after. Never over open skin or the front of the neck.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-10 text-xs text-gray-400 leading-relaxed">
        For general wellness and movement. Do not use the Infinity Flow if you are pregnant, have a pacemaker, active blood clots, or are under treatment for a serious medical condition.
      </p>
    </div>
  );
}
