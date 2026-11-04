export const meta = {
  name: 'fase3-dados-room-desenho',
  description: 'Phase 3 re-cut to data sync only, with a global Room database modeled on production TechnosAppDatabase: research (production storage, current Core Next storage, Room KMP spike), spec, 2-lens critique, revision. Read-only on the repos.',
  phases: [
    { title: 'Pesquisa', detail: 'armazenamento da produção ∥ armazenamento atual do Core Next ∥ spike do Room KMP no scratchpad' },
    { title: 'Especificação', detail: 'spec v2: sync de dados + Room global, fatias, desvios, checklist' },
    { title: 'Crítica', detail: 'paridade com a produção e com o Condor ∥ engenharia, plataformas e prazo' },
    { title: 'Revisão', detail: 'aplica a crítica' },
  ],
}

const SCR = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const SPEC1 = `${SCR}/fase3/spec.json`
const RESEARCH1 = `${SCR}/fase3/research.json`
const DEC = `${SCR}/fase3/decisoes-usuario.md`
const SPIKE = `${SCR}/fase3/room-spike`

const RULES = `
HARD RULES (every agent):
- READ-ONLY on ${R1} and ${R2}: do not edit, create or delete anything there and do not run Gradle/npm/pod in them (another workflow is building and editing them right now: phase 3 foundation S0/S6a/S0h; their uncommitted working-tree changes are part of the current state — read them, git diff is fine). Never run git add/commit/stash/reset/checkout/restore/clean.
- Read-only references: /Users/joao.farias/TechnosWareCore (production Core; the Condor pins tag v4.3.57 → read with git -C /Users/joao.farias/TechnosWareCore show v4.3.57:<path> and git ls-tree -r --name-only v4.3.57), /Users/joao.farias/GTE-CondorSmart/src (production app), /Users/joao.farias/GTE-Mormaii (do not modify).
- You may only write inside ${SCR}/fase3/ (the spike uses ${SPIKE}). Never publish anything to ~/.m2 with the group br.com.grupotechnos (use a scratch group like spike.room, or do not publish at all).
- Privacy: no MAC addresses, device/phone names or real health data in anything you write.
- Output in Brazilian Portuguese (identifiers in English). Cite sources as file:line (core@v4.3.57:<path>:<line>, condor:<path>:<line>, R1:<path>:<line>, R2:<path>:<line>).
`

const CONTEXT = `
CONTEXT: CRP port for the Condor Reebok (BLE name P85) into Repo 1 = ${R1} (KMP :protocol + :bridge; the session/sync logic and the JS contract live here, hosts are thin) and Repo 2 = ${R2} (TurboModule: Android Kotlin host, iOS Swift host, JS, example app). Phases 1 (pairing) and 2 (Dispositivo screen) are done. Deadline Thursday 2026-11-05.
- THE USER JUST RE-CUT THE SCOPE (binding, read in full): ${DEC}. Until the deadline: pairing, data sync (steps, sleep, heart rate, stress, SpO2 (empty on the P85, like production), watch-recorded workouts), the sync flow and the Dispositivo screen; then the Core swap in the Condor (phase 4). Everything else waits (app-started activity, GPS, map, notifications forwarding, watch faces, firmware update, Health Connect/HealthKit). And: data persistence becomes "um room database global, semelhante ao technos data storage de produção" — production = core@v4.3.57:android/src/main/java/com/reactlibrary/dataStorage/ (TechnosAppDatabase.java, DataStorage.java, DAOs/, models/entities/, Migrations.kt); production iOS uses its own SQLite repositories (ios/**/Repository*.m, e.g. HeartrateRepository.m).
- The previous (now superseded) phase 3 spec is ${SPEC1} with research ${RESEARCH1}: its protocol findings for heart rate (B6 02 written, 35 pages), stress (B9 11 03), SpO2 empty, watch workouts (B2 06 written, B2 00..05, index id, 0E fallback), the JS event shapes, the Condor expectations and DP-102..118 stay valid unless the new storage changes them; its app-started activity parts (S2b, S5, ActivityController, FGS of activity, B2 0D, 68) are OUT now (the S0 stubs stay so the Condor compiles).
- Current storage in Core Next: SampleStore (R1 protocol session/SampleStore.kt) implemented by the hosts as JSON files (R2 android .../store/FileSampleStore.kt, ios/CoreNext/store/FileSampleStore.swift), confirmation sets per DataKind, InMemorySampleStore in tests; S0 (uncommitted) just added measurement/workout methods to SampleStore and CoreHost load/savePreference.
`

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'string', description: 'Detailed findings with file:line sources' },
    recommendations: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'recommendations', 'risks', 'openQuestions'],
}

