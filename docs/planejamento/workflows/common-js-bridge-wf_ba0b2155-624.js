export const meta = {
  name: 'common-js-bridge',
  description: 'Move the JS-contract layer (event shapes, state codes, error codes, deletedSavedData, request/pending-event bookkeeping and the listener/method orchestration) from the Android host into a new common Kotlin module :bridge in Repo 1, make Android a thin adapter with identical JS-observable behaviour, add the HistoryStore logger try/catch; then adversarial review and fixes',
  phases: [
    { title: 'Module', detail: 'new :bridge module, umbrella iOS framework, ported mappers with differential tests, HistoryStore try/catch' },
    { title: 'Controller', detail: 'CoreBridge orchestration + CoreHost interface + contract tests in Repo 1' },
    { title: 'Android', detail: 'Repo 2 Android becomes a thin adapter over CoreBridge' },
    { title: 'Review', detail: 'behaviour-equivalence reviewer and build/iOS/docs reviewer, each in its own copies' },
    { title: 'Fix', detail: 'verify and fix confirmed findings, rerun all gates' },
  ],
}

const S = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const OLD = `${S}/snap-before-bridge`

const CTX = `
CONTEXT (shared by every agent in this workflow)
- Two PoC repos replace the vendor watch SDKs. Repo 1 ${R1}: Kotlin Multiplatform module :protocol (domain, transport, profile, session/WatchSession, SMA codec/driver, log; targets androidTarget, jvm, iosArm64, iosSimulatorArm64; iosMain package "ios" with the NSData bridge; static framework/XCFramework "TechnosWatchProtocol", ObjC prefix TWP; tasks checkObjcHeader and checkSwiftInterop (protocol/swift-interop/MinimalHost.swift) wired into check). Repo 2 ${R2}: React Native TurboModule host (spec src/specs/NativeCoreNext.ts, event types src/types/events.ts, Android code under android/src/main/java/br/com/grupotechnos/corenext/, example app in example/; iOS not implemented yet: only podspec + docs, podspec vendors ios/Frameworks/TechnosWatchProtocol.xcframework). Read ${R1}/CLAUDE.md and ${R2}/CLAUDE.md first and follow them.
- Language rule in these repos: docs, READMEs, KDoc and code comments in Portuguese; identifiers, log messages, error codes in English. Multi-line KDoc welcome. Tabs. Every package folder has a README.md (purpose, what it does not do, main types, dependencies, invariants, tests). explicitApi + Portuguese KDoc on all public API of Repo 1 (Dokka failOnWarning + reportUndocumented).
- Hard rules: NO git writes (no add/commit/stash/checkout/reset/restore/init); read-only git is fine. The working trees contain UNCOMMITTED work from the previous round (iOS steps 1-2: protocol/src/iosMain, iosTest, jvmSharedTest, swift-interop, moved commonTest files, etc.) — never revert or discard it. Do not touch /Users/joao.farias/GTE-Mormaii or TechnosWareCore (reading GTE-Mormaii for the JS contract is fine). Never copy corenext-export/logs-*.jsonl and never write the watch MAC (it is in ${R2}/corenext-export/logs-*.jsonl) into any file. Scratch only under ${S}/bridge/.
- Pre-change snapshot of both repos (no build dirs): ${OLD}/{technos-watch-protocol,react-native-technos-core-next}. The OLD Android behaviour is the reference.
- Current green baseline: Repo 1 jvmTest 200, testDebugUnitTest 192, testReleaseUnitTest 192, iosSimulatorArm64Test 202; checkObjcHeader, checkSwiftInterop, lint, dokkaHtml, publishToMavenLocal, assembleTechnosWatchProtocolXCFramework all OK; REPLAY and REALTIME-REPLAY lines for the real recording fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl on all 4 targets. Repo 2: 55 Android unit tests + lintDebug + assembleDebug via example/android (ANDROID_HOME=~/Library/Android/sdk ./gradlew --refresh-dependencies :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug); JS: cd example && npx tsc --noEmit && npm test (42 tests), and npm run typecheck at the repo root. Repo 2 android/build.gradle depends on "br.com.grupotechnos.watch:protocol:0.1.0" from mavenLocal.
- What exists today in the Android host (OLD reference, read the files): bridge/EventMapper.kt (domain -> Map<String, Any?> in the JS shapes; java.time ISO dates with pattern yyyy-MM-dd'T'HH:mm:ssXXX, so zero offset prints Z), bridge/StateMapper.kt, bridge/SavedDataMapper.kt (deletedSavedData category -> DataKind, registered_at -> local dayKey, legacy -0300 offsets, LocalDateTime, LocalDate), bridge/HostErrorCodes.kt, bridge/PendingEvents.kt (queue until the module can emit), bridge/RequestRegistry.kt (requestId -> promise token + JS method name), bridge/WritableConverter.kt (Map/List -> WritableMap, RN-only), CoreSessionListener.kt (WatchSessionListener -> events + promise settlement + Android effects: save pairing on READY unless userDisconnected, start/stop SyncForegroundService, recorder firmware/deviceName, clear pairing after forget, spontaneous device info emits both onDeviceInfo and onFirmwareInfo, every command failure also emits onError with the JS method name, event emitted BEFORE resolve), NativeCoreNextModule.kt (each JS method: permission/Bluetooth/address checks with early reject + onError, request registration, getHistorySleep NO_DATA rule, getHistoryPedometer, deletedSavedData ReadableArray parsing, getLogs/exportLogs/clearLogs/setLogLevel, lifecycle invalidate drains requests with CANCELLED, onHostResume flushes events and reconnects), CoreGraph.kt (assembly, userDisconnected flag, emitCurrentState, emitError, resolveProfile(name), sleepHistoryDays(), reconnectIfPaired(reason), Bluetooth-on reconnect, reportBluetoothOffAtStartup), plus tests in android/src/test/.../bridge/*Test.kt.
- ARCHITECTURE DECISIONS (already made; do not reopen):
  1. New Gradle module :bridge in Repo 1, package br.com.grupotechnos.watch.bridge, artifact br.com.grupotechnos.watch:bridge:0.1.0 (publishToMavenLocal), same KMP targets/toolchain/explicitApi/Dokka rules as :protocol, depending on :protocol with api(project(":protocol")). :protocol must not depend on :bridge (it can't see it). :bridge has no React Native dependency: it encodes the Technos Core JS contract as plain Kotlin values.
  2. The iOS framework/XCFramework consumed by the RN pod is produced by :bridge with export(project(":protocol")), keeping baseName "TechnosWatchProtocol" (so prefix TWP and the Swift names stay). The framework/XCFramework definition and the checkObjcHeader + checkSwiftInterop tasks move from :protocol to :bridge (they must check the umbrella header). :protocol keeps its iOS targets (klibs + iOS tests). Keep the Gradle task name assembleTechnosWatchProtocolXCFramework working (now on :bridge) and update every doc/command that pointed at protocol/build/... for the framework. Only if the umbrella export is technically impossible, fall back to a package inside :protocol and document why.
  3. Payloads stay Map<String, Any?> / List<Any?> with exactly today's value types (Int for integers, Double for decimals and epoch millis, String, Boolean, null, nested Map/List), so the Android WritableConverter stays unchanged. For iOS, :bridge iosMain provides a converter to Foundation objects (NSDictionary/NSArray/NSString/NSNumber/NSNull) where booleans become real CFBoolean (NSNumber numberWithBool) so React Native sends true/false, not 1/0; test it on the simulator (CFGetTypeID == CFBooleanGetTypeID for booleans, numbers keep their values, null -> NSNull, nesting).
  4. Orchestration moves to common: a controller (name it CoreBridge) implementing every JS method of the spec and the WatchSessionListener side, with the platform behind an interface (name it CoreHost) for: emitting an event by name (the bridge owns PendingEvents and decides when to flush), permission/Bluetooth/address checks (address validity differs: MAC on Android, UUID on iOS), scan start/stop, sync background work start/stop (FGS on Android), pairing storage load/save/clear, recorder device info (firmware, bleName), log entries/export/clear/level, current time zone if needed. A small completion interface (e.g. CoreCompletion with resolve(value: Any?) and reject(code, message)) replaces the RN Promise. The JS-observable behaviour must be IDENTICAL to the OLD Android host: same event names, same payloads, same order (event before resolve), same rejections (code and message), same NO_DATA rule, same pairing save/clear rules, same deletedSavedData semantics, same isConnected/getLastPairedDevice/getLogs results, same reconnect-if-paired decisions, same lifecycle (invalidate drains with CANCELLED; host resume flushes and reconnects). Log tags may change (e.g. CoreBridge/...) but keep the messages.
  5. Platform code that stays in Repo 2 Android: ble/, store/, log/ (RingLogger, FrameRecorder), BlePermissions, SyncForegroundService, WritableConverter, the TurboModule class itself (each override becomes a one-line call into CoreBridge with a Promise-backed completion, plus the emit when-switch and ReadableArray -> List conversion), CoreGraph as assembly + the CoreHost implementation. The spec, the TS types and the JS side do not change.
- Requested small fix (user approved): HistoryStore (Repo 1 :protocol session/HistoryStore.kt) calls logger.log directly without the try/catch that SessionEngine.log uses, so a throwing host logger escapes from getStepsDays/getSleepSessions/confirmUploaded and from mergeSteps/prune/store load. Wrap those log calls the same way SessionEngine does (swallow logger exceptions), with a test that fails without the fix (mutation check), and fix the docs that now say only the listener exception is swallowed (WatchLogger KDoc, log/README, arquitetura §4, ADR 19, Repo 2 ios-pendente if it repeats it).
- Gates (end of each agent's work, as relevant): Repo 1 ./gradlew check --rerun-tasks (both modules: tests on 4 targets, lint, checkObjcHeader, checkSwiftInterop), ./gradlew dokkaHtml (both modules, no undocumented warnings), ./gradlew publishToMavenLocal assembleTechnosWatchProtocolXCFramework; Repo 2 example/android build (command above) and JS checks; link/anchor checkers if present (python3 -I ${S}/tools/linkcheck.py ${R1} ${R2}; python3 -I ${S}/item1/integrate/anchorcheck.py ${R1} ${R2}); MAC scan of both repos excluding corenext-export, build, node_modules, .git. Count tests per task from the XML results. Every behavioural change or port gets a mutation check (break it -> a test fails; restore; diff -q).
`

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    publicApi: { type: 'array', items: { type: 'string' }, description: 'new or changed public declarations (Kotlin signature + Swift/ObjC spelling when relevant)' },
    verification: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, outcome: { type: 'string' } }, required: ['command', 'outcome'] } },
    openIssues: { type: 'array', items: { type: 'string' } },
    deviations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'filesChanged', 'publicApi', 'verification', 'openIssues', 'deviations'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          file: { type: 'string' },
          line: { type: 'number' },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['id', 'severity', 'file', 'problem', 'evidence', 'fix'],
      },
    },
    checkedAndFine: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'checkedAndFine'],
}

