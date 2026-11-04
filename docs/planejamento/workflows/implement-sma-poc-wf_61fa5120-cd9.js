export const meta = {
  name: 'implement-sma-poc',
  description: 'Implement the SMA PoC across technos-watch-protocol (KMP) and react-native-technos-core-next, then integrate, review and fix',
  phases: [
    { title: 'Implement', detail: 'Repo 1 chain (SMA codec+driver -> session+replay -> docs/tooling) in parallel with Repo 2 native and Repo 2 TS/example' },
    { title: 'Integrate', detail: 'republish KMP, build example app, run every test, reconcile native/JS contracts' },
    { title: 'Review', detail: 'three independent lenses: protocol+session, Android+bridge, documentation' },
    { title: 'Fix', detail: 'verify each finding, fix the real ones, re-run everything' },
  ],
}

const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const PLAN = '/Users/joao.farias/.claude/plans/wobbly-nibbling-yao.md'
const SCR = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const FACT_PROTO = `${SCR}/plan/3.md`
const FACT_CORE = `${SCR}/plan/2.md`
const FACT_APP = `${SCR}/plan/1.md`
const FACT_PKG = `${SCR}/plan/0.md`
const FACT_CRIT = `${SCR}/plan/5.md`
const SDK_AND = `${SCR}/vendor-sdks/sma/src/com/bestmafen`
const SDK_IOS = '/Users/joao.farias/TechnosWareCore/examples/basic/ios/Pods/SmaTechnosIosSdk'
const CORE = '/Users/joao.farias/TechnosWareCore'

const REPORT = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'What was built, in Portuguese, 5-15 lines' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    verification: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, outcome: { type: 'string' } }, required: ['command', 'outcome'] } },
    contractChanges: { type: 'array', items: { type: 'string' }, description: 'Any change to lead-owned contract files, with reason' },
    deviations: { type: 'array', items: { type: 'string' }, description: 'Deviations from the plan, with reason' },
    openIssues: { type: 'array', items: { type: 'string' }, description: 'Things not done, not verified, or needing the real watch' },
  },
  required: ['summary', 'filesWritten', 'verification', 'contractChanges', 'deviations', 'openIssues'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          repo: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          problem: { type: 'string' },
          evidence: { type: 'string', description: 'Concrete evidence: code quote, SDK file:line, failing command' },
          fix: { type: 'string' },
        },
        required: ['severity', 'repo', 'file', 'problem', 'evidence', 'fix'],
      },
    },
    strengths: { type: 'string' },
  },
  required: ['findings', 'strengths'],
}

const COMMON = `
You are implementing part of an approved plan. Work autonomously; do not ask questions. Return a factual report (it is consumed by the lead, not shown to a human directly).

MANDATORY READING FIRST
- The approved plan: ${PLAN} (read it fully; the "Documentação" section is a hard requirement).
- Facts gathered from the vendor SDKs and the current Core (treat as strong leads, but VERIFY against the sources before encoding any byte):
  - SMA protocol: ${FACT_PROTO}
  - Current Core SMA path and JS shapes: ${FACT_CORE}
  - Mormaii app usage: ${FACT_APP}
  - Packaging/toolchain: ${FACT_PKG}
  - Critique of the first plan draft (its fixes are already folded into the plan): ${FACT_CRIT}
- Sources (READ-ONLY): Android SMA SDK decompiled Java ${SDK_AND} (smablelib/component/SmaManager.java, SmaMessenger.java, util/SmaBleHelper.java, util/SmaBleUtils.java, entity/*.java, easeblelib/connector/EaseConnector.java); iOS SMA SDK ObjC source ${SDK_IOS} (BLEAPI/SmaBLE.m, SmaBusinessTool.m); current Core ${CORE} (android/src/main/java/com/sma/bluetooth/SMAService.java, ios/smaBluetooth/SMAService.m, src/NativeModules/**).

REPOSITORIES
- Repo 1 (Kotlin Multiplatform): ${R1}. Module :protocol, package br.com.grupotechnos.watch.protocol, explicitApi() mode, Kotlin 2.1.20, coroutines 1.10.1, kotlinx-datetime 0.6.2. Build with ./gradlew from ${R1} (JDK 17 is auto-detected; Android SDK in local.properties).
- Repo 2 (React Native TurboModule library): ${R2}. Library at the root (package.json, src/, android/), example app RN 0.81.4 in ${R2}/example (node_modules already installed there; the library root has NO node_modules and must not get one). The example links the library through example/react-native.config.js and example/metro.config.js.
- The lead already published Repo 1's public API (with stub internals) as br.com.grupotechnos.watch:protocol:0.1.0 to ~/.m2 (mavenLocal), and built the XCFramework.

CONVENTIONS (hard requirements)
- Language: every .md file, every KDoc/TSDoc and every code comment in Brazilian Portuguese. Identifiers, file names, log messages and error codes in English.
- Indentation with TABS in Kotlin, Gradle (kts and groovy), TS, JS. Double quotes in TS/JS.
- Multi-line KDoc is welcome in these repos (the one-line-comment rule of the Mormaii app does NOT apply). KDoc is mandatory on every public declaration of Repo 1 and on internal types that encode protocol rules.
- Comments explain WHY (firmware quirk, compatibility decision), never restate WHAT. Any claim about watch behaviour cites its source (SDK file:line, Core file:line, or a fixture).
- No git commands that change state (no init/add/commit). Never modify ${CORE} or /Users/joao.farias/GTE-Mormaii (read-only references).
- Lead-owned CONTRACT files — do not change public signatures; if a change is truly required, make the smallest one, keep KDoc in sync and list it under contractChanges:
  - Repo 1: protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/{domain/*, transport/*, profile/*, log/*, session/WatchSession.kt, session/WatchSessionListener.kt, session/SampleStore.kt, session/WatchClock.kt, driver/*}. (The two stubs sma/SmaDriver.kt and session/SessionEngine.kt are NOT contract: they must be replaced.)
  - Repo 2: src/specs/NativeCoreNext.ts, src/types/events.ts, package.json codegenConfig.
- Edit only the paths your task owns. If something outside your ownership must change, report it instead.
- Verification is real: run the builds/tests you claim, and report exact commands and outcomes. Never report success for something you did not run. If a tool or network step fails, say so.
- Keep the PoC scope: no DFU, no notifications/calls, no other vendors, no iOS host implementation.
`

