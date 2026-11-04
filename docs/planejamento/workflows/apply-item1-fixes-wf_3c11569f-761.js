export const meta = {
  name: 'apply-item1-fixes',
  description: 'Apply item 1 (replay harness, real fixture, Bluetooth-off contract, small Android/log fixes, docs from the recording, TODO docs) in both PoC repos, then integrate, review and fix',
  phases: [
    { title: 'Implement', detail: 'Repo 1 and Repo 2 in parallel' },
    { title: 'Integrate', detail: 'publish, build, cross-repo consistency' },
    { title: 'Review', detail: 'adversarial diff review per repo' },
    { title: 'Fix', detail: 'fix confirmed findings, rerun everything' },
  ],
}

const S = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const COMMON = `
CONTEXT
This is a proof of concept with two local repos. Neither is under git; never run git init or commit.
- Repo 1 ${R1}: Kotlin Multiplatform. Module protocol: SMA codec, internal SmaDriver, SessionEngine behind the public WatchSession facade. Docs in docs/. Read ${R1}/CLAUDE.md first.
- Repo 2 ${R2}: React Native TurboModule, Android only. Kotlin in android/src/main/java/br/com/grupotechnos/corenext/, example app in example/, docs in docs/. Read ${R2}/CLAUDE.md first.

The user tested the example app on a real Mormaii fitGPS (firmware 0.2.1) with an Android phone and exported:
- ${R2}/corenext-export/frames-20261029-083254.jsonl. This is the BLE packets. The recorder is cumulative, so it contains the earlier export frames-20261029-082857.jsonl as an exact prefix.
- ${R2}/corenext-export/logs-*.jsonl. These are the native log and contain the watch MAC address.

A verified analysis of that recording is in ${S}/logs-analysis/sintese.md (Portuguese). Its supporting material is in ${S}/logs-analysis/{protocol,session,data,replay}/.

Facts proven by the recording (cite the fixture file and atMs when you write them into docs):
- GATT: only NUS is exposed (services 1800, 1801, 6e400001, 180a); there is no FF60. The advertising lists 180f, 180a and 00000001-0000-1000-8000-00805f9b34fb. It does NOT list NUS, so only the scan filter by name matches.
- MTU: 247 requested, 23 negotiated with status 0. Every packet is 20 bytes at most.
- H5: the 8-byte L1 header always arrives in its own notification (79/79).
- Integrity: 161 data frames, 0 bad CRC, 0 NACK, 0 retransmissions.
- Seq: the watch keeps its own RX seq across connections (0..7, then 8..78). TX seq restarts at 1 on every connection.
- BIND_BACK came about 2.2 s after the BIND ACK; LOGIN came 2 ms after its ACK.
- VERSION_BACK has a 3-byte value (000201 = 0.2.1).
- The watch sent no unsolicited frames (no 02/70, no 04/62), including idle periods of about 384 s and 234 s.
- SPORT:
  - each 05/41 response ends with a live record stamped at request time;
  - mode 16 (SIT) records with 0 steps appear after a clock jump and are ignored;
  - mode 0 values are running totals within the hour (14, 14, 14, 56, 56, 56; no reset at :30);
  - all of them are in hour 08, so H3 (hour total vs day running total) stays open.
- SLEEP: 64 pages (63 x 20 + 2 records), 1262 records from 2023-08 to 2024-11. They are old data kept on the watch, because production Core never reads 05/45. They produced 4 sessions, which were all pruned.
- Sync timing: syncHistory took 59.3 s. Each sleep page takes about 900 ms: about 362 ms from request to the watch ACK, plus about 358 ms from our ACK to the next request.

The user deprioritized the on-device validation session; it becomes a TODO document (see your task).

LEAD DECISION: the Bluetooth-off contract ("contract B"). Apply it exactly.
"Quando o Bluetooth do telefone desliga, o host entrega onBluetoothStateChanged(false) e NENHUM onDisconnected para os links abertos e as conexões pendentes que isso derrubou, nem antes nem depois. Depois disso, disconnect() não emite nada até um novo connect(). Um onDisconnected que o host já tinha entregado antes do onBluetoothStateChanged(false) (o stack reportou a queda antes do broadcast) é uma queda comum, tratada como sempre."
Rationale:
- CoreBluetooth on iOS behaves like this (poweredOff and no didDisconnectPeripheral).
- Repo 1's FakeTransport already does this.
- The recording showed the Android transport delivering 3 onDisconnected for one link on Bluetooth off.
- With the counter of expected disconnects (ADR 12), the old ambiguity can make the session swallow a real failure and stay stuck in RECONNECTING.
On the session side, Bluetooth off must not count an expected disconnect:
- reset the counter to 0 and mark the transport inactive;
- calling transport.disconnect() for cleanup is fine, but it must not increment the counter.

RULES
- Docs, READMEs, KDoc and comments are in Portuguese. Identifiers, log messages and error codes are in English. Multi-line KDoc is welcome in these repos.
- Tabs for indentation; double quotes in TS.
- Every claim about the watch cites its source (file:line in an SDK, or the fixture plus atMs).
- When a behaviour changes, update the docs that describe it in the same pass. Each repo's CLAUDE.md maps the docs.
- Do not touch /Users/joao.farias/GTE-Mormaii or /Users/joao.farias/TechnosWareCore. Do not commit logs-*.jsonl anywhere, because they contain the MAC.
- Put scratch files under ${S}/item1/<your-label>/. Run Python with python3 -I.
- Mutation checks: when you add a test for a fix, revert the fix temporarily, confirm the test fails, then restore. Use diff -q to prove the restore.
- Snapshots of both repos taken before this work are in ${S}/snap-before/ (build/ and node_modules/ excluded). Do not modify them.
`

