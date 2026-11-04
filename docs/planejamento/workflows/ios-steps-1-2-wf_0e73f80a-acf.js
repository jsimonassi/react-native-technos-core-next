export const meta = {
  name: 'ios-steps-1-2',
  description: 'iOS steps 1-2 in the KMP PoC: iosMain NSData bridge + Swift interop check, real recording replay on Kotlin/Native (virtual time and real dispatcher), docs; then adversarial review and fixes',
  phases: [
    { title: 'Implement', detail: 'one agent owns Repo 1 code/build and the doc updates in both repos' },
    { title: 'Review', detail: 'two independent reviewers, each in its own copy of Repo 1' },
    { title: 'Fix', detail: 'verify and fix confirmed findings, rerun all gates' },
  ],
}

const S = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const CTX = `
CONTEXT (shared by every agent in this workflow)
- Two PoC repos replace the vendor watch SDKs: Repo 1 ${R1} (Kotlin Multiplatform protocol module "protocol": session, SMA codec/driver, targets androidTarget, jvm, iosArm64, iosSimulatorArm64; static XCFramework "TechnosWatchProtocol", ObjC prefix TWP) and Repo 2 ${R2} (React Native TurboModule host, Android only so far). Read ${R1}/CLAUDE.md and ${R2}/CLAUDE.md first and follow them.
- Language rule in these two repos: docs, READMEs, KDoc and code comments in Portuguese; identifiers, log messages and error codes in English. Multi-line KDoc is welcome here. Tabs for indentation. Every package folder has a README.md (purpose, what it does not do, main types, dependencies, invariants, tests).
- Hard rules: NO git writes of any kind (no add/commit/stash/checkout/reset/init); read-only git commands are fine. Do not touch /Users/joao.farias/GTE-Mormaii or TechnosWareCore. Never copy corenext-export/logs-*.jsonl anywhere and never write the watch MAC (it appears in ${R2}/corenext-export/logs-*.jsonl) into any repo file. Temporary files only under ${S}/ios12/.
- Pre-change snapshot of both repos (no build dirs): ${S}/snap-before-ios/{technos-watch-protocol,react-native-technos-core-next}.
- Current green baseline in Repo 1: jvmTest 197 tests, testDebugUnitTest 187, testReleaseUnitTest 187, iosSimulatorArm64Test 187, lint OK, checkObjcHeader OK, dokkaHtml OK (failOnWarning + reportUndocumented for public API), publishToMavenLocal, assembleTechnosWatchProtocolXCFramework. Repo 2: 55 Android unit tests via example/android, JS: example tsc + jest 42 tests. Toolchain: Kotlin 2.1.20, AGP 8.7.2, coroutines 1.10.1, kotlinx-datetime 0.6.2, kotlinx-serialization 1.8.0 (only in jvmTest today), Dokka 2.0.0, Xcode 26.1.1, iOS simulator runtimes 26.x. ANDROID_HOME=~/Library/Android/sdk for Repo 2 builds.
- Facts about the code you will touch:
  * WatchSession (session/WatchSession.kt) has an internal constructor (transport, logger, store, clock, context: CoroutineContext) used by tests with StandardTestDispatcher, and PUBLIC constructors (transport, logger, store, clock) and (transport, logger, store) that use Dispatchers.Default.limitedParallelism(1). The real dispatcher has never run on Kotlin/Native; every iOS simulator test today uses virtual time.
  * testing/ReplayScenario.kt (commonTest) deduces actions from a recording (Pair, SetTime, ReadBattery, ReadDeviceInfo, Sync(kinds), BluetoothCycle for a mid-file LOGIN, Forget) and runReplay(recording, actions) runs them with FakeTransport + ReplayDriver (strict TX compare masking seq and the SET_TIME value/CRC; mtuReply from the recording header). testing/Recording.kt (commonTest) holds the model.
  * jvmTest/testing/RecordingLoader.kt parses .jsonl with kotlinx-serialization-json JsonElement (no serialization plugin) and reads files with java.io.File from the system property fixtures.dir; jvmTest/session/RealFixturesReplayTest.kt walks fixtures/real/**.jsonl, prints one line per file "REPLAY <path relative to fixtures/>: <n> packets, TX matched <a>/<b>, final state <STATE>", and also verifies the synthetic recording (SyntheticFitGpsFixture.RELATIVE_PATH). Other jvmTest files: SmaSessionReplayTest, Hci2JsonlTest, RecordingLoaderTest, SyntheticFitGpsFixture.
  * protocol/build.gradle.kts: tasks.withType<Test>().configureEach { inputs.dir(fixtures) RELATIVE + systemProperty("fixtures.dir", ...) } — Kotlin/Native test tasks are not Gradle Test tasks, so they are probably not covered (verify). Build cache is on (gradle.properties). checkObjcHeader forbids these substrings in the generated ObjC header: completionHandler, Kotlinx_coroutines, Kotlinx_datetime, Kotlinx_serialization, Flow, Coroutine.
  * The real recording: ${R1}/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl (fitGPS fw 0.2.1, Android, header mtu 23, timeZone America/Sao_Paulo, 850 packets). Today on JVM: "REPLAY real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl: 850 packets, TX matched 167/167, final state READY"; synthetic: "REPLAY synthetic/fitgps-pair-sync.jsonl: 49 packets, TX matched 16/16, final state READY".
  * Public API that carries bytes is exposed to ObjC/Swift as TWPKotlinByteArray: Transport.write(characteristic, bytes, type, requestId), TransportEvents.onNotification(characteristic, value), TransportEvents.onReadCompleted(requestId, value?, errorCode), WatchLogger.frame(...). Grep commonMain for any other public ByteArray.
  * Repo 2 docs/ios-pendente.md (section "Bytes: NSData <-> KotlinByteArray") says Repo 1 should gain iosMain conversion helpers and NSData overloads; it also has the MTU/fragment discussion. Repo 2 podspec targets iOS 15.1.
- DECISION already made (do not reopen): keep Profiles.MORMAII_FIT_GPS quirks.maxFragment = null (no Android behavior change). The iOS host contract is: answer Transport.requestMtu with maximumWriteValueLength(for: .withoutResponse) + 3, never the .withResponse value (512, which would turn the 45-byte BIND into one long write). fitGPS 0.2.1 negotiated MTU 23, so both platforms send 20-byte fragments.
- Gate commands (Repo 1): ./gradlew :protocol:check --rerun-tasks ; ./gradlew :protocol:dokkaHtml ; ./gradlew publishToMavenLocal :protocol:assembleTechnosWatchProtocolXCFramework. Count tests per target from the XML under protocol/build/test-results/<task>/. Link checkers from earlier work (use if present): python3 -I ${S}/tools/linkcheck.py ${R1} ${R2} and python3 -I ${S}/item1/integrate/anchorcheck.py ${R1} ${R2}.
`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    swiftSpellings: { type: 'array', items: { type: 'string' }, description: 'exact Swift call spellings of the new bridge API as seen from the generated header' },
    verification: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, outcome: { type: 'string' } }, required: ['command', 'outcome'] } },
    openIssues: { type: 'array', items: { type: 'string' } },
    deviations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'filesChanged', 'swiftSpellings', 'verification', 'openIssues', 'deviations'],
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

