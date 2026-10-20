# Pitfalls that silently invalidate an assessment

Each of these has produced a wrong finding, a contaminated run, or a wasted
batch in a real assessment. Read this list before building flows, and come back
to it whenever a result looks surprising. Uniform results across a run (the
same duration, the same end reason, or the same failure on every call) almost
always point to our setup, not the agent.

## Flows and scripted openings

- **"Preceded by" is an opening inside the same call, not call sequencing.**
  - Setting `precededByCustomerFlowId` (and `precededByCustomerFlowVariantId`)
    on a happy path or edge case plays that scripted flow at the start of the
    same call, then hands over to the improv caller.
  - It never makes one call happen after another. Confirm where the field goes
    with docs search.
- **Set the preceding link on every variant and read it back.** Edge cases do
  not inherit it. A variant without the link meets the IVR with no script and
  dies in the menu. Check it again whenever anyone adds variants.
- **A scripted flow ends the call after its last step.** For exact steps (an
  access code, keypad entry, a menu choice) followed by a free conversation, use
  a scripted opening that precedes an improv flow. A scripted flow on its own
  hangs up right after its last step.
- **The opening and the main flow must use the same persona,** or one that is
  clearly separate by design. If the opening uses a different voice or name,
  the call starts as one person and continues as another. The agent then gets
  graded on the mismatch.
- **Exclude the opening from scoring.** The preamble (gate, IVR menu, recorded
  notices) must sit in a stage window that runs from the start of the call to
  the handover. Otherwise recorded IVR voices and keypad turns contaminate
  voice, latency and comprehension metrics.
- **Test a validity gate against the real path before you rely on it.** In one
  run, an unsatisfiable "required stage" invalidated nearly every billed call.
  Invalidated calls cannot be revived.
- **Openings can drift.** The caller may skip, reorder or mistime a verbatim or
  silence step, especially when the agent answers in two utterances.
  - Mark the steps that must happen as required, so a skipped step invalidates
    the call instead of producing a misleading result.
  - Confirm in the recording that a pause or a mid-number split actually
    happened. A finding built on a pause that never happened gets dropped later.
- **Use keypad steps (`CUSTOMER_DTMF`) for keypad entry.** A caller saying
  digits is a different test, and IVRs often reject spoken digits.
  - Test terminators (for example `#`) as their own scenario, timing them from
    the recording.
  - Scan the IVR part of every transcript for duplicate or wrong-moment tones
    before reading any agent results.
- **Agents sometimes ask for a key press mid-conversation.** Make sure the
  improv caller presses only the key just requested, and that it is allowed to.
- **Keep scripted agent turns empty.** Putting the line's prompt text into an
  agent turn turns it into something the agent is graded on.
- **When the customer changes their IVR, update the scripted flow's expected
  prompts.** Otherwise keypad steps stop firing and the caller speaks the digits
  instead.
- **Audio tags are flow-type specific.** Improv callers may drop bracketed
  audio tags such as a cough, while a scripted verbatim line keeps them.
  Check what the voice supports before declaring a test impossible, and confirm
  by listening.

## The simulated caller

- **Every flow brief must say:**
  - **Never ask for a person** (unless the test is about that). If the agent
    transfers you or a person picks up, end the call politely. Never grade a
    human.
  - **Never agree to something you cannot do** (receive a text at another
    number, open a link, read a code). Ask where it would be sent, and decline
    otherwise.
  - **Use only the details given.** Never make up identifiers, line items or
    numbers.
  - **Stay on this call's goal.** Persona backstories with errands of their own
    take over calls.
- **Phrasing that the caller parrots or that blocks the path is a bug in the
  brief.** For example:
  - "You do not have a valid tracking number" made a caller announce exactly
    that.
  - "Never press keys" made a caller refuse a keypad prompt.
  - Telling callers to decline offers meant a case was almost never opened.

  Read every brief for words the caller will repeat and rules that stop it
  reaching the moment under test.
- **Uniform caller phrasing inflates a real weakness.** One example line used
  verbatim on 19 of 21 calls ("Of course, take your time") triggered the same
  agent slip on every call. The finding was real, but its prevalence was
  manufactured.
  - Vary acknowledgements.
  - Stay silent while the agent looks something up.
- **Bare pleasantries read as goodbyes.** "You're welcome!", "Cheers" and
  "Perfect, thanks" in the middle of a task make some agents close the call.
- **Watch for role flips and narration.** A caller that answers like the agent,
  speaks a stage direction ("I stayed silent as requested") or reads tool output
  aloud makes every later turn untrustworthy. Exclude those calls.
- **Our caller interrupts.** An agent that goes silent or stops mid-sentence
  right after our caller spoke over it may be reacting to us. Check in the
  recording who spoke first.
- **Our caller overloads turns.** Many agents miss part of a reply that packs
  several answers together. It can still be a fair finding, but say so, and
  check the hypothesis across all calls before naming it as the cause.