const IMPL = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    verification: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, outcome: { type: 'string' } }, required: ['command', 'outcome'] } },
    deviations: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'filesChanged', 'verification', 'openIssues'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['major', 'minor'] },
          repo: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['id', 'severity', 'repo', 'file', 'problem', 'evidence', 'fix'],
      },
    },
    checkedAndFine: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings'],
}

const R1_TASK = `${COMMON}
YOUR TASK: Repo 1 (${R1}). You own every file in Repo 1 and nothing outside it. Another agent changes Repo 2 at the same time.

1. REPLAY HARNESS. Copying a real export into fixtures/real must really replay it.
   A scratch implementation already passes on the real recording. It is in the copy ${S}/logs-analysis/replay/repo: protocol/src/commonTest/kotlin/.../testing/{ReplayScenario.kt,FakeTransport.kt,Recording.kt,...} and protocol/src/jvmTest/.../RealFixturesReplayTest.kt. Patches: ${S}/logs-analysis/replay/ReplayScenario.patch and ${S}/logs-analysis/replay/RealFixturesReplayTest.patch. Port it cleanly: no SCRATCH markers, Portuguese KDoc, same style as the surrounding code.
   a) Gradle: declare the fixtures directory as an input of every Test task, so that adding or changing a fixture reruns the tests instead of being UP-TO-DATE or FROM-CACHE. In protocol/build.gradle.kts use inputs.dir(...).withPropertyName("fixtures").withPathSensitivity(PathSensitivity.RELATIVE).
   b) MTU: the replay must use the recording header's mtu for the fake transport's MTU reply, instead of the fixed 247.
   c) Pagination: a steps or sleep read sequence ends at the first response page with fewer than 20 records, the same rule as SmaDriver. Back-to-back refreshSteps reads must no longer merge into one action.
   d) A LOGIN (03/03) in the middle of the file must replay as a Bluetooth off/on cycle followed by the host's reconnect, as Repo 2's CoreGraph.reconnectIfPaired does after Bluetooth comes back. Under contract B the fake stays silent on Bluetooth off.
   e) RealFixturesReplayTest prints one line per replayed file: path, packets, TX matched, final state.
   f) Add the real fixture: copy ${R2}/corenext-export/frames-20261029-083254.jsonl to fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl. Before copying, grep it to verify it contains no MAC address. Add only this one file.
   g) Prove four things:
      - the real fixture really replays (the test output line) and passes;
      - adding a fixture reruns the test (not UP-TO-DATE);
      - a deliberately corrupted copy of the fixture fails (do it in a temp location, or remove it afterwards);
      - the synthetic replay still passes.
2. CONTRACT B (Bluetooth off).
   - Code: SessionEngine. Bluetooth off resets the expected-disconnect counter and marks the transport inactive without counting.
   - Fake: FakeTransport stays silent on Bluetooth off. After it, disconnect() emits nothing until connect().
   - Tests (commonTest, so they also run on Kotlin/Native), plus a mutation check on the first one:
     1. Link open, Bluetooth off, Bluetooth on: the reconnect starts. A pending connect that then fails with onDisconnected is NOT swallowed; the session schedules its usual backoff retry.
     2. Bluetooth off while RECONNECTING with a pending connection: same result.
     3. The host delivers onDisconnected just before Bluetooth off (the race): normal drop handling, then BLUETOOTH_OFF, nothing stuck.
   - Docs: the Transport.kt KDoc (disconnect and the interface), the TransportEvents.onBluetoothStateChanged KDoc, ADR 12 in docs/decisoes.md (amended), a new ADR 18 (context, decision, how to revert), docs/arquitetura.md section 5 and transport/README.md.
   - Log level: in SessionEngine, "link lost ... with no connection attempt" goes from INFO to WARN.
3. FRAME LOG LINE. In SmaDriver, log one line per complete data frame in each direction (ACK/NACK excluded), through the driver's log helper: log(LogLevel.DEBUG, "frame", ...). The host then shows the tag SmaDriver/frame. Message formats, exactly: "TX seq=<n> <label> len=<valueLen>" and "RX seq=<n> <label> len=<valueLen> crc=ok". <label> is SmaCommand.label(cmd, key), as in describe(). Use logger.log, NEVER logger.frame: frame() feeds the host's fixture recorder and would duplicate packets. Add a test. Document it in the log/ README and wherever logs are described.
4. STEPS MERGE FILTER. In the history merge (session/HistoryStore, used by refreshSteps and syncHistory), drop step samples dated after the end of today or older than the retention window (quirks.historyRetentionDays). Log how many were dropped. Today a bad mode 0 record would become a pending day that never goes away. Add a test and update the docs.
5. DOCS FROM THE RECORDING, citing fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl and atMs:
   - docs/protocolo-sma.md: FF60 absent and NUS not advertised (sections 1/6/8/10); the watch's seq continues across connections (section 4); VERSION_BACK has 3 bytes (section 7; check that the codec handles it); no 02/70 observed; the section 8 hypothesis table updated:
     - H4: format proven, content not validated;
     - H5: proven;
     - H6: refuted for fw 0.2.1;
     - H1 and H2: suggested for SPORT, no evidence for SLEEP;
     - H3, H7, H8 and H9: open, each with the evidence that exists.
   - docs/decisoes.md: ADR 4 (BIND answered in about 2.2 s); ADR 5 (MTU 23 came from negotiation, status 0, not from the fallback); ADR 6 (FF60 absent on fw 0.2.1; the order is kept because it is harmless).
   - docs/glossario.md; the DeviceRegistry KDoc (identification by name, because the advertising does not list NUS).
   - docs/sma-dados.md: the observed SPORT behaviour listed in CONTEXT, including mode 16 (SmaSport.java:75-121 has SIT=16).
   - docs/fixtures.md:
     - a real fixture now exists;
     - exports are cumulative, so commit only the latest one;
     - logs-*.jsonl contain the MAC and are never committed;
     - the harness handles a mid-file reconnect;
     - recordedAt may carry milliseconds. Repo 2 will now write yyyy-MM-dd'T'HH:mm:ss.SSSxxx; add a loader test that parses that format.
6. TODO DOC (new). Write docs/pendencias.md in Portuguese: the on-device validation the user deprioritized, as a checklist. Base it on section 4 of ${S}/logs-analysis/sintese.md, and say in one line that sleep is not a priority because production never read it. Cover:
   - two syncs in a row (H2 for sleep; whether the 59 s repeats);
   - Disconnect, Forget/UNBIND and re-pair (A7), watching the watch screen at BIND (H7), and Set time with the phone clock moved (A5);
   - crossing an hour boundary while walking (H3), and the indirect H3 check in the backend;
   - link robustness (out of range, Bluetooth off during sync, background, force-stop);
   - H8 cross-check with the production iOS app (USER_ID 1);
   - a real night (T3) and the watch-at-rest night (T4).
   Also list the open technical items:
   - the 59 s sync: per-page progress; requestConnectionPriority(HIGH) during sync, which the SMA SDK itself does for bulk transfers (SmaManager.java:1458; used at :485, :1131, :1191) but which is untested here; ACK write type;
   - the HOURLY_SUM risk;
   - ADR 16;
   - the sleep plausibility filter;
   - the H1 trigger test (skip one ACK).
   For each item give the hypothesis or criterion it closes and where to record the result. Link it from CLAUDE.md (docs map) and README.md.
7. VERIFY:
   - ./gradlew :protocol:check (all tests, including the iOS simulator, checkObjcHeader and lint);
   - ./gradlew :protocol:dokkaHtml (must have 0 undocumented);
   - ./gradlew publishToMavenLocal :protocol:assembleTechnosWatchProtocolXCFramework.
   Report the test counts from the XML results.`