phase('Implement')
const impl = await agent(`${CTX}
YOUR TASK: implement iOS steps 1 and 2 of the PoC plan in Repo 1 (code, build, tests, docs) and update the Repo 2 docs (docs only, no Repo 2 code). Work dir for scratch: ${S}/ios12/impl/.

STEP 1 — iosMain bytes bridge for the Swift host
1. Add the iosMain source set (the default hierarchy template should give one shared iosMain for iosArm64 + iosSimulatorArm64; verify) with a new package, e.g. br.com.grupotechnos.watch.protocol.ios, plus its README.md in Portuguese and Portuguese KDoc on every public declaration (explicitApi is on; dokka must stay green — check that the dokka run actually includes the iosMain declarations, or report why not).
2. Public API so the Swift host never handles KotlinByteArray byte by byte:
   - copy conversions ByteArray -> NSData and NSData -> ByteArray (usePinned + memcpy or NSData.create(bytes:length:)); handle size 0 safely in both directions (no addressOf(0) on an empty array; NSData.bytes can be null when length is 0).
   - NSData entry points for the TransportEvents calls that carry bytes (onNotification, onReadCompleted with nullable value), e.g. as iosMain extension functions (which K/N exports as ObjC category methods on TWPTransportEvents — confirm in the header).
   - a clear Kotlin->Swift path for the bytes the session hands to the host (Transport.write, WatchLogger.frame and any other public ByteArray you find).
   - Inspect the generated header (protocol/build/bin/iosSimulatorArm64/debugFramework/TechnosWatchProtocol.framework/Headers/TechnosWatchProtocol.h) and choose names that read well in Swift. Return the exact Swift spellings in swiftSpellings.
3. iosTest tests (run by iosSimulatorArm64Test): round trip; empty both ways; all 256 byte values (signedness); a large buffer (e.g. 64 KiB); copy semantics both ways (mutating the source after conversion does not change the result); NSData made from a sub-range (subdataWithRange) converts correctly; the NSData overloads deliver exactly the same bytes/events as the ByteArray versions (e.g. through a session harness or a recording TransportEvents path). Mutation check: break the implementation (e.g. off-by-one length) -> a test fails; restore and confirm with diff -q.
4. Swift interop guard: a Gradle task (e.g. checkSwiftInterop, group verification, onlyIf HostManager.hostIsMac, wired into check) that runs "xcrun --sdk iphonesimulator swiftc -typecheck -target arm64-apple-ios15.1-simulator -F <dir of the debug iosSimulatorArm64 framework>" on a Swift source that plays a minimal host: a class implementing the Transport protocol as Swift sees it (converting the bytes from write to Data), WatchLogger, SampleStore and WatchSessionListener minimal implementations, building a WatchSession, and calling session.events.onNotification / onReadCompleted with Data. Put the Swift file in a documented folder with a Portuguese README. Declare proper task inputs so it reruns when the header or the Swift file changes. Mutation: rename something the Swift file uses -> the task fails; restore. checkObjcHeader must still pass.

STEP 2 — the real recording on Kotlin/Native
5. Make the recording loader and RealFixturesReplayTest multiplatform: parsing in commonTest (add kotlinx-serialization-json to commonTest dependencies), file access behind a small test-only expect/actual (JVM and Android unit tests: java.io.File + the existing fixtures.dir system property; iOS: Foundation/posix, with the fixtures path delivered to the simulator test process — e.g. environment through the simulator test task (SIMCTL_CHILD_ prefix) or a generated constant; find empirically what works with KGP 2.1.20 and document it). If the path is missing on any target the test must FAIL, not pass silently. The Kotlin/Native test tasks must declare the fixtures folder as an input too, so a new or changed fixture reruns iosSimulatorArm64Test; prove it (copy a fixture -> task reruns, not UP-TO-DATE/FROM-CACHE; corrupt the copy -> test fails on iOS; remove the copy). Keep JVM-only tests that really need the JVM in jvmTest; the synthetic verifier should run wherever the loader runs. RecordingLoaderTest checks should keep passing (move to commonTest if they no longer need the JVM).
   Result wanted: the REPLAY lines for the real and the synthetic recording appear for jvmTest, testDebugUnitTest, testReleaseUnitTest and iosSimulatorArm64Test. Find where Kotlin/Native test stdout lands (XML system-out or console) and quote the iOS line.
6. Real-dispatcher smoke test: build the session with the PUBLIC constructor WatchSession(transport, logger, store, clock) (real Dispatchers.Default.limitedParallelism(1), no test dispatcher) and a replay transport that delivers every TransportEvents call from a separate serial host queue — on iOS a dispatch_queue_create serial queue (like the CoreBluetooth delegate queue), on JVM a single-thread executor (expect/actual; make it run on iOS at least, and on JVM too if cheap). Reuse ReplayScenario/ReplayDriver to decide what RX to inject after each TX. Drive the deduced actions of the real recording with runBlocking and real waits (await terminal listener callbacks with per-step timeouts and a global timeout; the session's real delays include postLoginDelayMs 3000 per handshake). Assert: TX matched 167/167 and final READY; the same store content as the virtual-time replay (e.g. the same StepsDay list); every listener callback ran on one thread that is not the host queue thread (record thread identity per platform); TransportEvents calls return quickly on the host queue; after close() no further callback arrives within a grace period. Print one line "REALTIME-REPLAY <path>: TX matched a/b, final state S, <duration> ms" per target. Keep it to roughly 10-30 s; report the real duration. Mutation checks: (i) deliver events on the session thread / bypass the host queue -> the thread assertion fails; (ii) drop one RX -> the test fails fast with a clear message instead of hanging until the global timeout. Restore with diff -q.
7. Do not change protocol behavior or the public common API; the only new public API is the iosMain bridge.

DOCS (Portuguese)
8. Repo 1: README.md and CLAUDE.md (commands incl. iosSimulatorArm64Test and checkSwiftInterop, where the iOS REPLAY lines appear, the new package in the package list); docs/arquitetura.md (iOS byte bridge; threading as exercised by the smoke test: TransportEvents from any thread, listener on the session thread); docs/fixtures.md (replay on 4 targets, how the path reaches the simulator, the input wiring); docs/decisoes.md (new ADR 19 for the bridge shape and the multiplatform fixture + real-dispatcher smoke test, with how to revert; ADR 5 amendment with the iOS MTU rule above); Transport.requestMtu KDoc gets the iOS note; docs/pendencias.md gets an iOS section: what steps 1-2 proved and what remains (pod + ObjC++ shim, Swift bridge + persistence, log export, CentralTransport on CoreBluetooth, H8 with an iOS recording, background/restoration — including the design note that the current reconnect backoff is a coroutine delay in SessionEngine that does not fire while the iOS app is suspended, so on iOS the pending CBCentralManager.connect should be the wait); protocol/Module.md; glossario.md if you introduce terms.
9. Repo 2 (docs only): docs/ios-pendente.md "Bytes" section now points to the Repo 1 bridge with the exact Swift spellings and the Swift interop check; the MTU rule; docs/pendencias.md iOS part; CLAUDE.md/README.md only where they describe the bridge as missing.

GATES (all must pass at the end; report counts per target)
10. Repo 1: ./gradlew :protocol:check --rerun-tasks ; :protocol:dokkaHtml ; publishToMavenLocal :protocol:assembleTechnosWatchProtocolXCFramework. Then Repo 2 sanity: cd ${R2}/example/android && ANDROID_HOME=~/Library/Android/sdk ./gradlew --refresh-dependencies :react-native-technos-core-next:testDebugUnitTest :app:assembleDebug (must stay 55/55). Link/anchor check. MAC scan of both repos excluding corenext-export, build, node_modules, .git.
Return the structured result. In verification list each command with its real outcome (counts, quoted REPLAY / REALTIME-REPLAY lines, mutation results).`, { label: 'implement', phase: 'Implement', schema: IMPL_SCHEMA })

