export const meta = {
  name: 'fitgps-day-cumulative',
  description: 'Switch the fitGPS steps aggregation from HOURLY_SUM to DAY_CUMULATIVE based on on-device evidence, update tests, goldens and docs; adversarial review; fix',
  phases: [
    { title: 'Implement', detail: 'profile switch, tests, fixtures expectations, docs in both repos' },
    { title: 'Review', detail: 'independent adversarial reviewer in its own copy' },
    { title: 'Fix', detail: 'verify and fix confirmed findings, rerun gates' },
  ],
}

const S = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const CTX = `
CONTEXT
- Repos: Repo 1 ${R1} (KMP: modules :protocol and :bridge) and Repo 2 ${R2} (RN TurboModule host; Android adapter over :bridge). Read ${R1}/CLAUDE.md and ${R2}/CLAUDE.md first. Docs/KDoc/comments in Portuguese, identifiers in English, tabs, package READMEs, KDoc on public API (Dokka failOnWarning).
- Hard rules: no git writes (read-only git is fine); the trees hold uncommitted work, never revert it; don't touch /Users/joao.farias/GTE-Mormaii or /Users/joao.farias/TechnosWareCore (reading is fine); never copy corenext-export/logs-*.jsonl and never write the watch MAC anywhere. Scratch only under ${S}/daycum/.
- Snapshot before this change: make one yourself first if you are the implementer: rsync -a --exclude build --exclude .gradle --exclude .kotlin --exclude node_modules --exclude corenext-export each repo into ${S}/daycum/snap-before/.
- EVIDENCE (on-device, 2026-10-29, fitGPS fw 0.2.1): hypothesis H3 in docs/protocolo-sma.md §8 asked whether SPORT records (05/42, mode 0) carry the hour total or the day accumulator. Morning recording fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl: mode 0 values within hour 08 went 0, 14, 14, 14, 56 (08:27:29), 56 at 08:30:00 and 56 live at 08:31:22. Evening recording fixtures/real/fitgps/0.2.1/pair-commands-sync-bt-reconnect-disconnect-reconnect.jsonl: the live records at atMs 29133 and 38440 (stamped 21:37:37 and 21:37:47) are mode 0 with 56 steps. The user confirmed the watch stayed still the whole day after the morning and the watch screen showed 56 steps for the day at that time. Conclusion: for fw 0.2.1 the mode 0 value is the day accumulator (it does not reset at the hour); a per-hour counter would read 0 at 21:37 after a still day. Still unknown: when/how it resets at midnight (T5) and whether records at hh:00/hh:30 are snapshots.
- Consequence: the default chosen earlier (ADR 1, Quirks.stepsAggregation = HOURLY_SUM, copied from production Core SMAService.java:430-450 + 855-870, which buckets mode 0 by hour keeping the last value and then SUMS the hours per day; iOS SMAService.m:1277-1288 does the same) overcounts: the day total becomes the sum of hourly snapshots of a cumulative counter. ADR 1's own revert plan says: if the value keeps growing across the hour, switch the profile to DAY_CUMULATIVE. StepsAggregation.DAY_CUMULATIVE already exists (profile/DeviceProfile.kt:41-49; session/StepsAggregator.kt: day = sample with the highest step count) and is exercised in HistoryStoreTest.
- Gates: Repo 1 ./gradlew check --rerun-tasks (both modules, 4 test targets each, lint, checkObjcHeader, checkSwiftInterop, checkObjcInterop), ./gradlew dokkaHtml, ./gradlew publishToMavenLocal assembleTechnosWatchProtocolXCFramework; Repo 2: cd ${R2}/example/android && ANDROID_HOME=~/Library/Android/sdk ./gradlew --refresh-dependencies :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug; JS: cd ${R2}/example && npx tsc --noEmit && npm test; cd ${R2} && npm run typecheck. Link/anchor checkers if present: python3 -I ${S}/tools/linkcheck.py ${R1} ${R2}; python3 -I ${S}/item1/integrate/anchorcheck.py ${R1} ${R2}. Current baseline: :protocol 202/194/194/204, :bridge 104/99/99/107 (jvm/debug/release/iOS); Repo 2 42 Android tests; REPLAY lines for both real fixtures and the synthetic one on all 4 :protocol targets; REALTIME-REPLAY and the :bridge GOLDEN on all targets.
`

const RESULT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    verification: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, outcome: { type: 'string' } }, required: ['command', 'outcome'] } },
    openIssues: { type: 'array', items: { type: 'string' } },
    deviations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'filesChanged', 'verification', 'openIssues', 'deviations'],
}
const REVIEW = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, line: { type: 'number' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'file', 'problem', 'evidence', 'fix'] } },
    checkedAndFine: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'checkedAndFine'],
}

