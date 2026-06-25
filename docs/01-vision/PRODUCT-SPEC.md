# Clarity — Product Spec

> One home that adapts to where you are in the day.
> A companion that helps you stay aligned with what matters — silently.

---

## 1. Product Vision

Clarity is a productivity app built around a single principle: **the AI companion is silent by default**. It only speaks when it genuinely matters.

Most productivity tools fall into two traps:
- **Too much AI** (ChatGPT-style): constant suggestions, overwhelming the user with options
- **No AI** (Todoist-style): static lists with no awareness of context, time, or patterns

Clarity sits in the space between. The AI companion — a character called **Monk** — observes, breathes, and stays present. It intervenes only at structurally meaningful moments: the start of the day, a drift from focus, or a pattern that deserves attention.

The app presents a single adaptive home screen that transforms based on where the user is in their day. No tab bars. No complex navigation. One place, always relevant.

---

## 2. AI Behavior Rules

This section defines the contract between the AI and the user. It is the most critical design constraint in the product.

### When the AI Speaks

| Moment | What It Says | Max Length |
|--------|-------------|------------|
| Morning structuring | Extracts goals from free text, organizes by area | Invisible — no words shown |
| Suggesting blockers | "What usually gets in the way?" + pre-filled options | One question |
| Drift nudge | "We drifted a little." | 6 words max |
| Goal completion | "Nice work." | 2 words |
| Evening reflection | "One goal remains unfinished." | One sentence |
| Recurring carry-forward | "This has been carried forward for 4 days. Is it still important?" | One question |
| Focus Areas emergence | "I've noticed your goals tend to fall into a few areas." | One sentence |
| Focus Areas lifecycle | "You haven't mentioned **X** in a while. Archive it?" | One question |

### When the AI Is Silent

During focus sessions — which represent **95% of usage time** — the Monk does not speak. It:
- Breathes slowly
- Blinks occasionally
- Shifts weight subtly
- Exists as a calm presence

No tips. No motivational quotes. No "you're doing great!" interruptions.

### Tone Rules

1. **Minimal words.** Every AI utterance should feel like it could be fewer words.
2. **No sermons.** Never explain why focus matters. The user already knows.
3. **No guilt.** Never imply the user failed. Unfinished goals are normal.
4. **Gentle questions.** When the AI needs input, it asks — never tells.
5. **Present tense.** "We drifted." Not "You drifted." The Monk is with the user.
6. **No exclamation marks.** Calm energy only.

### The Carry-Forward Moment

When a goal has been carried forward for multiple consecutive days, the AI asks:

> "This has been carried forward for 4 days. Is it still important?"

This is powerful because:
- It surfaces something the user might be avoiding
- It gives explicit permission to let go
- It does not judge — it simply asks

---

## 3. States & Screens

### State 0 — New User (Onboarding)

#### Screen 0.1 — Welcome

- Monk animation plays (idle breathing, subtle wave)
- Text: "Clarity helps you stay aligned with what matters."
- CTA: **Get Started**

#### Screen 0.2 — Tell Monk About Yourself (Optional)

- Monk: "You can tell me a bit about yourself and what you're working on — it helps me organize your goals better. Or skip this and I'll learn as we go."
- Free text input (multiline, generous space)
- Placeholder hint: "e.g. I'm building a productivity app, learning Japanese, and trying to go to the gym 4x/week…"
- CTA: **Save** / **Skip for now**
- If the user provides context, it seeds the Focus Area engine immediately — no waiting period required.
- If skipped, Focus Areas will emerge naturally after ~5–7 days of use.
- This context can be updated anytime from Settings → About Me.

---

### State 1 — First Open of the Day (Morning Check-in)

#### Screen 1 — Intention

- Greeting: "Good morning, Sam."
- Monk visible, calm idle animation
- Question: "What would make today successful?"
- Free text input (multiline)
- User types goals in natural language

**AI Step 1 (invisible to user):**
- Extracts discrete goals from free text
- Maps goals to existing Focus Areas (if any exist), or silently clusters for future emergence
- Identifies implicit priorities from language