const taskA = `${COMMON}
YOUR TASK (Repo 1, part A): the whole SMA family implementation — codec, commands, payloads, data mappers, sleep analyzer, and the real SmaDriver — with tests and the SMA documentation.

You own (create/replace): ${R1}/protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/sma/** (replace the stub SmaDriver.kt), .../util/** (keep Hex.kt's API; add ByteReader/ByteWriter and TimeFormat), ${R1}/protocol/src/commonTest/kotlin/br/com/grupotechnos/watch/protocol/{sma,util}/**, ${R1}/docs/protocolo-sma.md, ${R1}/docs/sma-dados.md, README.md inside sma/ (and its subpackages if you create them) and util/.
Do NOT touch session/ (another agent implements SessionEngine after you).

Read every contract file first (domain, transport, profile, log, session public files, driver/*). The SmaDriver implements internal interface DeviceDriver over DriverLink exactly as documented there.

REQUIRED CONTENT
1. util/: ByteReader/ByteWriter (big-endian u8/u16/u24/u32), TimeFormat with: isoWithOffset(epochMillis, timeZoneId) -> "yyyy-MM-dd'T'HH:mm:ssXXX" (always with seconds and ±HH:MM, e.g. "2026-10-28T00:00:00-03:00"; use "Z"? NO: always numeric offset like "+00:00"), dayKey(epochMillis, tz) -> "yyyy-MM-dd", startOfDayEpochMillis(dayKey, tz), plus local wall-clock <-> epoch helpers. kotlinx-datetime only; no java.* in commonMain.
2. sma/codec/: SmaFrame, SmaFrameCodec (encode/decode/ack/nack/frameLength; max 2048 bytes; reject bad magic/CRC/truncated with typed results), Crc16Arc (poly reflected 0xA001, init 0, no xorout; vectors "123456789"->0xBB3D, 01 00 01 00 00 -> 0x006C), SmaReassembler (rules in the plan: an exactly-8-byte notification with [0]==0xAB and flags bit 0x10 set is ACK/NACK regardless of buffer state and never enters a body; a lone 1-byte 0xAB is ignored; header+body in one notification is tolerated; gap > fragmentGapTimeoutMs drops the partial frame; garbage before 0xAB is skipped; CRC mismatch is reported so the driver can NACK). The reassembler must be time-injectable (pass "now" in or use the coroutine test clock) so it is unit-testable. SmaFragmenter (split by quirks.maxFragment ?: mtu-3, no per-fragment header). SmaSequence (u16, starts at 1, wraps).
3. sma/commands/: catalogue with names, cmd/key, direction, payload codecs. Implemented AND sent in the PoC: 03/01 BIND, 03/03 LOGIN, 03/05 UNBIND, 02/01 SET_TIME, 02/08 BATTERY, 02/0A VERSION, 05/41 SPORT, 05/45 SLEEP, and 02/6F SYNC_SWITCH only if you can determine its exact payload from the SDK sources (find SET_SYNC_SWITCH usage in SmaManager.java and SmaBLE.m); otherwise enableDataChangeNotices() logs and does nothing, and docs say why. Notices handled: 02/70 DATA_CHANGED -> DriverNotice.DataChanged, 04/62 BLE_CONNECTION -> DriverNotice.LinkReported. Codec+tests only (never sent): 02/68 TIMEZONE, 02/10 USER_INFO. Verify every byte layout in BOTH SDKs and cite file:line in KDoc.
4. Data: SPORT records 05/42 (8 bytes: ts u32 BE seconds since 2000-01-01 00:00 LOCAL wall clock, mode u8, steps u24 BE; max 20 per response; paginate by re-requesting the same key while count == 20; stop on count < 20 or empty value). Mapping to StepsSample: only mode 0; bucket to the local hour (minute/second zeroed), the LAST record of an hour wins (same as Core SMAService.java:437-445); convert local wall-clock -> epoch with link.clock.timeZoneId(); calories and distanceMeters estimated per sample with the exact formulas of SmaBleUtils.getCalorie/getDistance ported from the decompiled SDK, using the Core's fixed user (weight 60 kg, height 173.5 cm, gender 1, SMAService.java:112-114) as named constants in sma/SmaEstimates.kt (distance returned by getDistance is km in the Core: convert to meters and say so).
   SLEEP records 05/46 (7 bytes: ts, mode, soft, strong; max 20; same pagination). SmaSleepAnalyzer: 1:1 port of SmaSleep.analyseSleeps (SmaSleep.java:17-70) and getSleepStatus, producing domain SleepSession (stages without overlap, ISO strings via TimeFormat, dayKey = local date of the end, totals per type). Port faithfully; document every rule with the source line; mark the whole sleep path as exploratory.
5. SmaDriver (replace the stub): implements DeviceDriver over DriverLink.
   - start(scope): launches the receive loop consuming link.notifications -> reassembler -> frames.
   - TX: every frame is written as all its fragments under a driver-level Mutex so an ACK written by the receive loop can never interleave with the fragments of another frame. Use WriteType.WITH_RESPONSE.
   - RX: ACK/NACK frames complete the pending "awaiting ACK" of the in-flight request. Data frames with good CRC: write ACK(seq) FIRST, then dispatch (pending response matched by cmd and key+1, else notice, else log as unexpected). Bad CRC: write NACK(seq), drop, log.
   - request(cmd,key,value, isGet): send; await the watch ACK within quirks.commandTimeoutMs; for GETs then await the response within commandTimeoutMs (a response arriving before the ACK counts as the ACK). Retry once on timeout ONLY for SETs and handshake commands (new seq); GET timeouts throw WatchException(TIMEOUT) with no retry. Before LOGIN succeeds, refuse any cmd other than 0x03 (SmaManager.java:1245).
   - handshake(FIRST_PAIR): BIND with quirks.bindPayload (ANDROID_FF = FF + 31 zeros; USER_ID = bindUserId u32 BE + 28 zeros) awaiting 03/02 for up to quirks.bindTimeoutMs; value[0]==0 means success, else HANDSHAKE_FAILED; then LOGIN (same payload) awaiting 03/04, success when value is empty or value[0]==0. onPhase("BIND") / onPhase("LOGIN"). handshake(RECONNECT): LOGIN only. Fallback: if LOGIN fails with value[0]!=0 while using ANDROID_FF, run the full FIRST_PAIR once with USER_ID; log it.
   - readDeviceInfo: 02/0A -> 02/0B: firmware "a.b.c" from value[0..2]; bleVersion from value[3..5] if present (iOS SmaBLE.m:325-330).
   - readBattery: 02/08 -> 02/09, value[0].
   - setTime(now, tz): 02/01 with the packed local wall-clock u32 ((y-2000)<<26 | m<<22 | d<<17 | h<<12 | min<<6 | s), SmaTime.java:26-33.
   - readSteps / readSleep: paginated as above; empty result = empty list.
   - unbind: 03/05 with value [00].
   - describe(value): for a packet starting with 0xAB and >= 8 bytes: "ACK seq=N" / "NACK seq=N" / "seq=N 02/01 SET_TIME len=4"; continuation packets -> "".
   - close(): fail all pending waits with WatchException(DISCONNECTED). Idempotent.
   - All timing via kotlinx.coroutines (withTimeout/delay) so tests run on virtual time.
6. Tests (commonTest, kotlin.test + kotlinx-coroutines-test runTest; property tests with kotlin.random, no extra libs):
   - SmaFrameGoldenTest with these vectors (verify each independently; if one is wrong, fix the vector, explain in the report): BIND seq1 "AB 00 00 25 19 FB 00 01 03 00 01 00 20 FF"+31x"00"; LOGIN seq2 "AB 00 00 25 D9 A0 00 02 03 00 03 00 20 FF"+31x"00"; SET_TIME 2026-10-28 14:30:00 seq3 "AB 00 00 09 CD 2F 00 03 02 00 01 00 04 6A B8 E7 80"; TZ -3h seq4 "AB 00 00 06 95 1D 00 04 02 00 68 00 01 F4"; BATTERY seq5 "AB 00 00 05 02 F8 00 05 02 00 08 00 00"; VERSION seq6 "AB 00 00 05 C2 59 00 06 02 00 0A 00 00"; SPORT seq7 "AB 00 00 05 14 9C 00 07 05 00 41 00 00"; SLEEP seq8 "AB 00 00 05 D5 DD 00 08 05 00 45 00 00"; UNBIND seq9 "AB 00 00 06 6F 01 00 09 03 00 05 00 01 00"; ACK seq 0x1234 "AB 10 00 00 00 00 12 34". Encode and decode both ways.
   - Crc16ArcTest, SmaTimeCodecTest (0x6AB8E780 and edges 2000/2063/23:59:59), sport/sleep record decoding from hex fixtures, SmaSleepAnalyzerTest (START/1/2/3/strong>2/soft>2/END cases mirroring analyseSleeps), SmaReassemblerTest (header and body split; together; lone AB; ACK between fragments; bad CRC; gap timeout; garbage skip), SmaEstimates tests (same numbers the SDK formula gives), property tests (encode/decode identity; concat(split)=frame for fragment 20..509; reassembler reconstructs random partitions; SET_TIME round trip), TimeFormat tests (DST and non-DST zones, e.g. America/Sao_Paulo 2018 DST and Europe/Lisbon).
   - SmaDriverTest with a FakeDriverLink in commonTest that simulates the watch at byte level (parses our frames, answers with ACK + response frames, fragmented in 20-byte notifications like the real firmware with the 8-byte header in its own notification): handshake FIRST_PAIR/RECONNECT, bind refused, LOGIN fallback, battery, version, setTime bytes, pagination of 05/41 (20+20+5 records) and 05/45, GET timeout without retry, SET retry once, ACK written before dispatch, no interleaving of ACK with a multi-fragment frame, notices 02/70 and 04/62, refusing non-0x03 before login, close() failing pending.
7. Docs (Portuguese), written WITH the code:
   - ${R1}/docs/protocolo-sma.md with the 10 sections listed in the plan (GATT; frame byte-by-byte tables with an annotated example; CRC; sequence/ACK/NACK/reassembly rules and why; handshake with a mermaid sequenceDiagram and both payloads, timeouts and fallback; command catalogue table cmd/key, direction, payload, response, status (sent / codec-only / out of scope) and SOURCE file:line for every row; payload bit layouts; data records and pagination with open hypotheses and how each will be verified; the golden vectors decomposed field by field; quirks and Android-vs-iOS SDK differences and what our codec chose).
   - ${R1}/docs/sma-dados.md: sport and sleep records, mode values (SmaSport.Mode, SmaSleep.Mode), the hourly bucketing and HOURLY_SUM aggregation decision with the Core evidence (SMAService.java:437-445 and :860-866), estimates formulas, the analyzer rules, exploratory status of sleep.
   - README.md in sma/ (and subpackages) and util/: purpose, what is out, main types, dependencies, invariants, which tests cover it.
8. Verify: from ${R1} run ./gradlew :protocol:jvmTest :protocol:compileKotlinIosSimulatorArm64 :protocol:compileReleaseKotlinAndroid until green. Report test counts.
`