phase('Review')
const implBrief = JSON.stringify({ summary: impl && impl.summary, filesChanged: impl && impl.filesChanged, swiftSpellings: impl && impl.swiftSpellings, openIssues: impl && impl.openIssues, deviations: impl && impl.deviations })

const REVIEW_COMMON = `${CTX}
An implementer just did iOS steps 1-2 (iosMain NSData bridge + Swift interop check; the real recording replayed on Kotlin/Native with virtual time and with the real dispatcher; docs in both repos). Their own report (treat as claims to verify, not facts): ${implBrief}

You are an adversarial reviewer. Default to skepticism: try to break the claims. Rules:
- Do NOT edit ${R1} or ${R2}. Make your own copy: rsync -a --exclude build --exclude .gradle --exclude .kotlin ${R1}/ <your scratch dir>/technos-watch-protocol/ and run Gradle only in the copy (another reviewer runs at the same time in its own copy). Mutations only in your copy.
- Diff against the snapshot: diff -ru ${S}/snap-before-ios/technos-watch-protocol ${R1} (exclude build dirs) and the same for Repo 2 docs.
- Report only real problems with concrete evidence (file:line, command output, a failing mutation or scenario). Minor style nits only if they break a stated repo rule (Portuguese docs/KDoc, tabs, package README, KDoc on public API). Put everything you checked that held up in checkedAndFine.`