phase('Implement')
const impl = await agent(`${CTX}
YOUR TASK (implementer):
1. Switch Profiles.MORMAII_FIT_GPS quirks.stepsAggregation to StepsAggregation.DAY_CUMULATIVE. Re-read StepsAggregator, SmaStepsMapper and HistoryStore and make sure the DAY_CUMULATIVE path is right for a counter that only grows during the day: rounding mode 0 records to the hour and keeping the last per hour still works (the day is the max); calories and distance come from the same max sample (check how they are computed); live records from refreshSteps; dedup/merge by instant; the 3 h future tolerance; days with only one sample. If something in that path is wrong for real day-cumulative data, fix it with a test. Do not change behaviour of HOURLY_SUM (it stays available and tested).
2. Tests: keep both aggregation branches covered by explicit tests independent of the fitGPS profile. Update tests that implicitly relied on fitGPS = HOURLY_SUM. The synthetic fixture (fixtures/synthetic/fitgps-pair-sync.jsonl, generated by SyntheticFitGpsFixture, documented in docs/fixtures.md §5 with expected totals 27/10 = 600 and 28/10 = 4007 under hourly semantics) must stay consistent: either regenerate its step data so it looks like a real day accumulator (monotonic within a day, restarting after midnight) with new expected totals, or keep the data and recompute/document the expected totals under DAY_CUMULATIVE — pick the more realistic option, regenerate with FIXTURES_REGENERATE=1 if you change the generator, and update the doc section with an independent recomputation (a small python script in scratch). Add assertions on the two REAL fixtures: the day total for 2026-10-29 from the morning recording and from the evening recording is 56 steps under the fitGPS profile (and would be 56+56=112 under HOURLY_SUM if both recordings' samples were in one store — add a test that merges both recordings' samples into one store and shows DAY_CUMULATIVE = 56, HOURLY_SUM = 112, documenting the overcount). If the :bridge event-stream golden changes, regenerate it with BRIDGE_GOLDEN_REGENERATE=1 and explain every changed line. Mutation-check: set the profile back to HOURLY_SUM -> at least the new real-fixture test fails; restore; diff -q.
3. Docs (Portuguese) with the evidence above, citing fixtures by atMs and the user's on-device confirmation (2026-10-29): Repo 1 docs/decisoes.md ADR 1 (decision changed: DAY_CUMULATIVE for fitGPS fw 0.2.1, evidence, what is still open: midnight reset/T5; how to revert), docs/protocolo-sma.md §8 H3 row (confirmed day accumulator for fw 0.2.1; midnight open) and any other place that states HOURLY_SUM as the fitGPS default (grep: protocolo-sma, sma-dados §2/§6, arquitetura, glossario, Profiles/Quirks/DeviceProfile/SmaStepsMapper KDoc, package READMEs, CLAUDE.md, README), docs/pendencias.md (block 3: H3 part answered, keep the hour-boundary/T1 run only for how the hour closes and A6; technical item 2 'Risco do HOURLY_SUM' resolved by the switch, with the production finding), docs/fixtures.md (synthetic section if changed; the two real fixtures' sections can mention the day totals). Repo 2: docs/pendencias.md (integration with the Mormaii app) gets a clearly labelled finding: the production Core (TechnosWareCore SMAService.java:430-450 and 855-870; SMAService.m:1277-1288) sums hourly snapshots of the fitGPS day accumulator, so the fitGPS step totals the production app sends to the backend are probably inflated; suggest checking the backend data (/Users/joao.farias/smartBackend is the backend repo; no DB access assumed) — documentation only, no code outside the two PoC repos. Update any Repo 2 doc that states HOURLY_SUM.
4. Run all gates. Report test counts per task, the REPLAY/GOLDEN lines, and the new day-total assertions.`, { label: 'implement', phase: 'Implement', schema: RESULT })

phase('Review')
const review = await agent(`${CTX}
An implementer just switched fitGPS to DAY_CUMULATIVE. Their report (claims to verify): ${JSON.stringify(impl)}

You are an adversarial reviewer. Do NOT edit ${R1} or ${R2}; copy them (rsync excluding build dirs) into ${S}/daycum/review/ and run Gradle only there. Diff against ${S}/daycum/snap-before/.
Check: (1) the DAY_CUMULATIVE path is correct for real accumulator data (hour rounding, last-per-hour, max per day, calories/distance consistency, live refresh records, merge/dedup, the future tolerance, single-sample days, a day where the accumulator is re-read after an UNBIND or reset mid-day — say what happens and whether docs mention it); (2) HOURLY_SUM untouched and still tested; (3) tests are meaningful (run your own mutations: e.g. aggregator taking the sum or the last instead of the max; profile back to HOURLY_SUM; synthetic expectations), the synthetic fixture and its doc agree (recompute independently), the golden changes are justified line by line; (4) every doc statement matches the evidence exactly (no overclaiming: one still day + screen match proves 'does not reset at the hour' for fw 0.2.1, not midnight behaviour), no remaining text says HOURLY_SUM is the fitGPS default, the production finding in Repo 2 cites the right lines (read TechnosWareCore read-only to confirm); (5) gates green in your copy. Report only real problems with evidence.`, { label: 'review', phase: 'Review', schema: REVIEW })

let fixes = null
if (review && review.findings && review.findings.length) {
  phase('Fix')
  fixes = await agent(`${CTX}
Implementer report: ${JSON.stringify(impl)}
Reviewer findings: ${JSON.stringify(review.findings)}
YOUR TASK: verify each finding against the real repos (confirm/reject with evidence), fix the confirmed ones with the smallest correct change (tests + mutation checks for behaviour), keep all repo rules, then rerun ALL gates and report counts and REPLAY/GOLDEN lines. Summary must list each finding id with confirmed/rejected and what was done.`, { label: 'fix', phase: 'Fix', schema: RESULT })
}
return { impl, review, fixes }
