export const meta = {
  name: 'fase3-base-crp',
  description: 'Phase 3 foundation: S0 contract + fallback stubs (Repo 1, publish) ∥ S6a JS contract (Repo 2), then S0h native fallback (Repo 2), review and fixes',
  phases: [
    { title: 'Base', detail: 'S0 (Repo 1, contrato + stubs + publicação) ∥ S6a (Repo 2, contrato JS)' },
    { title: 'Hosts', detail: 'S0h: spec nativo, stubs do SampleStore/CoreHost, 9 métodos, 10 eventos nos dois hosts' },
    { title: 'Revisão', detail: 'contrato vs spec e produção; portões' },
    { title: 'Correções', detail: 'aplica achados verificados e roda os portões' },
  ],
}

const SCR = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const SPEC = `${SCR}/fase3/spec.json`
const RESEARCH = `${SCR}/fase3/research.json`
const CRIT = `${SCR}/fase3/critica.json`
const DEV = `${R2}/docs/desvios-de-producao.md`

const RULES = `
HARD RULES (every agent):
- Never run git add/commit/stash/reset/checkout/restore/clean/rebase, never git init. Read-only git (status, diff, log, show <tag>:<path>) is fine. Everything stays in the working tree; the user commits. Phase 2 is committed (Repo 1 a5c8aa5, Repo 2 44080ba); both trees were clean when this workflow started.
- Only modify files inside ${R1} and ${R2}. Read-only: /Users/joao.farias/TechnosWareCore (production Core; the Condor pins tag v4.3.57, read it with git -C /Users/joao.farias/TechnosWareCore show v4.3.57:<path>), /Users/joao.farias/GTE-CondorSmart (production app), /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/CrpTechnosIosSdk, ${SCR}/vendor-recheck/src and ${SCR}/vendor-sdks (decompiled vendor SDKs).
- Never copy recordings, logs, exports or HCI captures into a repo. Untrusted recordings are read only with python3 -I and scripts outside their directory.
- Privacy: never write a MAC address, phone/iPhone names, nearby device names or real personal/health data. Tests and examples use fictitious values.
- Repos' conventions (read each repo's CLAUDE.md first): docs, KDoc and comments in Brazilian Portuguese; identifiers in English; tabs; Repo 2 docs wrap at 120 columns; KDoc on every public symbol (dokkaHtml fails otherwise); public Kotlin API without suspend/Flow/value class/kotlinx-datetime (ObjC header check).
- Other agents may edit other files of the same repos concurrently. Re-read any shared doc immediately before each edit and edit only your sections.
- If you deviate from the spec, say so in your output with the reason. Never claim a check you did not run; report failing commands with their output.
`

const CONTEXT = `
CONTEXT: Phase 3 of the CRP port (Condor Reebok, BLE name P85, firmware MOY-VS02-2.0.0): histories (heart rate, stress, SpO2), watch workouts (B2) and app-started activity, into Repo 1 = ${R1} (KMP :protocol + :bridge) and Repo 2 = ${R2} (TurboModule: Android/iOS hosts, JS, example app).
- The SPEC is ${SPEC} (keys: cutLine, decisions F3-D*, commands, api, platform, deviations DP-102..134, tests, docs, workSlices S0..S10, validationChecklist, risks, userQuestions). Read the parts your slice needs in full; decisions are binding. The critique outcome (what changed and why) is in ${CRIT}; research with sources is in ${RESEARCH} (cited as condor:, core@, sdk:).
- The user has NOT yet answered spec.userQuestions (GPS, Health Connect/HealthKit, cut order). This workflow implements only what is common to every answer: the full phase 3 contract with FALLBACK STUBS (slice S0/S0h) and the JS contract (S6a). Do not implement GPS, Health Connect/HealthKit, or real protocol readers here. Keep extension points the spec names for a later GPS slice (CoreHost.startActivityWork, PhoneActivityInfo distance) without adding GPS API.
- Fallback behavior must be exactly the spec's: getHistoryHeartRate/Stress/SpO2/ActivityV2 emit their event with an empty list and resolve; startActivityByTypeV2 emits onActivityError {errorCode: -1} and resolves (check the spec for the exact order event/resolve and any rejection rule); pause/resume/stop resolve without traffic; checkIosBackgroundLocationPermission resolves with the host's locationAuthorization (null on Android → check the spec/production for what JS receives); the 10 events are declared and routed in both hosts' emit switch.
`