const R2_TASK = `${COMMON}
YOUR TASK: Repo 2 (${R2}). You own every file in Repo 2 except corenext-export/, which you must not modify. Another agent changes Repo 1 at the same time and publishes it to mavenLocal at the end. There is no public API change in Repo 1, so the AAR in mavenLocal is enough to compile against now.

1. CONTRACT B in android/.../ble/AndroidGattTransport.kt. On Bluetooth off:
   - close the GATT, cancel the re-arm and the reconnect scan, and mark the transport stopped so that later disconnect() calls and late GATT callbacks (stale generation) emit nothing;
   - do NOT emit onDisconnected;
   - then deliver events.onBluetoothStateChanged(false).
   A connect() that fails immediately because the adapter is off emits exactly one onDisconnected, and must leave the transport stopped so a following disconnect() emits nothing.
   Fix the KDoc that says disconnect "sempre termina com onDisconnected" (around line 46), and any comment around lines 495-496 claiming that the session chooses the write type (it always uses WITH_RESPONSE, SmaDriver.kt:338,344).
   If you can extract the "should this emit?" decision into a small pure class without a large refactor, add JVM unit tests for the three cases: Bluetooth off with a link open; Bluetooth off with a pending connection; disconnect after Bluetooth off. Otherwise explain why not.
   Update docs/transporte-android.md (around lines 82-88) and ble/README.md.
2. STARTUP WITH BLUETOOTH OFF. In CoreGraph init, when the adapter is disabled, deliver onBluetoothStateChanged(false) through the transport, so the session goes to BLUETOOTH_OFF and JS sees state 4 (also through initialize()'s emitCurrentState). Add a log line to SyncForegroundService.onDestroy.
3. FrameRecorder recordedAt: use yyyy-MM-dd'T'HH:mm:ss.SSSxxx (milliseconds and a numeric offset). Update RingLoggerTest and the docs that show the header format.
4. iOS deployment target: the podspec says s.platforms 16.0, but the example's IPHONEOS_DEPLOYMENT_TARGET is 15.1 (RN 0.81 minimum). Set the podspec to 15.1, with a short comment saying why. Update ios/README.md and docs/ios-pendente.md if they mention 16.0.
5. DOCS FROM THE RECORDING:
   - docs/transporte-android.md:
     - MTU 23 was negotiated with status 0 (around lines 105-107 and 184);
     - the advertising does not list NUS, so only the name filter matches (around lines 128-135);
     - the write type is always WITH_RESPONSE (around line 111);
     - BIND takes about 2.2 s;
     - the fixture recipe (around lines 180-200): commit only the latest frames export, because exports are cumulative; never commit logs-*.jsonl (MAC); use the name fixtures/real/fitgps/<fw>/<cenário>.jsonl; the Repo 1 harness now replays a mid-file reconnect.
   - example/README.md: around line 101, the Frame/ lines are packets. At MTU 23 the RX header arrives alone, so packet lines do not show cmd/key/CRC. The per-frame summary is in the new lines tagged SmaDriver/frame, with messages "TX seq=<n> <label> len=<n>" and "RX seq=<n> <label> len=<n> crc=ok". Also around line 105 (advertising) and the fixture step (around lines 82-84).
   - docs/api-js.md: getHistorySleep emits onError as well as rejecting; the observed syncDataHistory took 59 s with 64 sleep pages at MTU 23.
6. TODO DOC (new). Write docs/pendencias.md in Portuguese, for the host and integration items. Cover:
   - The Mormaii app's 50 s sync watchdog against the 59 s sync. Source: /Users/joao.farias/GTE-Mormaii/src/store/MainStoreContext/WatchInfo/useWatchInfoData/index.ts:142-152; the timer is started at :414 and is not reset by progress. Options: per-page progress plus restarting the timer on progress, or making the sync faster.
   - No 02/70 notices were observed, so live steps need polling, as the current Core does every 10 s.
   - exportLogs has no FileProvider (adb pull only).
   - iOS pending: link docs/ios-pendente.md.
   - Mormaii integration gaps: deviceId is a MAC on Android and a UUID on iOS; unsupported events.
   - A pointer to Repo 1 docs/pendencias.md, which holds the on-device validation checklist.
   Link it from CLAUDE.md and README.md.
7. VERIFY:
   - cd example/android && ANDROID_HOME=~/Library/Android/sdk ./gradlew :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug;
   - if you touched JS or TS: cd example && npx tsc --noEmit && npm test, and from the repo root: npm run typecheck.
   Report the test counts.`