const taskB = (aReport) => `${COMMON}
YOUR TASK (Repo 1, part B): the generic session — replace the SessionEngine stub with the real state machine, command queue, sync engine and DriverLink implementation; FakeTransport; replay tests with fixtures; session documentation; the HCI conversion script.

Part A (SMA codec + SmaDriver) is DONE. Its report:
${JSON.stringify(aReport, null, 1)}
Read A's code (sma/, util/) before starting; use util/TimeFormat for all date math.

You own: ${R1}/protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/session/** except the contract files (WatchSession.kt, WatchSessionListener.kt, SampleStore.kt, WatchClock.kt) — you may adjust their KDoc text if behaviour needs clarification (report it); ${R1}/protocol/src/commonTest/kotlin/br/com/grupotechnos/watch/protocol/{session,testing}/**; ${R1}/protocol/src/jvmTest/**; ${R1}/fixtures/**; ${R1}/scripts/hci2jsonl.py; ${R1}/docs/{arquitetura.md,fixtures.md,decisoes.md}; README.md in session/, driver/, transport/, profile/, domain/, log/.
Do not change sma/ except to fix a real bug you prove with a failing test (report it).

DESIGN (follow it; document it in docs/arquitetura.md)
- Threading: WatchSession passes a single-threaded CoroutineContext (Dispatchers.Default.limitedParallelism(1) in production; tests use the internal constructor with a StandardTestDispatcher). scope = CoroutineScope(SupervisorJob() + context). All mutable state is confined to that context. 'state', 'currentAddress', 'currentProfileId' are @Volatile for reads from any thread.
- getStepsDays / getSleepSessions are synchronous and callable from any thread: serve them from immutable @Volatile snapshots (steps samples, sleep sessions, confirmed day sets) that the session thread replaces after every store change; load the initial snapshots from the store in the constructor (adjust SampleStore KDoc accordingly). confirmUploaded updates the snapshot immediately (atomic replace) and persists on the session thread.
- TransportEvents sink -> Channel(UNLIMITED).trySend; one dispatcher coroutine routes GATT completions (write/read/notify-enable/MTU) to pending CompletableDeferreds keyed by internal GATT request ids (distinct from host requestIds), notifications to the current link's notification channel, and lifecycle events (connected, disconnected, services discovered, bluetooth state) to the state handler. The state handler never suspends for long: handshake, configuration, commands and sync run as jobs in a connection-scoped child scope that is cancelled when the link drops.
- SessionDriverLink implements DriverLink: serialized write/read via Mutex; every TX and RX packet is logged with logger.frame(direction, characteristic, value, driver.describe(value)); transport failure -> WatchException(TRANSPORT); disconnect -> WatchException(DISCONNECTED).
- Lifecycle:
  pair(requestId, address, profileId): unknown profile -> onError(UNSUPPORTED_DEVICE). If a connection/pair is in progress for another address or state is not DISCONNECTED/RECONNECTING/BLUETOOTH_OFF: tear down the current one first (transport.disconnect, cancel jobs, fail pending with CANCELLED) then pair. BLUETOOTH_OFF -> onError(TRANSPORT, "bluetooth off"). Starts CONNECTING with transport.connect(address, autoReconnect=false) and a quirks.connectTimeoutMs timeout (-> transport.disconnect, DISCONNECTED, onError(CONNECT_TIMEOUT)).
  onConnected -> CONFIGURING: discoverServices; choose the first GattCandidate whose service, write and notify characteristics exist (normalize UUIDs) else GATT_NOT_SUPPORTED + disconnect; enableNotifications (timeout commandTimeoutMs); requestMtu(quirks.requestMtu) waiting up to 2 s (failure/timeout -> mtu 23); create SessionDriverLink + Drivers.create(link); driver.start(connectionScope); collect driver.notices.
  HANDSHAKING: driver.handshake(mode) with onPhase -> listener.onStateChanged(HANDSHAKING, phase). FIRST_PAIR failure or link drop -> DISCONNECTED + onError(requestId, HANDSHAKE_FAILED or DISCONNECTED). RECONNECT failure -> stay in RECONNECTING and connect again (autoReconnect=true).
  READY: onStateChanged(READY, null); onCompleted(pending pair/reconnect requestId). Then a post-login job: delay(quirks.postLoginDelayMs), then internal setTime and enableDataChangeNotices through the queue (errors only logged).
  Unexpected disconnect from READY/SYNCING/HANDSHAKING(reconnect mode) -> RECONNECTING, fail in-flight and queued commands with DISCONNECTED, transport.connect(address, autoReconnect=true), no timeout.
  onBluetoothStateChanged(false) -> BLUETOOTH_OFF (cancel connection jobs, fail commands with DISCONNECTED). (true) -> if there is an address and the user did not disconnect: RECONNECTING + connect(autoReconnect=true).
  reconnect(requestId, address, profileId): RECONNECTING + connect(autoReconnect=true); onCompleted when READY.
  disconnect(requestId, forget): stop reconnecting; if forget and READY: driver.unbind() best effort (bounded by commandTimeoutMs); transport.disconnect(); DISCONNECTED; if forget: store.clear(), snapshots cleared, currentAddress/currentProfileId cleared; onCompleted(requestId).
- Command queue: Channel consumed by one job in the connection scope; accepted only in READY/SYNCING, else onError(NOT_READY) immediately. readDeviceInfo -> onDeviceInfo(DeviceInfo(profileId, address, bleName = first profile bleName unless known, firmware, bleVersion)); readBattery -> onBattery; setTime -> onCompleted; refreshSteps -> readSteps, merge, onLiveSteps(requestId, today); syncHistory -> state SYNCING, onSyncStarted, STEPS (readSteps + merge), progress, SLEEP (readSleep; errors and empty results are logged, not terminal), progress 100, prune by quirks.historyRetentionDays, back to READY, onSyncFinished. DriverNotice.DataChanged -> debounced (2 s) internal refresh -> onLiveSteps(NO_REQUEST_ID, today).
- Merge rules: steps keyed by atEpochMillis, newer read replaces; sleep sessions keyed by startEpochMillis, newer replaces. Aggregation per day (dayKey in clock.timeZoneId()) by the profile's StepsAggregation (HOURLY_SUM: sum steps/calories/distance; DAY_CUMULATIVE: values of the max-steps sample of the day). getStepsDays(daysBefore): days from today-daysBefore to today, ascending, excluding confirmed days; today is computed from clock.nowEpochMillis(). getSleepSessions similarly by session dayKey. Profile for aggregation: current profile, or Profiles.MORMAII_FIT_GPS when none.
- Exactly one terminal callback per requestId (document and TEST this invariant).
- Logging tags "Session/<method>", INFO for every state transition with from->to and reason.

TESTS
- commonTest: a FakeTransport in testing/ with (a) scripted mode: a responder lambda that sees each write and returns notifications (reuse A's SMA watch simulator if it exists in commonTest; if it is coupled to FakeDriverLink, extract a reusable byte-level SmaWatchSimulator into testing/ and make both use it), plus control of connect/disconnect/bluetooth events; (b) replay mode driven by a Recording (header + packets) that, on each TX, checks it against the next recorded TX (strict mode masking seq bytes 6..7, the CRC bytes 4..5 and the value of 02/01 SET_TIME) and emits the following RX packets.
  Session tests with runTest + virtual time: pair happy path (states sequence, onCompleted), connect timeout, GATT not supported, bind refused, link drop during handshake, NOT_READY, queue order, commands failing with DISCONNECTED on drop, RECONNECTING then READY again with LOGIN only, bluetooth off/on, disconnect(forget) clears store and sends UNBIND, refreshSteps aggregation, sync progress and store merge, DataChanged debounce, retention pruning, confirmUploaded filtering, terminal-callback invariant across all commands.
- jvmTest: RecordingLoader (kotlinx-serialization-json parseToJsonElement; format of log/FrameJsonl), SmaSessionReplayTest replaying ${R1}/fixtures/synthetic/fitgps-pair-sync.jsonl (system property "fixtures.dir" is set by Gradle) through pair -> setTime -> battery -> version -> sync, asserting states, StepsDay totals and the absence of unexpected TX. Generate the synthetic fixture deterministically from the codec (a small JVM test helper is fine, but commit the resulting .jsonl file) with the 8-byte header in its own notification and 20-byte fragments, and record its provenance in docs/fixtures.md. Add a test that loads every file under fixtures/real/** if any exist (none yet) so real recordings automatically become tests.
- scripts/hci2jsonl.py: python3 stdlib only; input = Wireshark "Export Packet Dissections > As JSON" of a btsnoop log; output = our jsonl (header + packets with dir TX for ATT Write Request/Command to the write handle, RX for Handle Value Notification from the notify handle; handles given as arguments or auto-detected by UUID when discovery is in the capture). Include --help text in Portuguese and a docstring. Test it at least on a tiny handcrafted JSON input (put it under fixtures/tools/ and describe it).

DOCS (Portuguese): docs/arquitetura.md (layers, dependency rules, the two flows app->watch and watch->app, threading model, state machine as a mermaid stateDiagram, error model and terminal-callback rule, how a VendorSdkDriver would plug in), docs/fixtures.md (format, how to record with HCI snoop / FrameRecorder in the example app / hci2jsonl.py, folder convention fixtures/real/<profile>/<firmware>/<scenario>.jsonl, replay masking rules), docs/decisoes.md (one short ADR per decision/risk with context, decision, how to revert: at least HOURLY_SUM default vs the plan's cumulative assumption, ACK before delivery, no retry on GETs, long bind timeout without reconnection, MTU 247, FF60-then-NUS order, steps last-of-hour, store-backed history, sleep exploratory, single-threaded session), README.md for session/, driver/, transport/, profile/, domain/, log/.

VERIFY from ${R1}: ./gradlew :protocol:jvmTest :protocol:compileKotlinIosSimulatorArm64 :protocol:compileReleaseKotlinAndroid green; python3 -I scripts/hci2jsonl.py on the sample input works. Then ./gradlew publishToMavenLocal so Repo 2 picks up the real implementation (report success or failure).
`