const SLICES = [
  { key: 'producao', prompt: `SLICE: PRODUCTION STORAGE (what "semelhante ao technos data storage de produção" means concretely).
Read core@v4.3.57 android dataStorage in full: TechnosAppDatabase (version, entities list, type converters, migrations), DataStorage.java (facade, init, cleanup policy and when it runs), and for each table the Condor/CRP flow touches — pedometer, sleep (+ items), heart rate, stress, oxygenation, activity history (+ extended data, HR zones, location only as context), calorie, logTable if used — the entity fields, unique keys/indexes, the DAO queries (history read, insert/upsert rules, getHistoryOfDay, mark consumed/deleted, cleanup), and the consumptionDate/deleted semantics. Then trace how the CRP service uses them (core@v4.3.57:android/src/main/java/com/crp/bluetooth/CRPService.java: saveInDb paths, getHistory* reads, deletedSavedData per category, daysBefore handling) and the shared mappers (TechnosGeneralMappers etc.). Do the same, at lighter depth, for the iOS side (ios/**: repositories, schema, DELETED/consumption, retention, HealthKit writes) so the spec can say what iOS production does. Also list the iDO-specific AppDatabase only to say it is separate (not global). Summarize: the minimal set of tables/columns/queries that reproduces production behavior for steps, sleep, HR, stress, SpO2, watch workouts; the production bugs that must NOT be copied (cross-check DP-102..118 in ${SPEC1}); whether production keeps data per device/MAC or globally (and what happens when the user switches watch).` },
  { key: 'atual', prompt: `SLICE: CURRENT CORE NEXT STORAGE AND WHERE A DATABASE PLUGS IN.
Read R1: session/SampleStore.kt, InMemorySampleStore, SyncEngine.kt, SessionEngine.kt (confirmUploaded, getStepsDays, getSleepSessions, the S0 additions getMeasurements/getWorkouts/storeWorkout), WatchSession.kt, domain/Models.kt (StepsSample, StepsDay, SleepSession, MeasurementSample, WorkoutRecord, DataKind), the SMA/iDO/CRP drivers' readSteps/readSleep paths, bridge/CoreBridge.kt (getHistoryPedometer/Sleep, deletedSavedData → SavedDataMapper, syncDataHistory), bridge SavedDataMapper, the tests that use InMemorySampleStore and the strict replays/golden that depend on store behavior. Read R2: android store/FileSampleStore.kt (+ codec, PairingPrefs), CoreGraph.kt, ios/CoreNext/store/FileSampleStore.swift, CoreGraph.swift, the tests over them, docs/arquitetura.md and docs/decisoes (R1) ADRs about storage (e.g. JSON files choice, confirmation sets, retention). Answer: (a) what the SampleStore contract is today (whole-list load/save) and why that does not scale to a DB; (b) the options for the DB boundary: (1) Room KMP in a NEW Repo 1 module (e.g. :storage) shared by Android and iOS, implementing a new row-oriented store contract consumed by the session; (2) Room only in the Repo 2 Android host implementing the store contract, iOS keeps JSON (or its own SQLite); (3) other. For each: files touched, contract changes in the session/bridge, effect on the strict replays, golden and on the ObjC header check (Room types must not leak into the public API), migration of the existing JSON data (users of the example app only), effort in hours; (c) what the phase 3 spec's HistoryStore/SampleStore/FileSampleStore work (S3, S7, S8) becomes under each option.` },
  { key: 'spike', prompt: `SLICE: ROOM KMP FEASIBILITY SPIKE (hands-on, in ${SPIKE} only).
Goal: prove or disprove that androidx.room (KMP) works with Repo 1's toolchain: Kotlin 2.1.20, AGP 8.7.2, Gradle wrapper version used by R1 (read R1 gradle/wrapper/gradle-wrapper.properties and gradle/libs.versions.toml; reuse the same versions), targets androidTarget(), jvm(), iosArm64(), iosSimulatorArm64(), static framework baseName like R1's XCFramework setup (read R1 bridge/build.gradle.kts and protocol/build.gradle.kts for the exact KMP/XCFramework config), BundledSQLiteDriver (androidx.sqlite:sqlite-bundled), KSP matching Kotlin 2.1.20.
Build a minimal standalone Gradle project in ${SPIKE} (copy R1's wrapper files into it; do not run Gradle inside R1): one module with a @Database (2 entities modeled on production: a heart-rate row with unique date + consumption/deleted columns, and a workout row), DAOs with insert-or-update, a query of unconsumed rows in a time window, a mark-consumed update and a cleanup delete; an internal database builder per platform (Android needs a Context; iOS a file path under NSDocumentDirectory or a passed path; JVM a temp file); a commonTest that runs on jvm and on iosSimulatorArm64 (insert, query, upsert, mark consumed, cleanup). Keep Room types internal and expose a small public facade; then assemble the XCFramework (debug is enough) and inspect the generated ObjC header for leaked Room/coroutines/Flow symbols. Record: exact versions that worked (room, sqlite, ksp), the Gradle snippets needed (plugins, ksp per target: kspAndroid, kspJvm, kspIosArm64, kspIosSimulatorArm64; room { schemaDirectory }), build times, XCFramework size before/after the bundled sqlite (compare with an empty module if quick), linker issues for a static framework (e.g. -lsqlite3 needed or not with the bundled driver), whether Room's suspend DAOs force coroutines into the API, and anything that would break consumption from an Android app with AGP 8.11 / RN 0.81 (Room runtime needs only the AAR + transitive deps; check the published module metadata if you publishToMavenLocal under group spike.room — never br.com.grupotechnos).
If network downloads fail or a version combination fails, try the nearest compatible versions and report precisely what failed (command + error). If Room KMP cannot be made to work in a reasonable time (~1 h of attempts), say so and evaluate quickly the fallback: Room only on Android (androidx.room in an Android library, Kotlin 2.1.20 + KSP) and SQLite on iOS.` },
]