const SLICE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'red'], description: 'green = everything compiles and the gate commands you ran pass' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsRun: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
    deviations: { type: 'array', description: 'Behaviors that differ from production (TechnosWareCore v4.3.57 / Condor), with sources; mark whether they are already among spec DP-102..134', items: { type: 'object', properties: { title: { type: 'string' }, production: { type: 'string' }, coreNext: { type: 'string' }, reason: { type: 'string' }, coveredBySpecDp: { type: 'string' } }, required: ['title', 'production', 'coreNext', 'reason', 'coveredBySpecDp'] } },
    specDeviations: { type: 'array', items: { type: 'string' }, description: 'Where you departed from the spec, and why' },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'filesChanged', 'testsRun', 'deviations', 'specDeviations', 'openPoints'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'integer' }, issue: { type: 'string' }, evidence: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, fix: { type: 'string' } }, required: ['file', 'line', 'issue', 'evidence', 'severity', 'fix'] } },
    gateResults: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
    checked: { type: 'string' },
  },
  required: ['findings', 'gateResults', 'checked'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'red'] },
    applied: { type: 'array', items: { type: 'string' } },
    rejected: { type: 'array', items: { type: 'string' } },
    gateResults: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
    filesChangedTotal: { type: 'object', properties: { repo1: { type: 'array', items: { type: 'string' } }, repo2: { type: 'array', items: { type: 'string' } } }, required: ['repo1', 'repo2'] },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'applied', 'rejected', 'gateResults', 'filesChangedTotal', 'openPoints'],
}