const taskC = (aReport, bReport) => `${COMMON}
YOUR TASK (Repo 1, part C): finish Repo 1 — tooling, API documentation quality, top-level docs, full verification.

Reports from parts A and B:
A: ${JSON.stringify(aReport, null, 1)}
B: ${JSON.stringify(bReport, null, 1)}

You own: ${R1}/CLAUDE.md, ${R1}/README.md, ${R1}/docs/glossario.md, ${R1}/protocol/build.gradle.kts, ${R1}/gradle/libs.versions.toml, ${R1}/build.gradle.kts, ${R1}/gradle.properties, KDoc text anywhere in Repo 1 (doc comments only, no behaviour changes), and consistency edits to any docs/*.md or README.md in Repo 1.

DO
1. Dokka (version in libs.versions.toml, 2.0.0) configured for the protocol module with reportUndocumented = true for public API (V2 mode via gradle.properties org.jetbrains.dokka.experimental.gradle.pluginMode=V2Enabled and ...noWarn=true; if V2 fights KMP/AGP here, fall back to V1 dokkaHtml and explain). Generate the docs and make the undocumented-symbol report EMPTY by adding Portuguese KDoc where missing.
2. A Gradle task checkObjcHeader (wired into "check") that links the iosSimulatorArm64 debug framework and fails if the generated ObjC header TechnosWatchProtocol.h exposes coroutines or kotlinx-datetime types or suspend bridges: forbidden patterns like "completionHandler", "Kotlinx_coroutines", "Kotlinx_datetime", "Flow". Make it pass (fix by visibility, never by weakening the check without explaining).
3. CLAUDE.md (short, for agents and new people): what the repo is and is NOT, commands (build, tests, publish local, XCFramework, Dokka, header check, record/convert fixtures), package dependency rules and public-vs-internal list, conventions (Portuguese docs/comments, English identifiers, tabs, KDoc mandatory on public API, golden test + docs/protocolo-sma.md updated in the same change as any byte change), where each doc lives and when to update it. README.md: what it is, how to consume locally (mavenLocal coordinates, XCFramework path), how to run tests, links to docs/. docs/glossario.md: SMA, NUS, GATT, ATT, MTU, CCCD, notify, write request/command, frame, L1/L2, seq, ACK/NACK, bind/login, cursor, dayKey, fixture, replay, quirk, profile, driver, transport, host...
4. Consistency pass: every claim in docs/*.md and READMEs matches the code (constants, timeouts, UUIDs, cmd/key table, state names). Every package of commonMain has a README.md (checklist D3). Fix docs, not behaviour; report behaviour bugs you notice in openIssues.
5. Full verification from ${R1}: ./gradlew :protocol:allTests (jvm + android unit + iosSimulatorArm64 tests; if the simulator test cannot run in this environment, say exactly why and run the others), :protocol:check, Dokka generation, publishToMavenLocal, :protocol:assembleTechnosWatchProtocolXCFramework. Report counts and outcomes.
`