const brief = r => JSON.stringify(r ? { summary: r.summary, filesChanged: r.filesChanged, publicApi: r.publicApi, openIssues: r.openIssues, deviations: r.deviations } : null)

phase('Module')
const modA = await agent(`${CTX}
YOUR TASK (stage 1 of 3; scratch ${S}/bridge/module/): create the :bridge module and port the pure mapping layer. Do NOT write the CoreBridge controller yet and do NOT change Repo 2 code (a later stage does both).
1. Gradle: settings include, bridge/build.gradle.kts mirroring :protocol (targets, explicitApi, jvmToolchain 17, Android namespace br.com.grupotechnos.watch.bridge, Dokka with failOnWarning/reportUndocumented and a Module.md, maven-publish with the same group/version), api(project(":protocol")), kotlinx-datetime for dates. Make the root tasks check/dokkaHtml/publishToMavenLocal cover both modules. Move the framework + XCFramework + checkObjcHeader + checkSwiftInterop from :protocol to :bridge per decision 2 (export(project(":protocol")), baseName TechnosWatchProtocol, fixtures/inputs logic for :protocol tests unchanged). Verify the umbrella header contains both the protocol API (e.g. TWPWatchSession, the ios bridge category methods) and the bridge API, that checkObjcHeader still passes on it, and that MinimalHost.swift still typechecks against the umbrella. Make sure no second copy of :protocol ends up in the umbrella (one TWPWatchSession class).
2. Port to bridge commonMain, keeping names and semantics: EventMapper, StateMapper, SavedDataMapper, HostErrorCodes, PendingEvents, RequestRegistry (thread-safe in common without heavy new deps: kotlinx-atomicfu locks via coroutines' transitive dep, Kotlin 2.1.20 kotlin.concurrent.atomics (experimental), or a tiny expect/actual lock — your call, justify it). Dates with kotlinx-datetime must reproduce java.time exactly: startOfDayIso prints Z for zero offset and handles days whose midnight does not exist (DST gap) like LocalDate.atStartOfDay(zone); SavedDataMapper accepts the same inputs in the same order (ISO with offset or Z with optional fraction, legacy offset without colon, local date-time, date only) and rejects the same ones. Use the system time zone through kotlinx TimeZone.currentSystemDefault() where the old code used ZoneId.systemDefault(), but keep zone injectable for tests.
3. Tests in bridge commonTest (run on JVM, Android unit, iOS simulator): port EventMapperTest, StateMapperTest, SavedDataMapperTest, PendingEventsTest, RequestRegistryTest from ${OLD}/react-native-technos-core-next/android/src/test/... with the same assertions. PLUS a differential test in bridge jvmTest that copies the OLD java.time implementations of startOfDayIso and SavedDataMapper.dayKey as an oracle and compares them with the new common code over many inputs: every day of several years across zones with DST history (America/Sao_Paulo incl. 2018-2019 when midnight was skipped, America/Manaus, America/Noronha, Europe/Lisbon, UTC, Asia/Kolkata, Pacific/Chatham, America/St_Johns), and a generated corpus of registered_at strings (offsets with/without colon, Z, fractions, no offset, date only, garbage, whitespace). Report counts compared and 0 mismatches.
4. bridge iosMain: the Foundation converter of decision 3 with iosTest coverage (CFBoolean check via CFGetTypeID, Int/Double/Long values, String, null -> NSNull, nested Map/List, empty containers). Give it a good Swift/ObjC spelling and list it in publicApi.
5. The HistoryStore logger try/catch fix in :protocol with test + mutation check and the doc corrections listed in CONTEXT.
6. Docs (Portuguese): bridge/ README per package, Repo 1 README/CLAUDE.md (module list, commands, where the XCFramework now comes from, dependency rule protocol -> bridge forbidden), docs/arquitetura.md (new layer: contract JS comum; diagram/table of modules), docs/decisoes.md new ADR 20 (module :bridge, umbrella framework, payload types, how to revert), glossario if needed. Update Repo 2 docs that cite the XCFramework path (podspec comment/ios README/ios-pendente/CLAUDE.md) — docs only in Repo 2 in this stage.
7. Gates: Repo 1 check --rerun-tasks, dokkaHtml, publishToMavenLocal + assembleTechnosWatchProtocolXCFramework (report where the XCFramework lands), and confirm Repo 2 still builds unchanged against mavenLocal (example/android command) since :protocol is still published.
Return the structured result.`, { label: 'module+mappers', phase: 'Module', schema: RESULT_SCHEMA })