phase('Pesquisa')
const research = await parallel(SLICES.map(s => () => agent(`${RULES}\n${CONTEXT}\n${s.prompt}`, { label: `pesquisa:${s.key}`, phase: 'Pesquisa', schema: RESEARCH_SCHEMA })))
const researchNamed = SLICES.map((s, i) => ({ slice: s.key, result: research[i] }))
log(`pesquisa: ${research.filter(Boolean).length}/${SLICES.length}`)

const SPEC = {
  type: 'object',
  properties: {
    cutLine: { type: 'string' },
    decisions: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, decision: { type: 'string' }, rationale: { type: 'string' } }, required: ['id', 'decision', 'rationale'] } },
    storage: { type: 'string', description: 'Database design: where it lives, schema (tables, columns, keys, indexes), DAOs/queries, consumption/confirmation semantics, retention/cleanup, migration from JSON, per-device vs global, threading, platform builders' },
    commands: { type: 'array', items: { type: 'object', properties: { symbol: { type: 'string' }, frames: { type: 'string' }, response: { type: 'string' }, vector: { type: 'string' }, source: { type: 'string' } }, required: ['symbol', 'frames', 'response', 'vector', 'source'] } },
    api: { type: 'string' },
    platform: { type: 'string' },
    deviations: { type: 'array', items: { type: 'string' } },
    tests: { type: 'string' },
    docs: { type: 'string' },
    workSlices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, repo: { type: 'string' }, scope: { type: 'string' }, files: { type: 'string' }, dependsOn: { type: 'string' }, estimate: { type: 'string' } }, required: ['id', 'repo', 'scope', 'files', 'dependsOn', 'estimate'] } },
    validationChecklist: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    userQuestions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' }, why: { type: 'string' } }, required: ['question', 'options', 'recommendation', 'why'] } },
  },
  required: ['cutLine', 'decisions', 'storage', 'commands', 'api', 'platform', 'deviations', 'tests', 'docs', 'workSlices', 'validationChecklist', 'risks', 'userQuestions'],
}


