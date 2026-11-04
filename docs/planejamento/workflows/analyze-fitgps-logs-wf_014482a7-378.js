export const meta = {
  name: 'analyze-fitgps-logs',
  description: 'Analyze the real fitGPS export (protocol, session/transport, data, replay), verify findings adversarially, and assess iOS as the next step',
  phases: [
    { title: 'Analyze', detail: 'protocol, session/transport, data, replay, iOS, alternatives in parallel' },
    { title: 'Verify', detail: 'independent refutation of protocol/session/data findings' },
    { title: 'Synthesize', detail: 'acceptance status, hypotheses, bugs, next-step recommendation' },
  ],
}

const S = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'

const CONTEXT = `
CONTEXT
This is a proof of concept of our own SMA watch protocol stack, replacing the vendor SDK.
- Repo 1 /Users/joao.farias/technos-watch-protocol (Kotlin Multiplatform: SMA codec, internal SmaDriver, SessionEngine behind the public WatchSession facade). Docs in docs/: protocolo-sma.md (section 8 lists hypotheses H1-H9 about the real watch), sma-dados.md, decisoes.md (ADR 1-17), arquitetura.md, fixtures.md.
- Repo 2 /Users/joao.farias/react-native-technos-core-next (React Native TurboModule, Android only). Android code in android/src/main/java/br/com/grupotechnos/corenext/ (ble/, bridge/, store/, log/, CoreGraph.kt, CoreSessionListener.kt, NativeCoreNextModule.kt). Example app in example/. Docs in docs/.

On 2026-10-29 the user ran the example app on a real Mormaii fitGPS with an Android phone. The user says everything seemed to work. They exported logs to /Users/joao.farias/react-native-technos-core-next/corenext-export/:
- frames-20261029-082857.jsonl and logs-20261029-082857.jsonl (first export);
- frames-20261029-083254.jsonl and logs-20261029-083254.jsonl (second export). The recorder and the log ring are cumulative, so the second export probably contains the first. Verify this.

Frames file format: a header line, then one line per BLE packet: {"type":"packet","dir":"TX|RX","atMs":...,"characteristic":...,"hex":...}. These are packets (fragments), not frames. atMs is relative to the header's recordedAt.
Log file format: {ts (epoch ms), level, tag, message, dir, hex}.
Time zone: America/Sao_Paulo (-03:00).

SMA FRAME AND RECORD LAYOUT
- Frame: 0xAB, flags, L2 length (u16 BE), CRC-16/ARC of L2 (u16 BE), seq (u16 BE). Then L2 = cmd, 0x00, key, value length (u16 BE), value.
- ACK/NACK: 8 bytes with flags & 0x10 set. NACK also has 0x20.
- Records 05/42 (SPORT): 8 bytes each: ts (u32 BE, seconds since 2000-01-01 local time), mode (u8), steps (u24 BE).
- Records 05/46 (SLEEP): 7 bytes each: ts (4 bytes), mode, soft, strong.

REFERENCE SOURCES (read-only)
- Decompiled Android SMA SDK: ${S}/vendor-sdks/sma/src/com/bestmafen/smablelib/
- iOS SMA SDK: /Users/joao.farias/TechnosWareCore/examples/basic/ios/Pods/SmaTechnosIosSdk/BLEAPI/
- Production Core, Android SMA: /Users/joao.farias/TechnosWareCore/android/src/main/java/com/sma/bluetooth/SMAService.java
- Production Core, iOS SMA: /Users/joao.farias/TechnosWareCore/ios/smaBluetooth/SMAService.m
- Other vendor SDKs, decompiled: ${S}/vendor-sdks/{crp,ido,ute,utert}

HARD RULES
- Treat these as READ-ONLY: /Users/joao.farias/technos-watch-protocol, /Users/joao.farias/react-native-technos-core-next, /Users/joao.farias/TechnosWareCore, /Users/joao.farias/GTE-Mormaii. Do not edit, create or delete anything there. Run no git command that changes state.
- Put your scripts and copies under ${S}/logs-analysis/<your-label>/.
- Run Python with \`python3 -I\`.
- Cite evidence precisely: atMs or ts plus hex for log and frame claims; file:line for code claims.
- Always separate what the data proves from what it only suggests.
`