#### Screen 2 — Plan Review

- Text: "Here's your plan for today."
- Goals displayed organized by area (or ungrouped if no areas exist)
- Each goal is editable (tap to modify, swipe to delete, button to add)
- Question: "Which one should we protect first?"
- User taps a goal to select it as primary focus

#### Screen 3 — Blocker Identification

- User has selected a focus goal
- Monk: "What usually gets in the way?"
- AI suggests common blockers based on past behavior:
  - YouTube
  - Social Media
  - Reddit
  - News sites
  - (Custom additions)
- User can add/remove blockers
- CTA: **Protect this focus**

**AI Step 2 (invisible to user):**
- Creates a Focus Session Template:
  - Focus goal (text)
  - Blocked sites/apps (list)
  - Suggested duration (based on past sessions or default 50 min)

#### Screen 4 — Confirmation

- Monk: "I'll help you stay with it."
- Summary: goal, duration, blocked distractions
- CTA: **Start Focus Session**

---

### State 2 — Active Day

#### Home (No Session Active)

No questions. No wizard. The screen shows:

- **Current Focus** — the prioritized goal, with time focused today
- **Today's Goals** — checklist with status indicators (done / in progress / pending)
- CTA: **Continue Session** or **Start Session**

#### During Focus Session

- Monk is present on screen
- **95% silence.** Monk breathes, blinks, shifts. Nothing else.
- Timer visible but not dominant
- Blocked sites are enforced in the background (via browser extension)
- No notifications from the app during active focus

#### Drift Detection

Trigger: user is detectably off-task for **~12 minutes** (configurable).

- Monk: "We drifted a little."
- Two options presented:
  - **Return** — resume focus session
  - **Continue** — acknowledge and stay off-task (no guilt)
- Nothing else. No explanation. No stats about lost time.

#### Goal Editing (Midday)

- User taps "Adjust Today"
- Question: "What changed?"
- Can: Add goals / Remove goals / Reprioritize
- AI reorganizes the day view
- No commentary on what was removed. No guilt.

---

### State 3 — Goal Completion

When the user marks a goal as complete:

- Monk: "Nice work."
- Brief micro-celebration animation (subtle, not gamified)
- Question: "What should we focus on next?"
- Remaining goals shown
- User selects next focus or dismisses

If all goals are complete: see Edge Cases.

---

### State 4 — Evening Reflection

**Trigger:** After 18:00 local time, or end-of-day detected (all sessions ended, app reopened late).

#### Summary View

- Shows completed goals (checked) and incomplete goals
- If goals remain: "One goal remains unfinished." (or appropriate count)

#### Decision Point

- Question: "What would you like to do?"
- For each unfinished goal, options:
  - **Carry Forward** — moves to tomorrow
  - **Reschedule** — pick a future date
  - **Let It Go** — remove without guilt

#### AI Step 3 — Carry-Forward Pattern Detection

If a goal has been carried forward for multiple consecutive days:

> "This has been carried forward for 4 days. Is it still important?"

Options:
- **Yes, keep it** — carries forward again
- **Break it down** — AI helps split into smaller steps
- **Let it go** — removes permanently

---

### State 5 — Emergent Focus Areas

Focus Areas are Clarity's replacement for traditional categories. They are **not predefined** — they emerge from the user's actual goals, or are seeded by optional user context. They represent a mix of projects (temporary) and life areas (ongoing), treated equally.

#### Design Principles

1. **No predefined categories at onboarding.** No chips (Work, Health, Learning, etc.). The system learns from behavior.
2. **Categories are project-level AND life-level, mixed.** Real examples: "Clarity" (the app), "Client project X" (freelance), "Japanese" (language), "Gym" (physical), "Apartment" (errands), "Social" (friends/events). Some are temporary, some ongoing — the system handles both without distinction.
3. **Categories have a lifecycle.** They emerge, fade, split, and merge over time.
4. **Context comes from actual inputs, not forms.** The richest signal is the morning brain-dump text. The LLM maps goals to the user's personal categories, not generic buckets.
5. **Optional user context seeds the engine.** The "Tell Monk about yourself" feature (Screen 0.2) can bootstrap Focus Areas immediately instead of waiting 5–7 days.
6. **Users can always manually create and edit.** The system is collaborative — AI proposes, user controls.