const ADDENDUM = `
ADDENDUM (2026-11-03 09:10, binding for the spec, the critiques and the revision):
- PRODUCTION BASELINE MOVED: the Condor (GTE-CondorSmart release/2.5.0, package.json:105) pins TechnosWareCore v4.4.5 since commit 7845bd7 (2026-11-03 00:55), no longer v4.3.57. From now on cite core@v4.4.5. In the scope of this spec the differences are small (git -C /Users/joao.farias/TechnosWareCore diff v4.3.57 v4.4.5): TechnosAppDatabase version 41 with a UNIQUE index on ActivityHistoryData.dateId and MIGRATION_40_41 that deletes duplicates keeping the oldest per dateId (relevant to the workouts table); iOS CRPActivityHelper.calculateAverageBpm got the empty guard (DP-118 iOS text must drop the divide by zero); new JS methods startPairingAttempt/cancelPairing that the Condor does not call. Files that did not change keep the same line numbers.
- THE PHASE 3 FOUNDATION IS DONE, GREEN AND UNCOMMITTED (report: ${SCR}/fase3/base-result.json): S0 in Repo 1 (domain types, DataKind HEART_RATE/STRESS/WORKOUTS, SampleStore + InMemory with measurement/workout methods, WatchSession getMeasurements/getWorkouts/storeWorkout/fetchLastWorkout as stubs, SyncEngine already calling readMeasurements/readWorkouts non-fatally and only logging, CrpHealthReader/CrpWorkoutReader/CrpActivityControl empty groups wired in CrpDriver, CoreHost +5, CoreBridge +9 stubs, published to mavenLocal 0.1.0 + XCFramework); S6a in Repo 2 (JS contract: 9 methods, 10 events, enums, types, mock); S0h (both hosts: stub store/host methods, 9 methods, 10 events) and the four components as stubs (TechnosNativeChronometer/Map/MapStyles/ActionTimer). All gates green (Repo 1 check dokkaHtml; Repo 2 Android tests, assembleDebug, Jest, typechecks, ESLint, iOS host tests, example Debug and Release builds). Build on it; do not redo it. No other workflow edits the repos now.
- SPIKE RESULT: Room KMP works with Repo 1's toolchain: room 2.7.2 (runtime, compiler, gradle plugin), androidx.sqlite:sqlite-bundled 2.5.2, KSP 2.1.20-2.0.1; Room 2.8.x/sqlite 2.6.x are blocked by the iOS klib ABI until Kotlin 2.2. Use the spike's evidence and recommendations (research slice 'spike'; files under ${SPIKE}).
- The user asked for a database "semelhante ao technos data storage de produção": tables per data type in one app-wide database common to all families, cleared on forget like eraseDatabase. Where you choose semantics that differ from production (e.g. a confirmed-key table instead of a per-row deleted flag, retention, cleanup timing, file name), say why and make each difference a DP; production BUGS are never copied. Put in userQuestions only real product decisions (e.g. unsent data lost on forget/logout like production, what to do with the legacy technosdatastorage.db after the Core swap, embedded vs system SQLite if size matters); decide engineering details yourself.
- TIME: it is Tuesday 2026-11-03 09:10. The implementation (Repo 1 + Repo 2 Android + iOS + example + docs + gates) must finish today with parallel agents (target about 6-8 h of wall clock), so the user validates on Android late today/Wednesday morning and phase 4 (Core swap in the Condor) runs Wednesday-Thursday. Order the slices so a usable, validated subset exists early (e.g. Room store + HR/stress first, workouts next) and say what gets cut first if time runs out.
`