const FINDINGS = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['hypothesis', 'bug', 'doc-mismatch', 'observation', 'risk', 'untested'] },
          title: { type: 'string' },
          verdict: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low', 'info'] },
          evidence: { type: 'string' },
          recommendation: { type: 'string' },
        },
        required: ['id', 'kind', 'title', 'severity', 'evidence'],
      },
    },
    commands: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, outcome: { type: 'string' } }, required: ['command', 'outcome'] } },
    onDeviceTests: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'findings'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['confirmed', 'refuted', 'partly'] },
          correction: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['id', 'verdict', 'evidence'],
      },
    },
    missed: { type: 'array', items: { type: 'string' } },
  },
  required: ['results'],
}

const IOS = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    answer: { type: 'string' },
    iosPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: { step: { type: 'string' }, scope: { type: 'string' }, effort: { type: 'string' }, exitCriteria: { type: 'string' }, evidence: { type: 'string' } },
        required: ['step', 'scope', 'effort', 'exitCriteria'],
      },
    },
    risks: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, rank: { type: 'integer' }, mitigation: { type: 'string' }, evidence: { type: 'string' } }, required: ['risk', 'rank', 'mitigation'] } },
    alternatives: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, pros: { type: 'string' }, cons: { type: 'string' }, effort: { type: 'string' }, verdict: { type: 'string' } }, required: ['name', 'pros', 'cons', 'verdict'] } },
    recommendedOrder: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'answer', 'iosPlan', 'risks', 'alternatives', 'recommendedOrder'],
}