phase('Base')
const [s0, s6a] = await parallel([
  () => agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S0 in Repo 1 exactly as spec.workSlices[S0] + spec.api (DOMÍNIO, DEVICEDRIVER, SESSÃO, SAMPLESTORE, COREHOST, COREBRIDGE) + the F3-D* decisions S0 depends on. Summary: phase 3 domain types (DataKind HEART_RATE/STRESS/WORKOUTS after SLEEP, MeasurementSample, WorkoutRecord, WorkoutOrigin, WatchAction StartActivity(sportType, notAfterEpochMillis)/Pause/Resume/Stop/PhoneActivityInfo, WatchEvent ActivityState(phase, fromWatch)/ActivityRefused/HeartRateMeasured, ActivityPhase, WatchErrorCodes.LOW_BATTERY), DeviceProfile.dataKinds (default [STEPS, SLEEP], CONDOR_REEBOK all five), SampleStore + InMemorySampleStore new methods, WatchSession/SessionEngine signatures (getMeasurements/getWorkouts returning empty for now, fetchLastWorkout via the driver, storeWorkout via the inbox), DeviceDriver defaults notSupported, CrpCommand catalog labels, CrpDriver delegating to three NEW EMPTY groups (CrpHealthReader, CrpWorkoutReader, CrpActivityControl) that reject NOT_SUPPORTED, empty simulator extensions, CoreHost +5 methods and FakeCoreHost, CoreBridge +9 methods as STUBS with the internal constructor taking nowMillis and the scheduler dispatcher, the ActivitySessionPort interface, MinimalHost.swift and MinimalTurboModule.mm updated.
Design files so the next slices (S1, S2a, S2b, S3, S4, S5) can work in parallel touching only their own files/regions (spec risk "Conflitos de merge"). Existing behavior (SMA, iDO, CRP phases 1-2, all strict real-fixture replays, the CoreBridge golden) must stay green; if the golden changes only because new events/methods exist, regenerate it intentionally and say so.
Gates, in order: ./gradlew check dokkaHtml; then ./gradlew publishToMavenLocal assembleTechnosWatchProtocolXCFramework (you are the only publisher in this step). Update KDoc and the package READMEs/arquitetura sections the spec's docs field assigns to S0 only (brief; S4/S5 finish them). Report status red with the failing output if something cannot be made green.`, { label: 'S0:contrato', phase: 'Base', schema: SLICE_SCHEMA }),
  () => agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S6a in Repo 2 (JS contract) exactly as spec.workSlices[S6a] + spec.api (SPEC E WRAPPER JS, EVENTOS JS). ALSO add to src/specs/NativeCoreNext.ts the 9 methods and the 10 EventEmitters exactly as listed in spec.api (this was assigned to S0h, but you do it now so the TS side typechecks; S0h will do the native side). Names, argument and payload types must match the production Core (git -C /Users/joao.farias/TechnosWareCore show v4.3.57:src/NativeModules/specs/NativeCore.ts, its index.ts and the type files under src/NativeModules/type/) so the Condor can swap cores; TechnosActivityHistoryV2Activity is a literal copy with all optionals; TechnosCore.activityTypes is a literal copy of v4.3.57; enum values (TechnosActivityV2Status, TechnosActivityOrigin, TechnosActivityErrorCode, PlanType) with the Core's numbers/strings. Check how the Condor uses them (grep /Users/joao.farias/GTE-CondorSmart/src for these names) and make sure every runtime value it imports from the Core for activity/history exists. stopActivityV2(options?) sends {} when undefined. Mock updated with the values. Jest tests.
Do NOT implement native code and do NOT write the components (TechnosNativeChronometer/Map/MapStyles/ActionTimer are S6b) nor the big docs pass (S6b) — only short notes where a doc lists the API, if needed. Native builds will not compile against the new spec until S0h; do not run :app:assembleDebug or pod install.
Gates (from Repo 2 CLAUDE.md): npm test, npx tsc --noEmit in example/, npm run typecheck at the root, ESLint of app and library, Prettier of the library.`, { label: 'S6a:js', phase: 'Base', schema: SLICE_SCHEMA }),
])
log(`S0 ${s0 ? s0.status : 'null'} | S6a ${s6a ? s6a.status : 'null'}`)
if (!s0 || s0.status !== 'green') {
  return { stoppedAt: 'S0', s0, s6a }
}

phase('Hosts')
const prior = (xs) => JSON.stringify(xs.filter(Boolean).map(x => ({ summary: x.summary, filesChanged: x.filesChanged, specDeviations: x.specDeviations, openPoints: x.openPoints })))
const s0h = await agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S0h in Repo 2 exactly as spec.workSlices[S0h] + spec.api (HOST ANDROID / HOST iOS, stub parts only) on top of the Repo 1 artifacts S0 just published (mavenLocal 0.1.0 + XCFramework). Reports so far: ${prior([s0, s6a])}. The TS spec src/specs/NativeCoreNext.ts was already extended by S6a; check it matches spec.api and fix only if wrong.
Do: new SampleStore methods as stubs in both FileSampleStore (Kotlin and Swift: load empty, save nothing, DEBUG log); new CoreHost methods as stubs in AndroidCoreHost and IosCoreHost (activity work only logs, preferences in memory, locationAuthorization null on Android and 'denied' on iOS); the 9 overrides in NativeCoreNextModule.kt and the 9 methods in ios/.../RCTNativeCoreNext.mm calling the CoreBridge; the 10 event names in both hosts' emit switch; an Android unit test for the emit routing (and the iOS equivalent if a TurboModule source test already exists, e.g. TurboModuleSourceTests).
Gates (Repo 2 CLAUDE.md): Android native unit tests; cd example/android && ./gradlew --refresh-dependencies :app:assembleDebug; ios/scripts/sync-xcframework.sh (no --build: S0 already built it); pod install in example/ios; xcodebuild test of the iOS host on the simulator (pick one UDID explicitly); the example app Debug build on the simulator; npm test; both typechecks; ESLint.`, { label: 'S0h:hosts', phase: 'Hosts', schema: SLICE_SCHEMA })
log(`S0h ${s0h ? s0h.status : 'null'}`)

phase('Revisão')
const reports = JSON.stringify({ s0, s6a, s0h })
const LENSES = [
  { key: 'contrato', prompt: `LENS: CONTRACT. (1) Repo 1: the public API added by S0 matches spec.api exactly (names, types, defaults, KDoc in Portuguese), the stubs behave as the spec's GARANTIA paragraph in spec.cutLine says, the group files exist so S1/S2a/S2b/S3/S4/S5 can work in parallel without touching each other's files, and ObjC header/Swift/ObjC++ interop gates pass. (2) Repo 2: the 9 JS methods and 10 events match the production Core exactly (diff against git -C /Users/joao.farias/TechnosWareCore show v4.3.57:src/NativeModules/specs/NativeCore.ts, index.ts and the type files), every activity/history runtime value the Condor imports from the Core exists (grep /Users/joao.farias/GTE-CondorSmart/src), the native modules route all 10 events and implement all 9 methods on both platforms, the stub behaviors match the spec on both hosts.` },
  { key: 'engenharia', prompt: `LENS: ENGINEERING AND REGRESSIONS. Run in Repo 1: ./gradlew check dokkaHtml (report counts per target; confirm the strict real-fixture replays, CrpRealFixturesReplayTest, CoreBridgeGoldenTest and the SMA/iDO suites are green and the golden diff is only the intentional one). Run in Repo 2: Android native unit tests, npm test, npx tsc --noEmit in example/, npm run typecheck, ESLint, and (if time allows) the iOS host tests on the simulator. Review thread confinement, exactly one terminal callback per request, no API leaking suspend/Flow, SampleStore/CoreHost contract implemented by both hosts, nothing committed, nothing outside the two repos changed.` },
]
const verdicts = await parallel(LENSES.map(l => () => agent(`${RULES}\n${CONTEXT}\nThe slices below were just implemented by other agents. Their reports: ${reports}\n${l.prompt}\nREAD-ONLY: do not edit files (you may run builds/tests). Report only real, evidenced problems with file:line and a concrete fix; an empty findings list is fine.`, { label: `review:${l.key}`, phase: 'Revisão', schema: VERIFY_SCHEMA })))
const findings = verdicts.filter(Boolean).flatMap((v, i) => v.findings.map(f => ({ ...f, lens: LENSES[i].key })))
log(`${findings.length} achados`)

phase('Correções')
const fix = await agent(`${RULES}\n${CONTEXT}\nTASK: close the phase 3 foundation.
1) For each review finding below, verify the evidence yourself; apply it if real, reject with an evidence-based reason if not.
2) If you change anything in Repo 1 that Repo 2 consumes, republish (./gradlew publishToMavenLocal assembleTechnosWatchProtocolXCFramework) and refresh Repo 2 (--refresh-dependencies, sync-xcframework.sh, pod install).
3) Run the full gates and report: Repo 1 ./gradlew check dokkaHtml; Repo 2 Android native tests, :app:assembleDebug, npm test, both typechecks, ESLint, iOS host tests on the simulator and the example Debug build. Leave everything green or return red with the failing output.
4) List the final changed/untracked files in both repos (git status --short).
Reports: ${reports}
FINDINGS: ${JSON.stringify(findings)}`, { label: 'correções', phase: 'Correções', schema: FIX_SCHEMA })

return {
  s0: s0 && { status: s0.status, summary: s0.summary, specDeviations: s0.specDeviations, openPoints: s0.openPoints, deviations: s0.deviations, testsRun: s0.testsRun },
  s6a: s6a && { status: s6a.status, summary: s6a.summary, specDeviations: s6a.specDeviations, openPoints: s6a.openPoints, deviations: s6a.deviations },
  s0h: s0h && { status: s0h.status, summary: s0h.summary, specDeviations: s0h.specDeviations, openPoints: s0h.openPoints, deviations: s0h.deviations },
  findings,
  fix,
}