phase('Implement')
const impl = await parallel([
  () => agent(R1_TASK, { label: 'implement:repo1', phase: 'Implement', schema: IMPL }),
  () => agent(R2_TASK, { label: 'implement:repo2', phase: 'Implement', schema: IMPL }),
])

phase('Integrate')
const integration = await agent(`${COMMON}
YOUR TASK: integration after both repos were changed. Use the label "integrate". You may make small fixes in either repo when they are needed to make things consistent; report every one.

Reports from the two implementers:
${JSON.stringify(impl, null, 1)}

Do the following:
1. Run cd ${R1} && ./gradlew publishToMavenLocal :protocol:jvmTest. Confirm that the real fixture replays and passes: look for the printed line in the test stdout or XML.
2. Run cd ${R2}/example/android && ANDROID_HOME=~/Library/Android/sdk ./gradlew --refresh-dependencies :react-native-technos-core-next:testDebugUnitTest :app:assembleDebug. Confirm with a dex scan that the APK contains the new Repo 1 classes; for example, grep the classes*.dex for the "frame" log text or for a new class.
3. JS: cd ${R2}/example && npx tsc --noEmit && npm test, and from the repo root: npm run typecheck.
4. Cross-repo consistency:
   a) Contract B is worded the same way in Repo 1 (Transport KDoc, ADR 12 and 18, arquitetura.md, transport/README) and in Repo 2 (AndroidGattTransport KDoc, transporte-android.md, ble/README). The Android code really follows it: no onDisconnected on Bluetooth off, nothing on disconnect() after Bluetooth off, exactly one event for a connect that fails immediately.
   b) The tag SmaDriver/frame and both message formats documented in Repo 2's example/README.md match what Repo 1 really logs.
   c) A header string produced by Repo 2's FrameRecorder pattern parses in Repo 1's RecordingLoader. Prove it with a small test or script.
   d) The two pendencias.md files point at each other and do not contradict each other.
   e) Run the link check: python3 -I ${S}/tools/linkcheck.py ${R1} ${R2}. Find the script if it is elsewhere under ${S}.
5. Check that no logs-*.jsonl and no MAC address (XX:XX:XX:XX:XX:XX) ended up in either repo outside corenext-export/: grep -r.`, { label: 'integrate', phase: 'Integrate', schema: IMPL })