const taskD = `${COMMON}
YOUR TASK (Repo 2, native Android): the TurboModule implementation on Android — BLE transport, bridge, persistence, logging, foreground service — plus its docs. Another agent writes the TypeScript wrapper and the example UI in parallel; the Kotlin part of Repo 1 is being implemented in parallel too (public API is final and already in mavenLocal).

You own: ${R2}/android/** (build.gradle, src/main/AndroidManifest.xml, src/main/java/br/com/grupotechnos/corenext/**, src/test/**, README.md per folder ble/, bridge/, store/, log/ and the package root), ${R2}/react-native-technos-core-next.podspec and ${R2}/ios/README.md (iOS is NOT implemented: podspec skeleton with vendored_frameworks for TechnosWatchProtocol.xcframework + README of what is missing), ${R2}/docs/{arquitetura.md,transporte-android.md,ios-pendente.md}. You may edit ${R2}/example/android/** only for build wiring (no app logic).
Contract you must implement exactly: ${R2}/src/specs/NativeCoreNext.ts (module name "NativeCoreNext") and the event payload shapes in ${R2}/src/types/events.ts. Read the Repo 1 public API: ${R1}/protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/{session,transport,profile,domain,log}/*.kt.

BUILD SETUP
- android/build.gradle (groovy, tabs): apply plugins com.android.library, org.jetbrains.kotlin.android, com.facebook.react (new architecture only); no buildscript block (the host app provides AGP/KGP); namespace br.com.grupotechnos.corenext; compileSdk/minSdk/targetSdk from rootProject.ext with fallbacks 36/26/36; Java/Kotlin 17; repositories { mavenLocal(); google(); mavenCentral() }; dependencies: com.facebook.react:react-android, br.com.grupotechnos.watch:protocol:0.1.0 (if Gradle cannot resolve the KMP root coordinate for Android, use protocol-android and explain), kotlinx-coroutines-android only if you need it, test: junit 4 + kotlin-test; react { jsRootDir = file("../src/"); libraryName = "NativeCoreNextSpec"; codegenJavaPackageName = "br.com.grupotechnos.corenext" }. Verify that codegen generates br.com.grupotechnos.corenext.NativeCoreNextSpec for a library that lives outside node_modules (the RN plugin finds ../package.json); if it does not, fix the wiring and explain.
- Build through the example: cd ${R2}/example/android && ./gradlew :react-native-technos-core-next:compileDebugKotlin, :react-native-technos-core-next:testDebugUnitTest and :app:assembleDebug (arm64 only is already configured). The first build downloads a lot; be patient (timeouts up to 30 min).

IMPLEMENTATION (files from the plan, section "Repo 2")
- NativeCoreNextModule (extends the generated NativeCoreNextSpec; NAME "NativeCoreNext"): translates JS <-> WatchSession only; every Promise-returning command allocates a requestId, keeps the Promise in a map and settles it from the WatchSessionListener terminal callback (resolve on onCompleted / result callbacks; reject(code, message) on onError) and ALSO emits onError events for failures (shape ErrorEvent with method name). initialize/initSMASDK idempotent; scan/stopScan via BleScanner; pairDevice(deviceId, name): profile from DeviceRegistry by name (accept appName "fitGPS" or bleName "Mormaii_fitGPS") else reject UNSUPPORTED_DEVICE; persists PairingPrefs on READY; startPairingAttempt resolves immediately after session.reconnect; disconnectCurrentDevice -> disconnect(forget=false); forgetDevice -> disconnect(forget=true) + clear prefs; isConnected; getLastPairedDevice; getDeviceInfo emits onDeviceInfo; getFirmwareInfo emits onFirmwareInfo (same read); getBatteryStatus; setTime; refreshSteps -> onPedometer; syncDataHistory -> onSyncStarted/Progress/Finished; getHistoryPedometer(daysBefore) -> onHistoryPedometer from session.getStepsDays; getHistorySleep -> onHistorySleep or onError NO_DATA (and reject) when empty; deletedSavedData(items, category): category 5 -> STEPS, 0 -> SLEEP (TechnosCore.deletedCategory), registered_at ISO -> local dayKey -> session.confirmUploaded; getLogs/exportLogs/clearLogs/setLogLevel. On host resume with a stored pairing and DISCONNECTED state, call session.reconnect (like useSdkInit does today) — keep it simple and documented.
- ble/AndroidGattTransport: implements Transport; attach(events). connectGatt(ctx, autoConnect, callback, TRANSPORT_LE); first pair autoConnect=false; reconnect autoConnect=true preceded by a short MAC-filtered scan when the device is not known to the stack (document why: autoConnect needs the address type cached); close and recreate the BluetoothGatt on every new connect; GattQueue = one GATT operation at a time, advanced by the matching callback, 4 s per-operation timeout -> status GattStatus.TIMEOUT; CCCD write 01 00 for notifications; requestMtu; writeCharacteristic(ch, bytes, type) on API 33+, legacy setValue+write below; copy notification arrays; map services/characteristics to DiscoveredService with property flags; onDisconnected always delivered once per link; never call refresh() by reflection.
- ble/BleScanner: BluetoothLeScanner, filters by device name "Mormaii_fitGPS" (from Profiles) OR NUS service, SCAN_MODE_LOW_LATENCY, auto stop after 7 s; each result through DeviceRegistry.identify; emits onScannedDevice {name: appName, deviceId: MAC, rssi, bleName, profileId}; logs advertised service UUIDs (open question: does fitGPS advertise NUS?). Deduplicate per scan.
- ble/BluetoothStateReceiver -> events.onBluetoothStateChanged.
- ble/SyncForegroundService: foregroundServiceType connectedDevice, exported=false, started on onSyncStarted and stopped on onSyncFinished/onError; notification channel; handles ForegroundServiceStartNotAllowedException gracefully (sync continues without it, log WARN).
- store/FileSampleStore (org.json, files under context.filesDir/corenext/, atomic write via temp file + rename) and store/PairingPrefs (SharedPreferences "corenext.pairing": address, profileId, name).
- bridge/EventMapper: PURE Kotlin (Map<String, Any?> / List) from domain types to the shapes in src/types/events.ts (dates via the ISO strings provided by the domain types or java.time with the same pattern yyyy-MM-dd'T'HH:mm:ssXXX); bridge/WritableConverter converts Map -> WritableMap via Arguments; bridge/StateMapper ConnectionState -> deviceConnectStates codes (DISCONNECTED/RECONNECTING->0, CONNECTING/CONFIGURING/HANDSHAKING->1, READY/SYNCING->2, BLUETOOTH_OFF->4); bridge/PendingEvents queues emissions until the ReactContext has an active instance and emits on the JS-safe path (verify whether emitOnX from the session thread is safe in RN 0.81; if not, post to the JS queue thread; document what you found).
- log/RingLogger implements WatchLogger: ring of 2000 entries, Logcat, emits onLog (respect setLogLevel), frame entries carry dir and hex; FrameRecorder writes FrameJsonl header + lines to context.getExternalFilesDir(null)/corenext/frames-<timestamp>.jsonl (so "adb pull" works without root); exportLogs() flushes logs + frames and returns the jsonl path.
- CoreGraph wires WatchSession(AndroidGattTransport, RingLogger, FileSampleStore) once per process.
- AndroidManifest: BLUETOOTH_SCAN with android:usesPermissionFlags="neverForLocation", BLUETOOTH_CONNECT, FOREGROUND_SERVICE, FOREGROUND_SERVICE_CONNECTED_DEVICE, POST_NOTIFICATIONS; legacy BLUETOOTH/BLUETOOTH_ADMIN maxSdkVersion 30 and ACCESS_FINE_LOCATION maxSdkVersion 30; the service.
- Permissions are requested by the JS side; native methods check and reject with code PERMISSION_DENIED when missing (document this extra code in docs).
- Unit tests (src/test, JVM): EventMapper (all shapes, dates), StateMapper, deletedSavedData day-key conversion, FileSampleStore round-trip if it can run without Android (else a pure JSON codec class tested instead).

DOCS (Portuguese): docs/arquitetura.md (Repo 2 view: thin module, who owns what, threading, events, Promise settlement, lifecycle on resume), docs/transporte-android.md (GattQueue, autoConnect strategy, MTU, CCCD, write type, Bluetooth on/off, FGS only during sync, known limits, how to record frames and pull them), docs/ios-pendente.md (CentralTransport in Swift, restoration via a bootstrap(launchOptions:) called from AppDelegate because TurboModules are lazy, ObjC++ shim size, fragment 20 or maximumWriteValueLength(.withoutResponse) not .withResponse, no didWriteValueFor for withoutResponse, NSData bridging), README.md per Android folder.

Report precisely which build/test commands passed. If assembleDebug fails for reasons outside your files, report the error text.
`

