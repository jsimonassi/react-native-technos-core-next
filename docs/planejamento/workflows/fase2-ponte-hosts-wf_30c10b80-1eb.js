export const meta = {
  name: 'fase2-ponte-hosts',
  description: 'Phase 2 part B: CoreBridge 24 methods + events (Repo 1), Android and iOS hosts (Repo 2), end-to-end bridge tests, final publish/rebuild, review and fixes',
  phases: [
    { title: 'Ponte', detail: 'S5a: CoreBridge, mappers, câmera, clima; publica o snapshot (Maven local + XCFramework)' },
    { title: 'Hosts', detail: 'S5b ponta a ponta (Repo 1) ∥ S7 Android ∥ S8 iOS (Repo 2)' },
    { title: 'Publicação', detail: 'publicação final do Repo 1 e rebuild Android/iOS' },
    { title: 'Revisão', detail: 'paridade com Condor/produção, hosts nativos, docs/desvios/privacidade' },
    { title: 'Correções', detail: 'aplica achados, fecha desvios, roteiro de validação, todos os portões' },
  ],
}

const SCR = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const SPEC = `${SCR}/fase2/spec.json`
const RESEARCH = `${SCR}/fase2/research.json`
const DEC = `${SCR}/fase2/decisoes-usuario.md`
const HANDOFF = `${SCR}/fase2/parteA-handoff.json`
const DEV = `${R2}/docs/desvios-de-producao.md`

const RULES = `
HARD RULES (every agent):
- Never run git add/commit/stash/reset/checkout/restore/clean/rebase, never git init. Read-only git (status, diff, log, show <tag>:<path>) is fine. Everything stays in the working tree; the user commits.
- Only modify files inside ${R1} and ${R2}. Read-only: /Users/joao.farias/TechnosWareCore (production Core; the Condor pins tag v4.3.57, read it with git -C /Users/joao.farias/TechnosWareCore show v4.3.57:<path>), /Users/joao.farias/GTE-CondorSmart (production Condor app), /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/CrpTechnosIosSdk, /Users/joao.farias/CRPBleSdkSample, ${SCR}/vendor-recheck and ${SCR}/vendor-sdks (decompiled vendor SDKs; vendor-recheck/src is the populated crpblelib 2.0.3 copy).
- Do not touch the user's exports at the Repo 2 root (frames-*.jsonl, logs-*.jsonl) nor corenext-export/; never copy recordings, logs or HCI captures into a repo.
- Privacy: never write a MAC address, phone/iPhone names, nearby device names, or real personal data. Tests and examples use fictitious values. The HCI reference capture has private payloads (0x12 profile, 0x41 notification text, 0x42/0x43/0xB5 weather/location): never quote them.
- Repos' conventions (each repo's CLAUDE.md is already in your context or read it first): docs, KDoc and comments in Brazilian Portuguese; identifiers in English; tabs; Repo 2 docs wrap at 120 columns; KDoc on every public Kotlin symbol (dokkaHtml fails otherwise); public Kotlin API without suspend/Flow/value class/kotlinx-datetime (ObjC header check).
- The working tree already holds uncommitted phase 2 part A work in both repos (S1-S4 protocol, S6 JS contract, deviations doc, docs). Keep it; build on top.
- Other agents may edit other files of the same repos concurrently. Re-read any shared doc (desvios-de-producao.md, arquitetura.md, pendencias.md, api-js.md, READMEs) immediately before each edit and edit only your part.
- If you deviate from the spec, say so with the reason. Never claim a check you did not run; report failing commands with their output.
`