---

#### 5.1 — Emergence (AI Pattern Detection)

**Trigger:** After ~5–7 days of daily use (or immediately if user provided context in Screen 0.2), Monk detects recurring themes in goals.

**How it works:**
- Monk silently clusters the user's goals based on language, topics, and repetition
- Each potential area tracks a confidence score and mention count
- When confidence crosses a threshold, Monk proposes

#### 5.2 — Proposal Screen

- Monk: "I've noticed your goals tend to fall into a few areas."
- Proposed Focus Areas displayed with auto-assigned emoji and labels:
  - 🏔 Clarity
  - 🇯🇵 Japanese
  - 💪 Gym
  - 📖 Reading
  - (Based on actual user patterns, not generic buckets)
- Question: "Want me to start organizing around these?"
- Options:
  - **Looks good** — accepts all proposed areas
  - **Edit** — opens inline editing (rename, remove, add more)
  - **Not now** — dismisses; Monk waits another week before re-proposing

#### 5.3 — After Acceptance

- New goals are auto-categorized into areas by the LLM
- Home screen gains a subtle Focus Areas section (grouped goals, time by area)
- Weekly summary shows time/completion by area
- User sees long-term patterns without ever filling a complex form
- Over time, mapping accuracy improves as more context accumulates

#### 5.4 — Lifecycle Management

Focus Areas are living objects with a full lifecycle:

| Phase | Trigger | Behavior |
|-------|---------|----------|
| **Emerge** | AI detects recurring theme (or user creates manually) | Area is proposed or created |
| **Active** | Ongoing use | Goals auto-map to it; visible on home screen |
| **Fade** | No mentions for ~2 weeks | Monk suggests archiving: "You haven't mentioned **Apartment** in a while. Archive it?" |
| **Split** | AI notices an area is too broad | Monk proposes split: "**Work** seems to cover both Clarity and your freelance client. Want to split them?" |
| **Merge** | AI notices two areas overlap | Monk proposes merge: "**Exercise** and **Gym** seem like the same thing. Combine them?" |
| **Archive** | User manually archives, or confirms fade suggestion | Removed from active view; goals remain tagged; can reactivate anytime |

#### 5.5 — Manual CRUD (User-Initiated)

Users can create and manage Focus Areas at any time, without waiting for AI proposals:

**Create:**
- Settings → Focus Areas → "Add new"
- Fields: Label (required), Emoji (optional, AI suggests one), Color (optional)
- New area is immediately active and available for goal mapping

**Edit:**
- Tap any Focus Area → Edit
- Rename, change emoji, change color
- Changes apply to all existing tagged goals

**Archive / Delete:**
- Swipe or long-press → Archive
- Archived areas hidden from active view, but goals retain their tags
- "Reactivate" option in Settings → Focus Areas → Archived

**Manual Assignment:**
- From any goal, user can tap to assign/reassign Focus Area
- Goal detail view shows current area with tap-to-change
- Bulk reassignment available from Focus Areas settings

The manual experience should feel **lightweight** — not like managing a complex taxonomy. Think of it as tagging, not filing.

#### 5.6 — User Context / Profile (Seeding Engine)

This is a first-class feature, not an afterthought. It gives users a way to shortcut the learning period.