const reviews = await parallel([
  () => agent(`${REVIEW_COMMON}
Scratch dir: ${S}/ios12/review-a/.
YOUR LENS: Kotlin/Native correctness and the Swift-facing API.
- Bridge: memory safety (pinning scope, empty arrays, NSData.bytes null, length types/overflow), copy semantics, behaviour for large data, that NSData overloads forward exactly the same bytes as the ByteArray paths. Write extra probes in your copy if needed.
- Header and Swift: read the generated header in your copy; check the Swift spellings the implementer reported are real; write a slightly different Swift host than theirs and typecheck it the same way (xcrun --sdk iphonesimulator swiftc -typecheck -target arm64-apple-ios15.1-simulator -F ...) to see that a real host can implement Transport/WatchLogger/SampleStore/WatchSessionListener and convert both directions without byte loops. Mutation-check that checkSwiftInterop really fails on breakage and reruns on header/Swift changes (inputs). checkObjcHeader still meaningful.
- Real-dispatcher smoke test: is it really on Dispatchers.Default.limitedParallelism(1) (public constructor), not runTest/virtual time? Are TransportEvents really called from a distinct serial queue on iOS? Are the thread assertions meaningful (would they catch callbacks on the host queue)? Hang risk, flakiness (timing thresholds), cleanup after close (leaked coroutines/queues keeping the test process alive). Run iosSimulatorArm64Test in your copy at least 3 times (with --rerun-tasks or --rerun) and report durations and stability; also run under load if you can (e.g. in parallel with another Gradle build in your copy) to see if timing assertions flake.
- dokka actually documents iosMain; explicitApi respected; KDoc Portuguese.`, { label: 'review:kn-swift', phase: 'Review', schema: REVIEW_SCHEMA }),
  () => agent(`${REVIEW_COMMON}
Scratch dir: ${S}/ios12/review-b/.
YOUR LENS: test-harness validity and docs.
- Fixture wiring: in your copy prove that adding/changing a fixture reruns iosSimulatorArm64Test, testDebugUnitTest and jvmTest (not UP-TO-DATE/FROM-CACHE), that a corrupted fixture fails on each target, and that a missing/empty fixtures path FAILS (never passes silently) on each target. Check that the multiplatform loader parses every fixture exactly as the old JVM loader did (old loader is in ${S}/snap-before-ios/technos-watch-protocol/protocol/src/jvmTest/...; compare header fields and every packet, e.g. by running both in your copy or by an equivalent script).
- REPLAY lines: confirm in your copy that the real and synthetic REPLAY lines appear for jvmTest, testDebugUnitTest, testReleaseUnitTest and iosSimulatorArm64Test, and the REALTIME-REPLAY line(s); check where the iOS stdout lands and that the docs say the same.
- Strictness kept: TX masking unchanged, final-state and unfinished-request checks still applied on every target; no test was weakened or dropped (compare test counts and test names before/after per target; list any removed test).
- Docs: every statement added in both repos matches the code (Swift spellings vs header, task names, commands, paths, ADR numbers 19 and the ADR 5 amendment, the iOS MTU rule, the reconnect-wait note, pendencias iOS section, Repo 2 ios-pendente/pendencias). Run the link/anchor checkers. Portuguese, tabs, package README for the new package. No MAC and no logs-*.jsonl in either repo.`, { label: 'review:harness-docs', phase: 'Review', schema: REVIEW_SCHEMA }),
])