const CONTEXT = `
CONTEXT: Phase 2 of the CRP port (Condor Reebok, BLE name P85, firmware MOY-VS02-2.0.0). Repo 1 = ${R1} (KMP :protocol + :bridge); Repo 2 = ${R2} (TurboModule: Android/iOS hosts, JS, example app). The goal is that the production Condor app (GTE-CondorSmart) can later swap TechnosWareCore v4.3.57 for Core Next with the same JS names/arguments/events.
- APPROVED SPEC: ${SPEC} (cutLine, decisions D1..D19, commands, api, platform, tests, docs, workSlices S5a/S5b/S7/S8, validationChecklist, risks). Decisions are binding. Vendor research with sources: ${RESEARCH}.
- USER DECISIONS after the spec (binding): ${DEC}. Short: Android notification forwarding is a later slice (not now; checkIsNotificationServiceEnabled resolves true meanwhile); find phone = option A (JS event onFindPhone only); background camera on Android out; calls HFP only (+ Force pendency); weather geolocation in phase 4; FACTORY RESET = separate method resetDevice (Core name), WatchAction.FactoryReset → CRP 51 02, SMA/iDO reject NOT_SUPPORTED; forget never resets. EVERY behavior that differs from production goes into ${DEV} (entry format and numbering rules are at the top of that file; next id = highest DP-nn in the document + 1; currently DP-94 is the highest).
- PART A IS DONE (all gates green): handoff with each slice's summary, spec deviations, open points (many addressed to S5/S5a/S5b/S7/S8: SettingsMapper rules, NotificationKeys, WeatherMapper, alarm mapping, camera state machine, weather resend after setTemperatureUnit, resetDevice mapping, onWatchEvent → events with queueIfNotReady=false, api-js.md reconciliation) and the review findings: ${HANDOFF}. Read it in full before starting.
- The JS contract (S6) already exists in Repo 2: src/specs/NativeCoreNext.ts (24 phase 2 methods = the spec's 23 + resetDevice, plus 4 events onFindPhone {status:'1'|'0'}, onTakeAPicture, onOpenCameraMode, onDeviceRequestedCameraMode), src/index.ts, src/types/watchSettings.ts, docs/api-js.md, the example 'Ajustes' tab. Repo 2's native Android/iOS builds do not compile against that spec until S7/S8 implement it.
`

const SLICE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'red'], description: 'green = everything compiles and the gate commands you ran pass' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsRun: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
    deviations: { type: 'array', description: 'Behaviors you implemented that differ from production (TechnosWareCore v4.3.57 / Condor), with sources', items: { type: 'object', properties: { title: { type: 'string' }, production: { type: 'string' }, coreNext: { type: 'string' }, reason: { type: 'string' }, recordedInDoc: { type: 'boolean' } }, required: ['title', 'production', 'coreNext', 'reason', 'recordedInDoc'] } },
    specDeviations: { type: 'array', items: { type: 'string' } },
    mainCodeChangedInRepo1: { type: 'boolean', description: 'true if you changed any non-test source under Repo 1 protocol/ or bridge/ (commonMain/iosMain/androidMain/jvm*)' },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'filesChanged', 'testsRun', 'deviations', 'specDeviations', 'mainCodeChangedInRepo1', 'openPoints'],
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
    deviationsAdded: { type: 'array', items: { type: 'string' } },
    gateResults: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
    validationScript: { type: 'string', description: 'Where the Tuesday validation checklist lives (file + anchor) and a short list of its scenarios' },
    filesChangedTotal: { type: 'object', properties: { repo1: { type: 'array', items: { type: 'string' } }, repo2: { type: 'array', items: { type: 'string' } } }, required: ['repo1', 'repo2'] },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'applied', 'rejected', 'deviationsAdded', 'gateResults', 'validationScript', 'filesChangedTotal', 'openPoints'],
}

const devTail = `Record every behavior you introduce that differs from production in ${DEV} (re-read right before editing; append under the right section with the next free DP id and an index row), or return it in deviations with recordedInDoc=false if you could not.`

const brief = (x) => x && { status: x.status, summary: x.summary, filesChanged: x.filesChanged, specDeviations: x.specDeviations, mainCodeChangedInRepo1: x.mainCodeChangedInRepo1, openPoints: x.openPoints }