- **Personas share a voice when gender, age and accent match.** Give each
  persona in a pool a distinct combination.
- **Pools dedupe.** Ten repeats of a scenario over a nine-persona pool produced
  nine calls. Always read `testCaseCount` after creating the plan.
- **Name the caller as the account holder** when the agent looks the account
  up. Otherwise the caller "corrects" the agent and derails the step under test.
- **Give the caller an escape hatch** for dead loops (for example, "if
  verification fails twice, ask once for an alternative, then end the call").
  Otherwise a polite caller burns the full time cap.

## Plan configuration

- **Always set end-call reasons.** Without them the caller cannot hang up, and
  the configured maximum duration has not reliably ended calls either.
- **There is no plain `SEQUENTIAL` execution mode.** For one call at a time, use
  `PARALLEL` with `maxConcurrentJobs: 1`, or a `SEQUENTIAL_*` mode.
- **You cannot schedule a gap between calls inside one run.** For "call again
  later" scenarios, start separate runs at the times you need and record the
  real timestamps.
- **`simulationRunPlan.create` nests its result** (`{ runPlan, runPlanJob }`).
  If you lose the id, find the plan by name. Duplicate plan names make this
  ambiguous, so keep names unique.
- **A trigger that times out client-side may still have started.** List the runs
  before retrying, or you end up with duplicate runs competing for the same line.
- **Never repair experimentally on the plan the customer sees.** Reproduce on a
  throwaway plan, and delete probes you create.
- **Treat writes to shared preamble flows as high risk.** Every variant links to
  them. Back up the flow before editing it, then read it back.
- **Saved plans do not follow later template changes.** Before re-running a
  plan, compare it with the current template (property, values, iterations).
- **Keep test scripts separate from scripts that place calls.** Importing a
  runner file can start a run.

## Caller numbers and history

- **Shared-pool numbers carry history.** Features keyed on the caller's number
  depend on that number's history on the agent's side: repeat-caller greetings,
  escalation after N calls, known-customer lookups and mock profiles. Shared-pool
  numbers have unknown or long histories. One reused number already had about a
  thousand earlier calls to the customer's line.
- **We can only present numbers we own or have verified,** never an arbitrary
  caller ID. Ask the customer to map our numbers to their test profiles, or to
  confirm that history builds from live calls.
- **A persona can carry a fixed caller number** (`persona.phoneNumber`). It is
  read-only over the API. Ask Roark for numbers with no history, then confirm
  after the run that the calls really used them.
- **Pinned numbers limit concurrency** to the number of distinct pins. A pinned
  number must never fall back to another number, or the profile silently
  changes.
- **A control must really be outside the set.** A test meant to show "an
  unregistered number behaves differently" is invalid if the control numbers
  were on the customer's list.
- **A negative result is still a result.** Report clean evidence (which numbers,
  how many calls, at what gaps), then ask how history is built before calling
  the feature broken.

## Telephony and infrastructure

- **Silent lines happen.** When the agent never speaks, decide whose side it is
  before reporting it:
  - Carrier evidence: the callee hangs up within seconds, or media flows but
    every sample is silent.
  - Whether the same number answered normally minutes earlier.
  - Whether other projects saw it at the same time.

  The customer's silent line is a real finding: report the count, and never
  mask it with automatic re-dials. Our own dial failures are not findings.
- **Never attribute a non-connection to the customer without tracing the
  session.** Our setup failing under a burst has looked exactly like their line
  failing.
- **Shared load matters.** Another tenant's large run can drain capacity, and
  high concurrency can push the customer's agent into errors. Raise
  concurrency in steps.
- **Business hours change outcomes.** Transfers outside opening hours hit "we
  are closed", which can look like a result about the caller property you were
  testing.
- **Merged is not deployed.** Before a run that depends on a fix, check that the
  fix is live.

## Test data and environment

- **Test data drifts.**
  - Earlier calls create bookings, open cases and add holds.
  - Billing cycles roll over, so "your latest bill" changes meaning.
  - Dates pass.

  Pin scenarios to dated facts ("the September 1 statement"), clear or vary
  state between runs, and smoke a few calls before each wave to confirm the
  agent still reads the expected figures.
- **Concurrent calls collide on a shared account.** Run state-changing scenarios
  one at a time, on distinct dates. Cancel your own bookings, and list any you
  leave behind for the customer.
- **When the same claim repeats on every call with the same test input**
  (N of N), it comes from the backend or the data, not the agent. Report it as
  a test data note or a question, and only re-run once the customer fixes the
  data.
- **Check data notes only on calls that actually used that record.** A caller
  that drifted onto another record makes a note look wrong.
- **We do not know the account's ground truth.** Claim inconsistency you can
  prove ("$10 here, $12 three turns later"), not wrongness you cannot.
- **Some customer-authored scenarios are dead ends** (they always transfer).
  Pick scenarios the agent can complete on its own, unless the transfer is the
  point of the test.