const findings = reviews.filter(Boolean).flatMap(r => r.findings || [])
log(`review: ${findings.length} finding(s)`)

let fixes = null
if (findings.length > 0) {
  phase('Fix')
  fixes = await agent(`${CTX}
The iOS steps 1-2 were implemented (report: ${implBrief}) and two adversarial reviewers produced these findings:
${JSON.stringify(findings, null, 1)}

YOUR TASK (scratch dir ${S}/ios12/fix/):
1. Verify each finding yourself against the real repos before acting; a finding can be wrong. For each: confirmed or rejected, with evidence.
2. Fix every confirmed finding in ${R1} / ${R2} (Repo 2 docs only). Prefer the smallest correct fix. For each behavioural fix add or adjust a test and mutation-check it (revert the fix -> the test fails; restore; diff -q).
3. Keep all repo rules (Portuguese docs/KDoc/comments, English identifiers, tabs, package READMEs, KDoc on public API; no git writes; no MAC/logs).
4. Rerun ALL gates at the end: ./gradlew :protocol:check --rerun-tasks ; :protocol:dokkaHtml ; publishToMavenLocal :protocol:assembleTechnosWatchProtocolXCFramework ; Repo 2 example/android --refresh-dependencies testDebugUnitTest + assembleDebug ; link/anchor checks ; MAC scan. Quote the REPLAY and REALTIME-REPLAY lines for each target and the test counts per target.
Return the structured result (summary must list each finding id with confirmed/rejected and what was done).`, { label: 'fix', phase: 'Fix', schema: IMPL_SCHEMA })
}

return { impl, reviews, fixes }