// ---------------- S5a ----------------
phase('Ponte')
const s5a = await agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S5a in Repo 1 (:bridge) as spec.workSlices[S5a] + spec.api (CoreBridge part) + the decisions it references (D5, D6, D7 SettingsMapper with per-method keys and NSNull handling, D10 weather cache/resend, D11 camera state machine, D13 NotificationKeys, D15 profile in memory, D18 compat). Differences from the spec text, because S2-S4 are already done: the CRP writers are real (not stubs), and there are 24 methods, not 23 — add resetDevice → session.perform(WatchAction.FactoryReset) (SMA/iDO reject NOT_SUPPORTED from the session; reject NOT_READY when not connected like the other methods per D5/D8).
Do: the 24 CoreBridge methods with the exact JS names from Repo 2 src/specs/NativeCoreNext.ts; SettingsMapper, NotificationKeys, WeatherMapper (+ the iosMain/jvmShared isNullLike actuals); onWatchEvent → onFindPhone {status:'1'|'0'}, onTakeAPicture, onDeviceRequestedCameraMode (no queue when JS is not ready); onOpenCameraMode after the 66 write and before resolve; closeCameraMode while disconnected resolves without writing; EventMapper.findPhone; the open points addressed to S5/S5a/the bridge in the handoff (each S2/S3/S4/S6 openPoints entry mentioning S5, bridge, SettingsMapper, NotificationKeys, WeatherMapper, alarm mapping, weather resend, resetDevice, camera). Reconcile with Repo 2 docs/api-js.md (written by S6 from the spec): method names, accepted argument shapes, rejection codes and messages, gender ''/unknown handling. If api-js.md and your bridge disagree, decide by the spec + production behavior and fix the side that is wrong (you may edit Repo 2 docs/api-js.md and src/ TSDoc for this only; no Repo 2 native code).
Tests: SettingsMapperTest, NotificationKeysTest, iosTest SettingsMapperNullTest, and the controller cases that do not depend on CRP bytes (NOT_READY, INVALID_ARGUMENT, NOT_SUPPORTED with SMA/iDO, camera with simulated events, resetDevice routing). S5b (next agent) adds the end-to-end CRP-byte cases and the golden, so do not write those.
Update bridge/swift-interop/MinimalHost.swift and bridge/objc-interop/MinimalTurboModule.mm with the new methods/selectors (the interop checks run in the gate). Docs: docs/arquitetura.md §13, an ADR in docs/decisoes.md for the JS rules (next ADR number), bridge/README.md.
FINISH WITH (mandatory, this snapshot unblocks the Android and iOS hosts): cd ${R1} && ./gradlew check dokkaHtml publishToMavenLocal assembleTechnosWatchProtocolXCFramework — all must succeed; confirm the phase 1 strict replays (CrpRealFixturesReplayTest, CoreBridgeGoldenTest, SMA/iDO) are still green. Return status red with the failing output if not. ${devTail}`, { label: 'S5a:ponte', phase: 'Ponte', schema: SLICE_SCHEMA })

log(`S5a ${s5a ? s5a.status : 'null'}`)
if (!s5a || s5a.status !== 'green') {
  return { stoppedAt: 'S5a', s5a }
}

// ---------------- S5b ∥ S7 ∥ S8 ----------------
phase('Hosts')
const s5aBrief = JSON.stringify(brief(s5a))
const [s5b, s7, s8] = await parallel([
  () => agent(`${RULES}\n${CONTEXT}\nS5a (bridge) just finished and published the snapshot; its report: ${s5aBrief}\nTASK: implement slice S5b in Repo 1 as spec.workSlices[S5b]: the end-to-end controller cases with CRP bytes in CoreBridgeSettingsTest, CoreBridgeMessagesTest and CoreBridgeInteractionsTest (JS-shaped input → exact TX bytes on the simulator → resolve/reject/event, including resetDevice → 51 02, camera echo, find phone events, weather resend after setTemperatureUnit, optional replies missing), and the new golden scenario bridge/golden/condorreebok-phase2.txt in CoreBridgeGoldenTest (fictitious values only). Golden expectations must come from independent sources (the vectors already checked in protocolo-crp.md §12 / the protocol golden tests), never from running our encoder and pasting its output.