const taskE = `${COMMON}
YOUR TASK (Repo 2, TypeScript + example app): the JS wrapper of the library, its types and mock, and the example app UI equivalent to the Core's "Basic" app; plus JS docs. Another agent implements the Android native side in parallel against the same contract.

You own: ${R2}/src/** except the contract files (src/specs/NativeCoreNext.ts and src/types/events.ts — read them; do not change them), ${R2}/tsconfig.json (root), ${R2}/example/{App.tsx,index.js,app.json,src/**,__tests__/**,jest.config.js,tsconfig.json,babel.config.js,.eslintrc.js,.prettierrc.js,package.json scripts/devDependencies only if needed,README.md}, ${R2}/docs/api-js.md, ${R2}/src/README.md. Do NOT touch ${R2}/android or ${R2}/example/android or ${R2}/example/ios.
No new native dependencies in the example (no navigation libs, no fs libs). Pure JS deps only if strictly necessary (prefer none). react-native-safe-area-context is already installed.

LIBRARY (src/)
- src/index.ts exports: TechnosCore (object with the same method names as the spec, plus deviceConnectStates {inDFU:-2, unknown:-1, disconnect:0, connecting:1, connected:2, disconnectOnActivity:3, disconnectedBluetoothOff:4} and deletedCategory {SLEEP:0, ACTIVITY:1, STRESS:2, SPO2:3, HEART_HERT:4, PEDOMETER:5, ACTIVITY_MONITOR:6, CALORIE:7, BODY_ENERGY:8} exactly like the current Core ${CORE}/src/NativeModules/index.ts:20-43), deletedSavedData(items: SavedItemDelete[]) grouping by category like the current Core wrapper (read it), errorCodes (NOT_READY, UNSUPPORTED_DEVICE, CONNECT_TIMEOUT, GATT_NOT_SUPPORTED, HANDSHAKE_FAILED, TIMEOUT, PROTOCOL, NO_DATA, TRANSPORT, DISCONNECTED, CANCELLED, BUSY, PERMISSION_DENIED), logLevels, TechnosEvents (typed wrappers over the spec EventEmitters with the shapes from src/types/events.ts), utils.events.getNativeEventData(emitter, timeoutMs) with the same semantics as ${CORE}/src/utils/events.ts (read it), and re-exports all types. TSDoc in Portuguese on everything exported.
- src/__mocks__/react-native-technos-core-next.ts: an official jest mock (all methods jest.fn resolved, emitters with a test helper to emit events) that apps can use.
- Root tsconfig.json that typechecks src/ using the example's node_modules (paths/typeRoots pointing to example/node_modules; no node_modules at the root). Make "npx tsc --noEmit -p ${R2}/tsconfig.json" (run with the example's tsc: ${R2}/example/node_modules/.bin/tsc) pass.

EXAMPLE APP (example/)
- Three tabs with a simple custom tab bar (no navigation library): Connection, Data, Log. Portuguese UI copy is fine (team is Brazilian), identifiers in English. Clean, legible, dark/light aware via useColorScheme.
  1. Connection: permission request (PermissionsAndroid: BLUETOOTH_SCAN, BLUETOOTH_CONNECT, POST_NOTIFICATIONS on API >= 33) with a visible status; initialize on mount; Scan/Stop; list {name, bleName, deviceId, rssi}; tap = pairDevice with a "confirme no relógio se pedir" hint and a spinner until resolve/reject; state badge from onConnectStateChanged (state code + sessionState + phase); Disconnect, Forget, Reconnect last (getLastPairedDevice + startPairingAttempt); cards Device info (getDeviceInfo/onDeviceInfo + onFirmwareInfo) and Battery (getBatteryStatus/onBatteryStatus); Set time; Refresh steps (onPedometer).
  2. Data: Sync button with progress bar (onSyncProgress); "Passos (3 dias)" -> getHistoryPedometer(3) + getNativeEventData(onHistoryPedometer); "Sono (exploratório)" -> getHistorySleep + onHistorySleep or the NO_DATA error; each result shows a summary (steps per day; sleep stages list) and the raw JSON in a selectable Text.
  3. Log: inverted FlatList fed by onLog (ring of 2000 in JS), text filter, level filter, "hex frames" toggle, Clear, Export (exportLogs -> show the returned path, selectable, with the adb pull command), Share (React Native Share.share with the last log entries as jsonl text — RN Share cannot attach files on Android).
- hooks/useCoreEvents.ts (subscribes to all events, keeps state), hooks/usePermissions.ts, components as needed under example/src/.
- Jest: example/jest.config.js maps "react-native-technos-core-next" to the root src and uses the official mock; tests for useCoreEvents (with the mock), for deletedSavedData grouping, for getNativeEventData timeout/resolve. Make "npm test" in example pass and "npx tsc --noEmit" in example pass (example tsconfig must resolve the library via paths to ../src).
- Remove the template's NewAppScreen usage. Keep the template's lint config working ("npx eslint ." should not explode; fix what you introduce).

DOCS (Portuguese): docs/api-js.md (every method and event: signature, when it resolves/rejects, payload shape with an example, equivalent in the current Core and differences), src/README.md, example/README.md (how to run: start Metro, npm run android with the phone connected, permissions, how to export/pull logs, what to validate with the fitGPS — the acceptance checklist A3-A8 from the plan).

VERIFY: in ${R2}/example: npx tsc --noEmit, npm test, npx eslint src App.tsx (or equivalent); root typecheck as described. Also run a Metro bundle to prove the library resolves: cd ${R2}/example && npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output ${SCR}/bundle-check/index.android.bundle --assets-dest ${SCR}/bundle-check/assets (create the folder first). Report outcomes.
`