**Where it appears:**
- Onboarding (Screen 0.2): "Tell me about yourself"
- Settings → About Me: editable anytime
- Periodic gentle reminder (if user skipped onboarding and Focus Areas haven't emerged after 3 days): "Tip: telling Monk about yourself helps organize goals faster."

**How it works:**
- User writes free-form text about their life, projects, and goals
- Example: "I'm building a productivity app called Clarity, learning Japanese, and trying to go to the gym 4x/week. I also freelance for a client called Acme."
- On save, the LLM extracts Focus Areas immediately and proposes them (same UI as 5.2)
- Context is stored and referenced when mapping future goals

**UX considerations:**
- The input should feel conversational, not like a form
- No required fields or structure
- User can update/overwrite anytime
- Old context is retained for reference but new context takes priority

---

## 4. Daily Flow Summary

```
Morning          Day                    Evening
─────────────    ───────────────────    ──────────────────
Goals            Focus Session          Reflect
  ↓                ↓                      ↓
Prioritize       Silence (95%)          Carry Forward
  ↓                ↓                      or
Protect          Drift Detection        Let Go
                   (if needed)

                 After ~5-7 days (or immediately with user context):
                 Focus Areas emerge and organize goals
```

---

## 5. Edge Cases & Rules

| Scenario | Behavior |
|----------|----------|
| User has no goals | Don't force. Monk waits. Home shows empty state with gentle prompt. |
| User skips morning check-in | Show afternoon state directly. No "you missed your morning" message. |
| All goals are completed | Celebrate. Monk: "Everything's done." Do NOT suggest more work. |
| User dismisses Focus Areas proposal | Never ask again for 1 week minimum. |
| User opens app at unusual hour | Adapt state to time. No judgment about schedule. |
| User hasn't opened app in days | No guilt on return. Treat it as a fresh day. |
| Drift detection during creative work | User can set "deep work" mode that disables drift detection entirely. |

### Configurable Thresholds

- **Drift detection delay:** Default 12 minutes. User can adjust (5–30 min range).
- **Evening reflection trigger:** Default 18:00. User can set custom time.
- **Focus Areas emergence:** Default ~5–7 days. Requires minimum 5 days of goal-setting data (or immediate with user context).
- **Focus Area auto-archive suggestion:** Triggers after ~2 weeks of no mentions.
- **Carry-forward alert:** Triggers after 4 consecutive days by default.

### Hard Rules (Never Violated)

1. Never use guilt or pressure language
2. Never interrupt during deep focus unless drift is clear and sustained
3. Never suggest "more work" when goals are complete
4. Never require onboarding steps — everything is skippable
5. Never show streaks, scores, or gamification metrics
6. Never send push notifications during active focus sessions
7. Always use "we" not "you" when referencing drift or difficulty

---

## 6. V1 Scope

If building V1 tomorrow, the minimum viable product includes:

### Included in V1

| Feature | Priority |
|---------|----------|
| Morning check-in (free text → structured goals) | P0 |
| Goal prioritization | P0 |
| Focus session with timer | P0 |
| Blocker configuration (browser extension) | P0 |
| Drift detection with 6-word nudge | P0 |
| Evening reflection | P0 |
| Carry forward / let go mechanics | P0 |
| Monk character (idle animation, minimal expressions) | P0 |
| Focus Areas (emergent after ~5-7 days, or seeded by user context) | P1 |
| User context / "Tell Monk about yourself" | P1 |
| Manual Focus Area CRUD | P1 |

### Deferred Beyond V1

- Detailed analytics/progress views
- Multiple device sync
- Team/shared accountability features
- Calendar integration
- Advanced Monk personality/expressions
- Voice input for morning goals

### V1 Design Principle

> Simple enough to build quickly. Deep enough to feel like a real companion, not a todo app with an avatar.

The product should feel complete at V1 — not like a skeleton waiting for features. The magic is in the restraint: what the AI *doesn't* do is more important than what it does.

---

## Appendix: Monk Character Guidelines

- **Visual:** Small, cute, non-human (abstract/creature). Not a robot. Not a human face.
- **Default state:** Breathing, blinking, subtle idle motion
- **Engaged state:** Slight lean forward, eyes focused (during questions)
- **Celebration state:** Brief happy motion, returns to calm quickly
- **Drift state:** Gentle head tilt, soft concern (not alarm)
- **Never:** Sad, disappointed, angry, frustrated, impatient

The Monk is always calm. Even when surfacing something difficult (carry-forward pattern), the energy is curious, not concerned.