phase('Controller')
const ctl = await agent(`${CTX}
Stage 1 is done (report, treat as claims to double-check where you depend on them): ${brief(modA)}

YOUR TASK (stage 2 of 3; scratch ${S}/bridge/controller/): write the common controller in Repo 1 :bridge. Do NOT change Repo 2 code yet (stage 3 does it).
1. Read the OLD Android host carefully: ${OLD}/react-native-technos-core-next/android/src/main/java/br/com/grupotechnos/corenext/{NativeCoreNextModule.kt,CoreSessionListener.kt,CoreGraph.kt} and bridge/. Write a method-by-method behaviour inventory first (scratch file ${S}/bridge/controller/inventory.md): for each JS method and each listener callback, the checks, events (name + payload builder), order, completion (resolve value / reject code+message), side effects (pairing, FGS, recorder, userDisconnected, reconnect), logging, threading assumptions.
2. Implement CoreBridge + CoreHost + CoreCompletion (decision 4) in bridge commonMain so the inventory is reproduced exactly. CoreBridge owns: the WatchSession listener, RequestRegistry, PendingEvents, userDisconnected, activeSyncRequestId, resolveProfile(name), reconnect-if-paired, emitCurrentState, emitError, the NO_DATA rule, deletedSavedData from a generic List<Any?> (strings or maps with registered_at and optional numeric category, like readSavedItem/readSavedMap) plus a category number, getLogs mapping (host supplies entries in a neutral form), lifecycle hooks (invalidate, host resume, Bluetooth turned on, startup state). Decide how CoreBridge gets the WatchSession (constructed by the host and passed in, or built inside from Transport/WatchLogger/SampleStore — pick what keeps the host thinnest and is testable; justify). Thread-safety as in the OLD code (JS methods on the native-modules thread, listener on the session's logical thread). No React Native types; ObjC/Swift-friendly public API (no suspend/Flow/kotlinx types/value classes; checkObjcHeader must pass). Portuguese KDoc on everything public.
3. Contract tests in bridge commonTest (4 targets), using a FakeCoreHost recording every call in order and a real WatchSession over the :protocol test kit. :protocol's commonTest helpers (FakeTransport, SessionHarness, ReplayScenario, SmaWatchSimulator...) are not visible from another module's tests; choose the cleanest way to reuse them (e.g. a shared test source dir added to both modules' commonTest, or a testFixtures-like source set) without publishing test code, and document it. Cover every inventory row: success and failure of each command, early rejections (permission, Bluetooth off, invalid address, unsupported name), event-before-resolve order, spontaneous vs requested device info, sync FGS start/stop calls including error and disconnect paths, pairing save on READY unless userDisconnected, forget clearing twice, startPairingAttempt resolving immediately with no registered promise, invalidate draining with CANCELLED, PendingEvents buffering until the host can emit and flushing on resume, deletedSavedData parsing (strings, maps, unknown categories, unreadable dates), getHistorySleep NO_DATA (event + reject), getHistoryPedometer, isConnected, getLastPairedDevice, getLogs, setLogLevel invalid level. PLUS an event-stream golden test: drive the real recording (pair, commands, Bluetooth cycle, sync) through CoreBridge in virtual time and compare the emitted JS events (names + payloads, in order) with a golden file you generate once and review by hand against the OLD mapping rules (commit the golden under bridge test resources or a Kotlin constant; explain how to regenerate). Mutation-check a sample of rules (at least: event-before-resolve order, NO_DATA, pairing save guard, forget clear, CANCELLED drain): each mutation must fail a test; restore and diff -q.
4. Swift/ObjC interop: extend the interop guard so the umbrella API used by the future iOS host compiles: MinimalHost.swift implements CoreHost and CoreCompletion in Swift and calls every CoreBridge method; add an Objective-C++ typecheck (xcrun --sdk iphonesimulator clang++ -fsyntax-only -fobjc-arc -fmodules -std=c++20 -target arm64-apple-ios15.1-simulator -F <framework dir>) of a minimal .mm that calls CoreBridge methods the way the TurboModule shim will (resolve/reject blocks wrapped in a CoreCompletion implementation) — wire it into check (same task or a new one), with inputs, and mutation-check it.
5. Docs (Portuguese): bridge package README(s), docs/arquitetura.md (what the host still does vs what CoreBridge does; a table of CoreHost methods per platform: Android implementation today, iOS planned), ADR 20 amendment or ADR 21 for the controller, docs/pendencias.md (iOS section: the shim now calls CoreBridge; remaining host pieces). Repo 2 docs can wait for stage 3.
6. Gates: Repo 1 check --rerun-tasks, dokkaHtml, publishToMavenLocal + assembleTechnosWatchProtocolXCFramework.
Return the structured result; in publicApi list every public declaration of CoreBridge/CoreHost/CoreCompletion with Kotlin signature and Swift spelling.`, { label: 'controller', phase: 'Controller', schema: RESULT_SCHEMA })