const STREAMS = [
  {
    key: 'protocol', verify: true, schema: FINDINGS,
    prompt: `${CONTEXT}
YOUR TASK: protocol forensics on the real recording. Use the label "protocol" for your scratch folder.

1. Write your own decoder from scratch; do not reuse anyone else's script. It must:
   - reassemble the packets into frames, per direction;
   - check every CRC;
   - pair each TX request with its ACK and its response;
   - report the latency of each command.
2. Answer each of these:
   - Are all CRCs valid in both directions?
   - Does the watch ever NACK? Did the phone ever NACK?
   - Are there stray packets?
   - Does the 8-byte L1 header arrive in its own notification (H5), or together with the body? What are the fragment sizes, compared with the effective MTU?
   - TX seq: does it reset per connection?
   - RX seq: does the watch keep its own counter across connections?
   - Does the watch ever send unsolicited frames (02/70 DATA_CHANGED, 04/62, anything else)?
   - Does a response ever arrive before its ACK?
   - Are there any retransmissions (evidence for or against H9)?
3. Read /Users/joao.farias/technos-watch-protocol/docs/protocolo-sma.md, especially section 8. Give a verdict on each hypothesis H1-H9: proven, refuted, suggested, or no evidence. Quote the exact frames.
4. Check the scan and configure log lines: advertised services, discovered services (FF60 vs NUS), requested vs effective MTU. Compare them with:
   - docs/protocolo-sma.md;
   - docs/decisoes.md, ADR 5 and ADR 6;
   - the fitGPS quirks in protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/profile/Profiles.kt.
5. List every doc statement in Repo 1 and Repo 2 docs that the recording confirms or contradicts, with file:line.

Return one finding per hypothesis (kind=hypothesis, id H1..H9) and one per other notable fact.`,
  },
  {
    key: 'session', verify: true, schema: FINDINGS,
    prompt: `${CONTEXT}
YOUR TASK: compare the session and transport behaviour in the logs with the code. Use the label "session".

1. Reconstruct the full timeline from the logs: pair, commands, Bluetooth off/on, reconnect, sync, exports. Check each step against:
   - the code: Repo 1 protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/session/SessionEngine.kt, and Repo 2 android/src/main/java/br/com/grupotechnos/corenext/ble/AndroidGattTransport.kt, CoreGraph.kt, CoreSessionListener.kt and NativeCoreNextModule.kt;
   - the documented contracts: Repo 1 docs/arquitetura.md, docs/decisoes.md ADR 12 ("exactly one onDisconnected per disconnect() when a link was open or pending, none otherwise"), and Repo 2 docs/transporte-android.md.
2. Bluetooth-off sequence, about 543 s after the first log line:
   - Count how many onDisconnected the transport delivered to the session, and why.
   - Say whether this violates ADR 12.
   - Find the exact code path, with line numbers.
   - Describe concretely which other timing would turn this into a real bug, for example the session swallowing a real drop or killing a fresh attempt.
3. Also check:
   - the reconnect when Bluetooth comes back on, and the autoConnect usage;
   - the foreground service start and stop around the sync;
   - prune and PendingEvents;
   - the duplicate readDeviceInfo calls;
   - the timing of the automatic post-login setTime (postLoginDelayMs);
   - the sync duration. About 60 s of sleep pages at MTU 23: what does this imply for the foreground service, timeouts and the user experience?
   - every WARN line and anything else unexpected.
4. List what these logs did NOT exercise, so the user knows what is still untested. Examples: Disconnect and Forget (acceptance A7), re-pair, a link drop without Bluetooth off, process death, a JS reload.
5. Classify each finding:
   - bug, with severity and a minimal fix idea;
   - doc-mismatch;
   - observation;
   - untested.`,
  },
  {
    key: 'data', verify: true, schema: FINDINGS,
    prompt: `${CONTEXT}
YOUR TASK: data semantics for steps and sleep. Use the label "data".

STEPS
1. Decode all 05/42 SPORT records.
2. Which modes appear? Find what mode 16, and any other non-zero mode, means:
   - in the Android SDK (SmaSport and wherever the mode constants live);
   - in the iOS SDK;
   - in how production Core treats it.
3. Are mode 0 values cumulative within the hour, cumulative within the day, or deltas?
4. On each 05/41 request:
   - Does the watch return only the records created since the previous read (a cursor)?
   - Does it create a record at read time? Compare each record ts with the request time (header recordedAt plus atMs).
5. Compute what Repo 1's pipeline returns for today from these records: SmaStepsMapper, then the HOURLY_SUM aggregation in session/HistoryStore or StepsAggregator.
6. Compute what it would return under each hypothesis (hour-cumulative vs day-cumulative) once the data spans more than one hour. Quantify the over- or under-count of HOURLY_SUM if the watch is really day-cumulative.
7. Cross-check with how production Core SMAService.java computes the day total (around lines 387-456 and 829-896).
8. Give calories and distance for the observed total, using protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/sma/SmaEstimates.kt.

SLEEP
1. Decode all 05/46 SLEEP records; there are about 1262 over 64 pages.
2. Summarize them: date ranges, modes, duplicates, and odd patterns, such as a START repeated with the same ts and paired with an END whose ts advances.
3. Are they plausible real nights, factory or test data, or a firmware artifact?
4. Apply Repo 1's SmaSleepAnalyzer logic to them, faithfully, by reading the Kotlin source and emulating it exactly.
5. Explain why the log says "read 4 sleep sessions" and then "prune dropped 4 sleep sessions before 2026-09-29", and say what getHistorySleep would emit now.
6. Check how the SDK's analyseSleeps (SmaSleep.java) and production Core would handle this data.
7. Is reading 64 pages on every sync expected? Does the watch clear sleep after a read, and is there any evidence either way? What does it cost?

ON-DEVICE TESTS
Propose a precise test script to close the remaining data hypotheses. Examples:
- walk across an hour boundary;
- run a second sync right after the first, to see whether sleep gets cleared;
- record a real night of sleep;
- read steps right after midnight.
For each test give the steps, what to look for in the export, and which hypothesis it closes.`,
  },
  {
    key: 'replay', verify: false, schema: FINDINGS,
    prompt: `${CONTEXT}
YOUR TASK: replay the real recording through the real Kotlin code, in a COPY of the repo. Use the label "replay".

1. Copy /Users/joao.farias/technos-watch-protocol to ${S}/logs-analysis/replay/repo with rsync. Exclude build/, .gradle/ and .kotlin/; keep gradlew and the gradle/ wrapper.
2. Put the real frames files under the copy's fixtures/real/fitgps/0.2.1/, following the naming in docs/fixtures.md.
3. Run \`./gradlew :protocol:jvmTest\` inside the copy. The fixtures.dir system property is set in protocol/build.gradle.kts relative to the project. Confirm that it points at the copy's fixtures.
4. Report whether RealFixturesReplayTest really replays the real recording and does not skip silently. Check the test XML and stdout for the fixture name.
5. If it fails, diagnose precisely why, and separate a replay-harness limitation from a codec or session bug. Candidate causes:
   - the Bluetooth off/on reconnect in the middle of the file (two connections);
   - MTU 23;
   - the sync reading 64 sleep pages;
   - record timestamps relative to recordedAt;
   - SET_TIME masking.
6. If the harness cannot handle the reconnect, split the recording into per-connection segments (in the copy only) and replay those.
7. In the copy, write a scratch JVM test that feeds the real 05/42 and 05/46 payloads through the real internal code: SmaRecordCodec (or whatever parses records), SmaStepsMapper, the HOURLY_SUM aggregation, and SmaSleepAnalyzer. Print the results (hourly samples, the day total, the sleep sessions with their dayKeys) so other analysts' numbers can be cross-checked. Report them.
8. Never touch the original repo.

Report the exact commands and outcomes. Recommend, as recommendations only, what the user should commit to the real repo: file names, and any harness change needed.`,
  },
  {
    key: 'ios', verify: false, schema: IOS,
    prompt: `${CONTEXT}
YOUR TASK: build a concrete, evidence-based iOS plan. Use the label "ios".

The user asked: "Aparentemente, tudo funcionando bem. O próximo passo natural seria o iOS, certo?" Another agent is weighing the alternatives to iOS. You focus on what iOS would take and how risky it is.

READ
- Repo 2: docs/ios-pendente.md, ios/README.md, react-native-technos-core-next.podspec, CLAUDE.md, docs/arquitetura.md, package.json codegenConfig.
- Repo 1:
  - protocol/build.gradle.kts, for the XCFramework configuration;
  - README.md and CLAUDE.md;
  - the public API in protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/: session/WatchSession.kt, transport/Transport.kt, transport/TransportEvents.kt, log/WatchLogger.kt, session/SampleStore.kt, session/WatchClock.kt;
  - the generated ObjC header, if present: protocol/build/XCFrameworks/release/TechnosWatchProtocol.xcframework/*/TechnosWatchProtocol.framework/Headers/TechnosWatchProtocol.h. Check how ByteArray, Long, List, enums and interfaces appear to Swift.
  - Note whether protocol/src has an iosMain source set.
- Production Core iOS: /Users/joao.farias/TechnosWareCore/ios/smaBluetooth/SMAService.m (CoreBluetooth usage, write types, state restoration, background behaviour), and how TechnosWareCore ships iOS (its podspec, the TurboModule ObjC++ files).
- Mormaii app iOS setup: /Users/joao.farias/GTE-Mormaii/ios/Podfile, and the Info.plist background modes and Bluetooth usage strings.

PRODUCE
1. An iOS plan in steps, each with scope, effort (S/M/L) and exit criteria. Cover:
   - a CBCentralManager transport implementing Transport: queue, write with and without response, maximumWriteValueLength vs MTU on iOS (iOS negotiates MTU by itself), notifications, connect and autoreconnect semantics (CoreBluetooth has no autoConnect, but a pending connect does not time out), state restoration with a restore identifier, the bluetooth-central background mode;
   - Kotlin/Native interop: callbacks from the CoreBluetooth queue into WatchSession, which uses Dispatchers.Default.limitedParallelism(1) (check that this is available and sane on K/N 2.1.20); the memory model; ByteArray to and from NSData, and KotlinByteArray in Swift; whether an iosMain helper is needed;
   - the RN new-arch TurboModule on iOS: an ObjC++ module conforming to the codegen spec, a Swift or ObjC transport, how the static XCFramework gets into the pod (vendored_frameworks) and builds with the RN 0.81 codegen;
   - SampleStore and PairingPrefs on iOS;
   - the example app on iOS: Podfile, signing, a physical iPhone (simulators have no BLE);
   - exporting logs on iOS (Files app or UIActivityViewController).
2. The big risks and unknowns, ranked, each with a mitigation.
3. A direct answer to the user's question from the iOS side: what the PoC has de-risked for iOS, and what it has not.

Be concrete. Do not simply agree with the user.

Return the alternatives field as an empty array. Set recommendedOrder to the iOS steps in order.`,
  },
  {
    key: 'alternatives', verify: false, schema: IOS,
    prompt: `${CONTEXT}
YOUR TASK: decide what the next step should be. Use the label "alternatives".

The user asked: "Aparentemente, tudo funcionando bem. O próximo passo natural seria o iOS, certo?" Another agent is detailing the iOS plan. You compare iOS against the other candidates and recommend an order.

The strategic goal, from earlier conversations: one in-house SDK that talks to every watch family (today there are SMA, iDO, UTE, UTE-RT and CRP vendor SDKs), and a new thin Core that no longer branches per vendor. The current Core (TechnosWareCore) is a 5-year-old TurboModule with one Service per vendor, no tests, and painful SDK conflicts. KMP was chosen so that Android and iOS share one codebase. The PoC covered only SMA on Android.

CANDIDATES (add others if you find them)
- A) Close the Android hypotheses and bugs that only the watch can answer, and commit the real fixture to the repo.
- B) Integrate core-next into the Mormaii app (/Users/joao.farias/GTE-Mormaii), for fitGPS on Android behind a flag, to prove the migration path. Look at how the app uses the Core today: src/services/Smartwatch.ts, src/constants/index.ts, and src/store/LowerLevelContext/SyncHandlerStoreContext/. Compare with the core-next API in /Users/joao.farias/react-native-technos-core-next/docs/api-js.md, and estimate the gap (events, getNativeEventData, deviceConnectStates, data shapes, polling of live steps, which the current Core does every 10 s).
- C) iOS for SMA.
- D) A second watch family, to prove the multi-vendor driver abstraction. Check which family is cheapest by looking at ${S}/vendor-sdks/{crp,ido,ute,utert}:
  - Is the protocol in Java/Kotlin, or in a native .so?
  - Is there a CRC or framing similar to SMA?
  - How many devices in the Mormaii catalog use it? See src/constants/index.ts in GTE-Mormaii.
  - Which families also exist on iOS in TechnosWareCore/ios?

RECOMMENDATION
For each candidate give pros, cons, effort and a verdict. Then give a recommended order with rationale.
- Think about de-risking: which unknowns are the biggest threat to the whole idea (one KMP codebase for all watches on both platforms)?
- Think about what the current Android PoC still has not proven.
- Keep in mind that a physical watch and a physical phone are needed for every on-device step.

Return iosPlan as an empty array and risks as the risks of the overall programme.`,
  },
]