Also in Repo 1 docs (the part A fix agent left these open): add the per-symbol phase 2 validation list to docs/pendencias.md (Condor/CRP section) and the phase 2 unknowns to docs/protocolo-crp.md §13 (A4 echo and its 2nd byte, 8C 01 for °F, 18/72, 75 layout, water count 0, B9 14 00 reply, BB 00 03 vs 05, F2 00, F2 EF ack id/latency, F2 FE acks, '+' in numbers, 43 vs B5 on screen, B9 05 types, 61/66/53/62 bytes, behavior after 51 02, RX 67 music) — gather them from the handoff openPoints.
CONCURRENCY: two other agents are building Repo 2 (Android and iOS) against the published snapshot right now. Do NOT run publishToMavenLocal, assembleTechnosWatchProtocolXCFramework or ios/scripts/sync-xcframework.sh; the next agent republishes. Avoid changing Repo 1 main code; if a test reveals a real bridge/protocol bug, fix it (keep the public API stable if at all possible), set mainCodeChangedInRepo1=true and describe the change.
Gate: cd ${R1} && ./gradlew check dokkaHtml (report test counts per target; phase 1 strict replays still green). ${devTail}`, { label: 'S5b:ponta-a-ponta', phase: 'Hosts', schema: SLICE_SCHEMA }),

  () => agent(`${RULES}\n${CONTEXT}\nS5a (bridge) just finished and published the snapshot to Maven local; its report: ${s5aBrief}\nTASK: implement slice S7 (Repo 2 Android host) as spec.workSlices[S7] + spec.platform (Android): NativeCoreNextModule.kt overrides for all 24 phase 2 methods of the codegen spec (thin: ReadableMap → toMap, ReadableArray → toList, pass to the CoreBridge exactly as the other methods do), the 4 new events in the emit() dispatch, ReadableConverterTest (nested arrays of maps, null element), android bridge/README.md, docs/arquitetura.md (casca), docs/transporte-android.md only if behavior changed. Keep the module thin: no protocol or JS rules in Kotlin here (they live in the CoreBridge).
Gates (cd ${R2}/example/android): ./gradlew --refresh-dependencies :react-native-technos-core-next:generateCodegenArtifactsFromSchema :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug ; confirm with ./gradlew :app:dependencies --configuration debugRuntimeClasspath | grep grupotechnos ; then in ${R2}/example: npm test.
CONCURRENCY: another agent is editing Repo 1 tests and running its Gradle right now, and another is working on Repo 2 ios/ and example/ios. Do NOT edit Repo 1, ios/ or example/ios, and do NOT run Gradle in Repo 1 or publishToMavenLocal. If you find a bridge bug, report it in openPoints with file:line instead of editing Repo 1. ${devTail}`, { label: 'S7:android', phase: 'Hosts', schema: SLICE_SCHEMA }),

  () => agent(`${RULES}\n${CONTEXT}\nS5a (bridge) just finished, published to Maven local and assembled the XCFramework (bridge/build/XCFrameworks/release/ in Repo 1); its report: ${s5aBrief}\nTASK: implement slice S8 (Repo 2 iOS host) as spec.workSlices[S8] + spec.platform (iOS): copy the framework with ${R2}/ios/scripts/sync-xcframework.sh (WITHOUT --build), pod install in example/ios (runs the iOS codegen for the new spec), RCTNativeCoreNext.mm with the 24 phase 2 selectors calling TWPCoreBridge (NSDictionary/NSArray passed as they arrive; NSNull is handled by the bridge's isNullLike) and the 4 new events in the emitName: dispatch, ios/Tests/TechnosCoreNextTests/TxMaskers.swift with the private TX and the D14 redaction prefixes (the protocol's CrpTxMasker is the reference), ios/CoreNext/turbomodule/README.md, docs/ios-pendente.md. Keep the host thin.