phase('Android')
const andr = await agent(`${CTX}
Stages 1 and 2 are done in Repo 1 (reports, treat as claims to double-check where you depend on them):
STAGE 1: ${brief(modA)}
STAGE 2: ${brief(ctl)}
The method-by-method inventory of the OLD Android behaviour is at ${S}/bridge/controller/inventory.md (verify it against the OLD code as you go).

YOUR TASK (stage 3 of 3; scratch ${S}/bridge/android/): make the Repo 2 Android host a thin adapter over CoreBridge with IDENTICAL JS-observable behaviour (decision 5).
1. ./gradlew publishToMavenLocal in Repo 1 first. Repo 2 android/build.gradle depends on br.com.grupotechnos.watch:bridge:0.1.0 (which brings protocol via api); update the comment.
2. CoreGraph: assembles WatchSession, AndroidGattTransport, RingLogger, FileSampleStore, PairingPrefs, BleScanner, FrameRecorder, the CoreHost implementation (permissions via BlePermissions, Bluetooth enabled, BluetoothAdapter.checkBluetoothAddress, scanner, SyncForegroundService start/stop, PairingPrefs, recorder firmware/deviceName, RingLogger entries/clear/level, exportLogs) and CoreBridge. BluetoothStateReceiver / reportBluetoothOffAtStartup keep their transport role; the reconnect-on-Bluetooth-on decision goes through CoreBridge. NativeCoreNextModule: every override is a one-line delegation (Promise -> CoreCompletion adapter that converts Map/List results with WritableConverter; ReadableArray -> List<Any?> for deletedSavedData; Double args -> Int as before), the emit(name, payload) when-switch over the codegen emitters stays, lifecycle hooks delegate. Remove the Android files whose logic moved (EventMapper, StateMapper, SavedDataMapper, HostErrorCodes, PendingEvents, RequestRegistry, CoreSessionListener) and their tests (those tests now live in :bridge) — list exactly what was removed and where each test went. Keep WritableConverter and give it a JVM-free test only if one existed.
3. Equivalence evidence: (a) all remaining Repo 2 Android tests pass; (b) a JVM test in Repo 2 (android/src/test) that runs the CoreHost implementation pieces that are pure (or a fake Android context-free subset) if practical; (c) a written old-vs-new mapping table in ${S}/bridge/android/equivalence.md: every OLD method/callback line -> where it lives now, with any difference; (d) a dex scan of app-debug.apk showing the bridge classes are in and the removed classes are gone; (e) the example app's JS tests still pass. If you find any behaviour difference that the inventory or CoreBridge got wrong, fix it in Repo 1 :bridge (with a test), republish, and record it.
4. Docs (Portuguese) in Repo 2: CLAUDE.md, README.md, docs/arquitetura.md (thin host; what lives where), docs/api-js.md (unchanged contract, mention the implementation moved), docs/transporte-android.md if it references moved classes, docs/ios-pendente.md (the shim calls CoreBridge; the Swift side implements CoreHost and the transport; payload conversion via the iosMain converter), docs/pendencias.md, package READMEs under android/.../corenext (bridge/ README now only WritableConverter, or fold it), example/README.md if log tags changed. Repo 1 docs that mention Repo 2 file names.
5. Gates: Repo 1 check --rerun-tasks + dokkaHtml + publishToMavenLocal + assembleTechnosWatchProtocolXCFramework; Repo 2 example/android --refresh-dependencies testDebugUnitTest + lintDebug + assembleDebug; JS tsc + jest + root typecheck; link/anchor checks; MAC scan.
Return the structured result.`, { label: 'android-adapter', phase: 'Android', schema: RESULT_SCHEMA })