const taskF = (reports) => `${COMMON}
YOUR TASK (integration across both repos). All implementation agents finished; their reports:
${JSON.stringify(reports, null, 1)}

You own integration fixes in both repos (smallest changes that make things consistent), ${R2}/CLAUDE.md and ${R2}/README.md.

DO, in order, fixing what breaks (always re-run after a fix):
1. Repo 1: from ${R1} run ./gradlew :protocol:jvmTest :protocol:check publishToMavenLocal (the real implementation must be in mavenLocal now).
2. Repo 2 native against the real AAR: cd ${R2}/example/android && ./gradlew --refresh-dependencies :react-native-technos-core-next:testDebugUnitTest :app:assembleDebug. Make sure the APK contains the protocol classes (e.g. unzip -l the APK's dex is not readable; instead check the dependency with ./gradlew :app:dependencies --configuration debugRuntimeClasspath | grep grupotechnos).
3. Contract consistency between native and JS: for every event in src/specs/NativeCoreNext.ts, compare the keys/types produced by android/.../bridge/EventMapper.kt with src/types/events.ts and with how example/src uses them; for every method compare spec <-> NativeCoreNextModule <-> src/index.ts wrapper (names, args, resolve/reject behaviour, error codes incl. PERMISSION_DENIED). Fix mismatches on whichever side deviates from the contract files.
4. JS: cd ${R2}/example && npx tsc --noEmit && npm test; root typecheck with ${R2}/example/node_modules/.bin/tsc --noEmit -p ${R2}/tsconfig.json; Metro bundle check into ${SCR}/bundle-check.
5. Write ${R2}/CLAUDE.md (what it is/is not, commands: build example, unit tests, jest, typecheck, bundle, how to install on a phone with npx react-native run-android or adb install, how to export/pull logs, conventions: Portuguese docs/comments, English identifiers, tabs, double quotes; contract files and when to update docs/api-js.md; dependency on Repo 1 via mavenLocal and how to republish) and ${R2}/README.md (what it is, quick start, layout, links to docs/).
6. Check docs links: every relative link in both repos' .md files points to an existing file.
Report every command and outcome, and anything that still needs the real fitGPS to validate.
`