phase('Analyze')
const results = await pipeline(
  STREAMS,
  s => agent(s.prompt, { label: `analyze:${s.key}`, phase: 'Analyze', schema: s.schema }),
  (out, s) => {
    if (!s.verify || !out) return { key: s.key, out, verdicts: null }
    return agent(`${CONTEXT}
YOUR TASK: adversarial verification. Use the label "verify-${s.key}".

Another analyst produced the findings below from the same recording and code. Re-derive each finding INDEPENDENTLY from the raw files and the source code; do not trust their evidence text. Write your own small scripts where needed.

For each finding id, return a verdict:
- confirmed: you reproduced it;
- refuted: the claim is wrong;
- partly: overstated, imprecise, or the severity is wrong. Give the correction.

Be strict:
- a claim that the data only suggests, but that is stated as proven, is "partly";
- a bug claim must point to a real code path that produces it.

Also list anything important the analyst missed.

FINDINGS:
${JSON.stringify(out, null, 1)}`, { label: `verify:${s.key}`, phase: 'Verify', schema: VERDICTS }).then(v => ({ key: s.key, out, verdicts: v }))
  },
)

phase('Synthesize')
const bundle = results.filter(Boolean)
const synth = await agent(`${CONTEXT}
YOUR TASK: synthesis and completeness critique. Use the label "synth". You receive the outputs of six analysis streams; three of them also carry adversarial verdicts. Use only claims that survived verification. Drop refuted ones, and use the corrected wording for "partly". You may open the raw files to settle a conflict.

PRODUCE
1. The status of acceptance criteria A1-A8 and of the exploratory sleep check, based on what the logs and the replay prove. The criteria are listed in /Users/joao.farias/react-native-technos-core-next/example/README.md and in the plan file /Users/joao.farias/.claude/plans/wobbly-nibbling-yao.md, section "Critérios de aceite". Mark each one proven, partial or untested, with evidence.
2. The final verdicts on H1-H9.
3. Bugs and doc mismatches, ranked, each with a minimal fix.
4. The on-device tests still needed, merged and deduplicated, in an efficient order (one session with the watch, if possible).
5. A clear recommendation answering "is iOS the natural next step?", with an ordered plan of the next steps. Reconcile the iOS stream and the alternatives stream; if they disagree, say why and choose.
6. A completeness critique: what is still unverified or missing from this analysis.

Be concise and concrete. Return markdown in Portuguese (the team is Brazilian). Keep identifiers, file names and codes in English.

STREAM OUTPUTS:
${JSON.stringify(bundle, null, 1)}`, { label: 'synthesize', phase: 'Synthesize' })

return { streams: bundle, synth }