phase('Especificação')
const draft = await agent(`${RULES}\n${CONTEXT}\n${ADDENDUM}\nRESEARCH (this round): ${JSON.stringify(researchNamed)}\nTASK: write the phase 3 SPEC v2 for the user's new scope (${DEC}): data sync of steps, sleep, heart rate, stress, SpO2 (empty), watch workouts, over a GLOBAL ROOM DATABASE modeled on production TechnosAppDatabase/DataStorage, for SMA, iDO and CRP alike, on Android and iOS; the app-started activity stays as the S0 stub.
Reuse from ${SPEC1} everything still valid (protocol readers S1/S2a with their commands, vectors and goldens; bridge mappers of S4; JS shapes; DP-102..118 adjusted to the new storage; validation items for HR/stress/workouts) and drop the activity parts (S2b, S5, activity FGS, activity tab) — say explicitly what of S0/S0h/S6a stays as stub for the Condor (activity methods/events/enums/components) and which DPs record that (e.g. one DP: app-started activity not supported until later, with the production source).
Choose the DB boundary with the research and the spike evidence (prefer one shared implementation in Repo 1 if the Room KMP spike is green; otherwise state the fallback). Design the schema close to production tables but without its bugs, keep Room/SQL types out of the public Kotlin API (ObjC header check), keep the strict real-fixture replays and the CoreBridge golden meaningful (InMemory store for tests or an in-memory Room DB), define consumption/confirmation (deletedSavedData per category) and retention, per-device vs global behavior when the user switches watch, threading (the session thread; Room suspend calls off the BLE path), host builders (Android Context, iOS path), migration/discard of the existing JSON files, and how the example app shows it (Data tab: steps, sleep, HR, stress, SpO2, workouts, confirm buttons).
workSlices with estimates must make the whole thing (Repo 1 + Repo 2 Android + iOS + example + docs + gates) fit in about one working day of wall clock with parallel agents, leaving Wednesday/Thursday for user validation and phase 4. userQuestions only for real product decisions (with recommendation).`, { label: 'arquiteto', phase: 'Especificação', schema: SPEC })

phase('Crítica')
const CRIT_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['alta', 'media', 'baixa'] }, where: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'where', 'issue', 'evidence', 'fix'] } },
    summary: { type: 'string' },
  },
  required: ['issues', 'summary'],
}
const LENSES = [
  { key: 'paridade', prompt: `LENS: PARITY WITH PRODUCTION AND THE CONDOR. Check the spec's schema, queries, consumption/deleted semantics, retention, daysBefore handling, event shapes and deletedSavedData categories against core@v4.3.57 (dataStorage + CRPService + SMA/iDO services where relevant + iOS repositories) and against what the Condor does with each history (condor:store/MainStoreContext/** history stores, services/History/**, services/Api/Mappers/**, constants/Sync.ts timeouts). Every behavior that differs from production must be a DP entry (user rule). Flag copied production bugs, missing tables/fields the Condor reads, wrong shapes, and data that would be re-sent or lost.` },
  { key: 'engenharia', prompt: `LENS: ENGINEERING, PLATFORMS AND DEADLINE. Check the DB boundary against the spike evidence (versions, KSP per target, static XCFramework, ObjC header, AGP 8.11 consumer), the threading model (session thread, suspend DAOs, no blocking of the BLE path), testability (strict replays, golden, iOS host tests, in-memory DB), migration from JSON, merge conflicts between parallel slices, the gates, and whether the slices really fit ~1 day of wall clock. Propose concrete cuts or reorderings if not.` },
]
const critiques = await parallel(LENSES.map(l => () => agent(`${RULES}\n${CONTEXT}\n${ADDENDUM}\nRESEARCH: ${JSON.stringify(researchNamed)}\nDRAFT SPEC: ${JSON.stringify(draft)}\n${l.prompt}\nRead the sources yourself; report only evidenced issues with a concrete fix.`, { label: `crítica:${l.key}`, phase: 'Crítica', schema: CRIT_SCHEMA })))

phase('Revisão')
const final = await agent(`${RULES}\n${CONTEXT}\n${ADDENDUM}\nRESEARCH: ${JSON.stringify(researchNamed)}\nDRAFT SPEC: ${JSON.stringify(draft)}\nCRITIQUES: ${JSON.stringify(critiques)}\nTASK: produce the final SPEC v2. Verify each critique issue against the sources; apply the real ones, reject the others with evidence. Keep the full structure; the spec must be self-sufficient for implementation agents (they will read only this spec, ${SPEC1} for protocol details it references, and the code).`, {
  label: 'revisão', phase: 'Revisão',
  schema: { type: 'object', properties: { spec: SPEC, changed: { type: 'array', items: { type: 'string' } }, rejected: { type: 'array', items: { type: 'string' } } }, required: ['spec', 'changed', 'rejected'] },
})

return { research: researchNamed, draft, critiques, final }