phase('Review')
const reviewPrompt = (repo, snap, focus) => `${COMMON}
YOUR TASK: adversarial review of the changes made to ${repo}. Use the label "review-${focus.key}".
Compute the diff with: diff -ru --exclude=build --exclude=.gradle --exclude=.kotlin --exclude=node_modules --exclude=Pods --exclude=.cxx --exclude=corenext-export ${snap} ${repo}
Review every change for these points:
${focus.text}

Report only real problems, each with concrete evidence: file:line, plus a failing scenario or a contradiction. Do not report style nits. Also list what you checked and found fine.

Implementation and integration reports for context (do not trust them, verify):
${JSON.stringify({ impl, integration }, null, 1).slice(0, 60000)}`

const reviews = await parallel([
  () => agent(reviewPrompt(R1, `${S}/snap-before/technos-watch-protocol`, { key: 'repo1', text: `
- Contract B in SessionEngine: can a real drop or a failed connect still be swallowed? Are there new stuck states? Is the expected-disconnect counter still right for user disconnects, pair superseding and forget/UNBIND?
- The new tests: would they really catch the regression?
- The replay harness: can it still skip silently? Does strict replay still compare CRCs, masking only seq and SET_TIME? Is the Bluetooth-cycle action faithful to what Repo 2's host does?
- The frame log line: was logger.frame used by mistake? Is it emitted exactly once per frame? Is the format exact?
- The merge filter: could it drop valid samples (time zones, today's boundary, the retention edge)?
- Docs: is each claim correct against the fixture and the code? Do the H1-H9 verdicts match the evidence without overstating it? Is pendencias.md accurate and actionable?
- Public API and KDoc: did any public signature change? Does dokka still pass?` }), { label: 'review:repo1', phase: 'Review', schema: FINDINGS }),
  () => agent(reviewPrompt(R2, `${S}/snap-before/react-native-technos-core-next`, { key: 'repo2', text: `
- Contract B in AndroidGattTransport: generation and stopped handling; late onConnectionStateChange after Bluetooth off; connect after Bluetooth comes back on; the interaction with the pending autoConnect re-arm. Can it now emit zero events where the session needs one, for example a pending connect failing after Bluetooth comes back?
- CoreGraph start with Bluetooth off: ordering with initialize/emitCurrentState and with reconnectIfPaired; double events.
- The FrameRecorder format, and whether the tests really check it.
- The podspec change, and whether the docs still say 16.0 anywhere.
- Docs: is each claim correct against the code and the fixture? Are the fixture recipe and pendencias.md accurate?
- Were any files outside the task changed, or corenext-export/ modified?` }), { label: 'review:repo2', phase: 'Review', schema: FINDINGS }),
])

phase('Fix')
const allFindings = reviews.filter(Boolean).flatMap(r => r.findings || [])
let fixes = null
if (allFindings.length) {
  fixes = await agent(`${COMMON}
YOUR TASK: verify and fix review findings. Use the label "fix". You may edit both repos.
For each finding:
- verify it against the code first, and reject it with evidence if it is wrong;
- otherwise fix it minimally, add or adjust a test where it makes sense, and run a mutation check for behavioural fixes.

Then rerun everything:
- cd ${R1} && ./gradlew :protocol:check :protocol:dokkaHtml publishToMavenLocal :protocol:assembleTechnosWatchProtocolXCFramework
- cd ${R2}/example/android && ANDROID_HOME=~/Library/Android/sdk ./gradlew --refresh-dependencies :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug
- cd ${R2}/example && npx tsc --noEmit && npm test
- cd ${R2} && npm run typecheck
Report the test counts. Give each finding an outcome: fixed, rejected or deferred, with the reason.

FINDINGS:
${JSON.stringify(allFindings, null, 1)}`, { label: 'fix', phase: 'Fix', schema: IMPL })
} else {
  log('No review findings; skipping fix phase')
}

return { impl, integration, reviews, fixes }