const reviewCommon = `${COMMON}
You are a REVIEWER now: READ-ONLY. Do not edit any file. Find real defects with concrete evidence (code quotes, SDK file:line, a command you ran that fails). Prefer few high-confidence findings over many speculative ones; mark uncertainty honestly via severity. You may run read-only commands and the test suites.`

const reviewProto = `${reviewCommon}
LENS: protocol fidelity and session correctness in Repo 1 (${R1}).
- Compare every byte layout, constant, cmd/key, payload, CRC coverage, ACK/NACK rule, pagination rule, bind/login payload and success criterion, SET_TIME packing, sport/sleep record decoding, sleep analyzer rules and estimate formulas against BOTH SDK sources (${SDK_AND}, ${SDK_IOS}) and the current Core (${CORE}). Recompute the golden vectors yourself.
- Session: races and deadlocks (state handler suspending while waiting for transport events; ACK interleaving with fragments; Mutex reentrancy; cancellation leaving pending deferreds; double terminal callbacks; callbacks after close), reconnection loops, timeouts, thread confinement of state, snapshot thread-safety of getStepsDays, store merge/prune correctness, DST/timezone handling of local watch timestamps.
- Tests that pass for the wrong reason (asserting what the implementation does rather than what the protocol requires).
Run ./gradlew :protocol:jvmTest from ${R1} to confirm the suite state (read-only use).`

const reviewAndroid = `${reviewCommon}
LENS: Android transport, RN bridge and JS contract in Repo 2 (${R2}).
- BluetoothGatt usage: queue correctness (every callback advances exactly once; timeouts; stale callbacks after close), autoConnect strategy, close/reconnect leaks of BluetoothGatt clients (status 133 causes), CCCD write, MTU, API 33+ vs legacy write paths, copying notification buffers, threading (binder threads vs session thread vs JS), permission checks on Android 12+, scan filters and the neverForLocation flag, foreground service type and start restrictions on Android 14+.
- TurboModule: spec <-> NativeCoreNextModule method parity, Promise settled exactly once (including on disconnect/close), events emitted before JS listeners exist, emitOnX thread safety, memory leaks of promises map.
- Event shapes: EventMapper output vs src/types/events.ts vs example usage; date formats; compatibility with the current Core shapes (${CORE}/src/NativeModules/type/eventData/*).
- Example app: does it actually exercise A3-A8 of the plan; obvious UI bugs.
Run (read-only use) cd ${R2}/example/android && ./gradlew :react-native-technos-core-next:testDebugUnitTest and cd ${R2}/example && npx tsc --noEmit && npm test to confirm state.`

const reviewDocs = `${reviewCommon}
LENS: documentation and conventions in BOTH repos, against the user's explicit requirements:
(1) a CLAUDE.md in each repo; (2) a docs/ folder with explanations; (3) a README.md in each package explaining everything the package does; (4) every bind sequence, byte, vector and watch-specific command very well documented; (5) documentation and comments in Portuguese, code identifiers in English; (6) KDoc on functions/classes, especially in the KMP module.
Check: every commonMain package in ${R1} and every Android source folder in ${R2} has a README.md; docs/protocolo-sma.md covers all 10 sections of the plan and every cmd/key used in code appears in its table with a source citation; golden vectors in docs match the test file byte for byte; constants/timeouts/UUIDs in docs match the code; no English prose comments in Kotlin/TS (spot-check broadly with grep), no Portuguese identifiers; public declarations without KDoc (run the Dokka task C configured, or grep); broken relative links in .md files; CLAUDE.md commands actually work (run the cheap ones).`

const fixTask = (findings, reports) => `${COMMON}
YOUR TASK: verify and fix review findings across both repos, then re-run every verification.

Findings from three reviewers (some may be wrong — verify each against the code/sources BEFORE changing anything; skip false positives with a one-line reason):
${JSON.stringify(findings, null, 1)}

Context — implementation and integration reports:
${JSON.stringify(reports, null, 1)}

Rules: fix blockers and majors; fix minors when cheap and safe. Any byte/protocol change must update the golden tests and docs/protocolo-sma.md in the same pass. Keep conventions (Portuguese docs/comments, English identifiers, tabs).
After fixing, run: from ${R1}: ./gradlew :protocol:allTests :protocol:check publishToMavenLocal :protocol:assembleTechnosWatchProtocolXCFramework (report if the iOS simulator tests cannot run here and why); from ${R2}/example/android: ./gradlew :react-native-technos-core-next:testDebugUnitTest :app:assembleDebug; from ${R2}/example: npx tsc --noEmit && npm test; root typecheck; Metro bundle check into ${SCR}/bundle-check.
In the report: list each finding as fixed / skipped(reason) in 'deviations', the final command outcomes in 'verification', and the APK path.`

// ---------------- run ----------------
phase('Implement')
const [repo1, repo2Native, repo2Js] = await parallel([
  async () => {
    const a = await agent(taskA, { label: 'R1:sma-codec-driver', phase: 'Implement', schema: REPORT, effort: 'high' })
    const b = await agent(taskB(a), { label: 'R1:session-replay', phase: 'Implement', schema: REPORT, effort: 'high' })
    const c = await agent(taskC(a, b), { label: 'R1:docs-tooling', phase: 'Implement', schema: REPORT })
    return { a, b, c }
  },
  () => agent(taskD, { label: 'R2:android-native', phase: 'Implement', schema: REPORT, effort: 'high' }),
  () => agent(taskE, { label: 'R2:ts-example', phase: 'Implement', schema: REPORT }),
])
log('Implementation finished; integrating')

const implReports = { repo1, repo2Native, repo2Js }

phase('Integrate')
const integration = await agent(taskF(implReports), { label: 'integrate', phase: 'Integrate', schema: REPORT, effort: 'high' })

phase('Review')
const reviews = await parallel([
  () => agent(reviewProto, { label: 'review:protocol-session', phase: 'Review', schema: FINDINGS, effort: 'high' }),
  () => agent(reviewAndroid, { label: 'review:android-bridge', phase: 'Review', schema: FINDINGS, effort: 'high' }),
  () => agent(reviewDocs, { label: 'review:docs', phase: 'Review', schema: FINDINGS }),
])
const allFindings = reviews.filter(Boolean).flatMap(r => r.findings)
log(`${allFindings.length} findings (${allFindings.filter(f => f.severity === 'blocker').length} blocker, ${allFindings.filter(f => f.severity === 'major').length} major)`)

phase('Fix')
const fixes = await agent(fixTask(allFindings, { ...implReports, integration }), { label: 'fix', phase: 'Fix', schema: REPORT, effort: 'high' })

return { implReports, integration, reviews, fixes }