Gates (Repo 2 CLAUDE.md): host tests on the simulator (xcodebuild test -scheme TechnosCoreNext from ios/, destination by UDID from xcrun simctl list devices available, never by name), the example simulator Debug build and the iPhone Release build without signing; in ${R2}/example: npm test. Phase 1 IOS-REPLAY lines must still pass.
CONCURRENCY: another agent is editing Repo 1 tests and running its Gradle right now, and another is working on Repo 2 android/ and example/android. Do NOT edit Repo 1, android/ or example/android, do NOT run Gradle in Repo 1 and do NOT run sync-xcframework.sh --build. If you find a bridge bug, report it in openPoints with file:line instead of editing Repo 1. ${devTail}`, { label: 'S8:ios', phase: 'Hosts', schema: SLICE_SCHEMA }),
])
log(`S5b ${s5b ? s5b.status : 'null'} | S7 ${s7 ? s7.status : 'null'} | S8 ${s8 ? s8.status : 'null'}`)

// ---------------- publicação final ----------------
phase('Publicação')
const hostReports = JSON.stringify({ s5a: brief(s5a), s5b: brief(s5b), s7: brief(s7), s8: brief(s8) })
const pub = await agent(`${RULES}\n${CONTEXT}\nS5a, S5b, S7 and S8 just ran (S5b, S7 and S8 in parallel; S7/S8 built against the S5a snapshot). Reports: ${hostReports}
TASK: final publish and rebuild, then make everything green together.
1) cd ${R1} && ./gradlew check dokkaHtml publishToMavenLocal assembleTechnosWatchProtocolXCFramework
2) Android (cd ${R2}/example/android): ./gradlew --refresh-dependencies :react-native-technos-core-next:generateCodegenArtifactsFromSchema :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug and the :app:dependencies grep for grupotechnos.
3) iOS: ${R2}/ios/scripts/sync-xcframework.sh, pod install in example/ios, host tests on the simulator by UDID, the example simulator Debug build and the iPhone Release build without signing.
4) JS (cd ${R2}/example): npm test, npx tsc --noEmit, npm run typecheck at the root, ESLint app + library, Prettier library.
If something fails because of drift between the parallel slices (e.g. S5b changed bridge code that S7/S8 compiled against, or a slice reported red), fix it minimally in the right repo and rerun the affected steps. Anything a slice reported as red or as an open bridge bug: verify and fix it here if it is small and clear; otherwise report it. Return status green only if all four steps pass. ${devTail}`, { label: 'publicação', phase: 'Publicação', schema: SLICE_SCHEMA })
log(`publicação ${pub ? pub.status : 'null'}`)

// ---------------- revisão ----------------
phase('Revisão')
const reports = JSON.stringify({ s5a: brief(s5a), s5b: brief(s5b), s7: brief(s7), s8: brief(s8), pub: brief(pub) })
const LENSES = [
  { key: 'paridade', prompt: `LENS: CONDOR AND PRODUCTION PARITY OF THE BRIDGE. For each of the 24 phase 2 methods and the 4 events: (a) find every call site in the Condor app (/Users/joao.farias/GTE-CondorSmart/src, e.g. services/Smartwatch.ts and the screens/hooks that build the arguments) and check that the CoreBridge/SettingsMapper accepts exactly the shapes the Condor sends (keys, string vs number, optional/null fields, empty arrays) and that the events carry the names and payload shapes the Condor listens to; (b) compare with production at TechnosWareCore v4.3.57 (android NativeCoreModule.kt / CRPService.java / CRPUserSettingsManager.java / managers; ios CRPService.m / CRPUserSettings.m / managers): same watch effect, same resolve/reject outcome, same event order. Every difference must either be a documented DP entry in ${DEV} or a finding (bug to fix, or missing DP entry with the production source).` },
  { key: 'hosts', prompt: `LENS: NATIVE HOSTS AND ENGINEERING. Run all gates: Repo 1 ./gradlew check dokkaHtml; Repo 2 Android (example/android: :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug), iOS (host tests on the simulator by UDID, the example simulator Debug build, iPhone Release unsigned), JS (npm test, both typechecks, ESLint app + library, Prettier library). Review: NativeCoreNextModule overrides and ReadableConverter (null, nested arrays, numbers as Double), event emission thread and names; RCTNativeCoreNext.mm selectors vs the codegen protocol (argument types, NSNull), emitName: dispatch; MinimalHost.swift / MinimalTurboModule.mm parity with the real hosts; TxMaskers vs CrpTxMasker redaction; exactly one terminal (resolve or reject) per JS call; SMA and iDO paths unaffected (phase 1 replays on JVM and iOS host). Report test counts.` },
  { key: 'docs-desvios', prompt: `LENS: DOCS, DEVIATIONS, PRIVACY, SCOPE, VALIDATION READINESS. (1) Repo 1 docs (arquitetura §13, decisoes ADRs, protocolo-crp §13, pendencias, bridge/README) and Repo 2 docs (api-js.md, arquitetura.md, ios-pendente.md, transporte-android.md, pendencias.md, READMEs, CLAUDE.md scope paragraph): accurate, sourced, consistent with the final code; hypotheses labeled. (2) ${DEV}: covers every deviation introduced in S5a/S5b/S7/S8 (slices' deviations with recordedInDoc=false especially), production claims verified at v4.3.57 / Condor; numbering/index consistent. (3) The Tuesday validation checklist in ${R2}/example/README.md (phase 2 section) matches the final behavior of the example app and covers spec.validationChecklist plus: what the watch does after 51 02 (reboot, link drop, BLE/classic bond loss, re-pair needed), whether the P85 sends RX 67 for music (D19), the F2 EF ack id/latency (DP-53), one export per scenario (fase2-ajustes, fase2-mensagens, fase2-interacoes) on Android and iPhone. (4) Privacy: no MAC-like strings, no real personal data, no private HCI payloads. (5) Scope: nothing committed, nothing changed outside the two repos, user's exports untouched; Portuguese, tabs, 120 columns in Repo 2 docs.` },
]
const verdicts = await parallel(LENSES.map(l => () => agent(`${RULES}\n${CONTEXT}\nThe slices below were just implemented by other agents. Reports: ${reports}\n${l.prompt}\nREAD-ONLY: do not edit files (you may run builds/tests; do not run publishToMavenLocal, assembleTechnosWatchProtocolXCFramework, sync-xcframework.sh or pod install, since other reviewers build concurrently). Report only real, evidenced problems with file:line and a concrete fix; an empty findings list is fine.`, { label: `review:${l.key}`, phase: 'Revisão', schema: VERIFY_SCHEMA })))
const findings = verdicts.filter(Boolean).flatMap((v, i) => v.findings.map(f => ({ ...f, lens: LENSES[i].key })))
log(`${findings.length} achados de ${verdicts.filter(Boolean).length} revisores`)

// ---------------- correções ----------------
phase('Correções')
const pendingDev = [s5a, s5b, s7, s8, pub].filter(Boolean).flatMap(s => s.deviations.filter(d => !d.recordedInDoc))
const fix = await agent(`${RULES}\n${CONTEXT}\nTASK: close phase 2 implementation (part B). Slice reports: ${reports}
1) For each review finding below, verify the evidence yourself; apply it if real (code, tests or docs), reject with an evidence-based reason if not. High severity first.
2) Record in ${DEV} every deviation the slices reported with recordedInDoc=false (verify each against production first): ${JSON.stringify(pendingDev)}
3) Make sure the Tuesday validation checklist in ${R2}/example/README.md (phase 2 section) is complete and matches the final app: Android and iPhone, one export per scenario (fase2-ajustes, fase2-mensagens, fase2-interacoes; Export before each Clear; only the latest frames-*.jsonl of each scenario is kept; logs-*.jsonl never), every item of spec.validationChecklist, plus behavior after 51 02 (do it last in the session; reboot, link drop and timing, BLE/classic bond loss, whether re-pairing is needed), RX 67 for music (D19), F2 EF ack id/latency (DP-53). Keep it in Portuguese and practical (what to tap, what to look at on the watch, what to write down).
4) Run the full gates and report results: Repo 1 ./gradlew check dokkaHtml publishToMavenLocal assembleTechnosWatchProtocolXCFramework; Repo 2 Android (example/android: --refresh-dependencies :react-native-technos-core-next:testDebugUnitTest :react-native-technos-core-next:lintDebug :app:assembleDebug), iOS (sync-xcframework.sh, pod install, host tests on the simulator by UDID, example simulator Debug build, iPhone Release unsigned), JS (npm test, both typechecks, ESLint app + library, Prettier library). Leave everything green, or return status red with the failing output.
5) List the final changed/untracked files in both repos (git status --short) and confirm no MAC-like string appears in git diff or untracked files of either repo.
FINDINGS: ${JSON.stringify(findings)}`, { label: 'correções', phase: 'Correções', schema: FIX_SCHEMA })

return {
  s5a: brief(s5a), s5b: brief(s5b), s7: brief(s7), s8: brief(s8), pub: brief(pub),
  findings,
  fix,
}