phase('Review')
const allBrief = `STAGE 1: ${brief(modA)}\nSTAGE 2: ${brief(ctl)}\nSTAGE 3: ${brief(andr)}`
const REVIEW_COMMON = `${CTX}
Three implementers just did this change. Their reports (claims to verify, not facts):
${allBrief}

You are an adversarial reviewer. Default to skepticism. Rules: do NOT edit ${R1} or ${R2}. For experiments, make your own copies (rsync -a --exclude build --exclude .gradle --exclude .kotlin --exclude node_modules <repo>/ <your scratch>/<repo>/) and run Gradle only there; another reviewer runs at the same time. If you need Repo 2 in a copy to consume your Repo 1 copy, publish from the copy to a separate maven repo dir or use mavenLocal carefully (prefer -Dmaven.repo.local=<your scratch>/m2 for both builds in your copies). Diff against ${OLD}. Report only real problems with concrete evidence (file:line, command output, failing mutation or scenario). Put everything you checked that held up in checkedAndFine.`

const reviews = await parallel([
  () => agent(`${REVIEW_COMMON}
Scratch: ${S}/bridge/review-equiv/.
YOUR LENS: JS-observable behaviour equivalence between the OLD Android host (${OLD}/react-native-technos-core-next/android/...) and the NEW CoreBridge + Android adapter.
- Go method by method and callback by callback through the OLD NativeCoreNextModule, CoreSessionListener and CoreGraph; for each, find the NEW code path and compare: checks and their order, error codes and messages, events (names, payload keys, value types Int/Double/String/Boolean/null), event-before-resolve ordering, which promise gets settled and with what, side effects (pairing save/clear, userDisconnected, FGS start/stop, recorder, reconnect decisions), lifecycle (invalidate, host resume, Bluetooth on, startup), thread-safety (JS thread vs session thread; races the old code handled, e.g. READY between forgetDevice and the session processing the disconnect).
- Check the ported date logic (startOfDayIso, SavedDataMapper) against java.time yourself with an independent corpus (not the implementer's), incl. DST-gap days and odd inputs.
- Check the event-stream golden really reflects the OLD rules (spot-check payloads by hand) and that the contract tests would fail on realistic regressions: run at least 4 mutations of your own in your copy.
- Check nothing JS-visible changed in Repo 2 (spec, TS types, example app) and that the removed Android tests' assertions all survive somewhere.`, { label: 'review:equivalence', phase: 'Review', schema: REVIEW_SCHEMA }),
  () => agent(`${REVIEW_COMMON}
Scratch: ${S}/bridge/review-build/.
YOUR LENS: build structure, iOS umbrella, interop and docs.
- Gradle: :protocol does not depend on :bridge; :bridge api(:protocol); root tasks cover both modules; publishToMavenLocal publishes both with correct POM dependencies (Repo 2 resolves protocol transitively); fixture inputs/env for :protocol tests unchanged (REPLAY and REALTIME-REPLAY lines still on 4 targets); test sharing between modules does not publish test code.
- iOS umbrella: one framework exports both modules, no duplicated protocol classes, header passes checkObjcHeader, Swift MinimalHost and the ObjC++ snippet typecheck, the interop tasks rerun on header/source changes and fail on breakage (mutations in your copy). The Foundation converter really produces CFBoolean for booleans (run its tests, add a probe), NSNull for null, correct numbers.
- Thread-safety primitives chosen for RequestRegistry/PendingEvents work on K/N and JVM (look for data races; run the tests several times on iOS).
- HistoryStore try/catch fix: correct, tested (mutation), docs consistent.
- Docs in both repos match the code: module names, artifact coordinates, commands, XCFramework path, ADR 20/21 numbering, CoreHost table, ios-pendente, pendencias, package READMEs, Portuguese, tabs. Run link/anchor checkers. No MAC, no logs-*.jsonl.`, { label: 'review:build-ios-docs', phase: 'Review', schema: REVIEW_SCHEMA }),
])

const findings = reviews.filter(Boolean).flatMap(r => r.findings || [])
log(`review: ${findings.length} finding(s)`)

let fixes = null
if (findings.length > 0) {
  phase('Fix')
  fixes = await agent(`${CTX}
The change was implemented in three stages:
${allBrief}
Two adversarial reviewers produced these findings:
${JSON.stringify(findings, null, 1)}

YOUR TASK (scratch ${S}/bridge/fix/):
1. Verify each finding yourself against the real repos before acting; a finding can be wrong. For each: confirmed or rejected, with evidence.
2. Fix every confirmed finding with the smallest correct change. Behavioural fixes get a test and a mutation check (revert -> fails; restore; diff -q). If a fix lands in Repo 1, republish before rebuilding Repo 2.
3. Keep all repo rules (Portuguese docs/KDoc/comments, English identifiers, tabs, package READMEs, KDoc on public API; no git writes; no MAC/logs).
4. Rerun ALL gates at the end: Repo 1 check --rerun-tasks, dokkaHtml, publishToMavenLocal + assembleTechnosWatchProtocolXCFramework; Repo 2 example/android --refresh-dependencies testDebugUnitTest + lintDebug + assembleDebug; JS tsc + jest + root typecheck; link/anchor checks; MAC scan. Quote test counts per task for both modules and the REPLAY / REALTIME-REPLAY lines.
Return the structured result (summary lists each finding id with confirmed/rejected and what was done).`, { label: 'fix', phase: 'Fix', schema: RESULT_SCHEMA })
}

return { modA, ctl, andr, reviews, fixes }
