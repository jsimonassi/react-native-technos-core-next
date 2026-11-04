export const meta = {
  name: 'plan-sma-poc',
  description: 'Explore SMA SDKs, current Core and Basic app, then design the two-repo PoC plan',
  phases: [
    { title: 'Explore', detail: 'SMA protocol, Core SMA path, Basic app + JS spec, Mormaii app usage' },
    { title: 'Design', detail: 'one architect drafts the plan' },
    { title: 'Critique', detail: 'feasibility review against the facts' },
  ],
}

const SCRATCH = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const CORE = '/Users/joao.farias/TechnosWareCore'
const APP = '/Users/joao.farias/GTE-Mormaii'

const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'string', description: 'Dense technical findings in Portuguese, with file:line evidence. No fluff.' },
    key_files: { type: 'array', items: { type: 'string' } },
    open_questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'key_files', 'open_questions'],
}

const COMMON = `You are READ-ONLY (plan mode): never edit, write or run anything that changes state. Report facts with file paths and line numbers. Answer in Portuguese (pt-BR). Be exhaustive on the asked scope and silent on everything else. Return raw findings, not a message to a human.`

phase('Explore')
const explores = await parallel([
  () => agent(`${COMMON}
GOAL: Document the SMA smartwatch BLE protocol well enough to reimplement a minimal client (pair/bind, device info + battery, set time, daily steps sync, sleep sync, disconnect) WITHOUT the vendor SDK.
SOURCES (both are the same vendor "bestmafen"/SMA):
- Android decompiled Java: ${SCRATCH}/vendor-sdks/sma/src  (packages com/bestmafen/smablelib and com/bestmafen/easeblelib). Start at SmaManager.java, SmaBleHelper.java (cmdCRC), SmaConsts.java, server/constants/*, SmaMessenger.java, EaseConnector.java.
- iOS Objective-C source: ${CORE}/examples/basic/ios/Pods/SmaTechnosIosSdk  (BLEAPI/SmaBLE.m, SmaBusinessTool.m, BT/, DfuUpdate/).
REPORT, with byte offsets and hex values:
1. GATT: service UUID(s), write characteristic, notify characteristic, CCCD handling, MTU requests, write type (with/without response), fragmentation rules.
2. Frame format: header bytes, length field (which bytes, endianness), CRC16 (algorithm/table name, which bytes covered, where stored — SmaBleHelper.cmdCRC puts it at res[4..5]), command/key fields, sequence id, ACK/NACK (SmaBusinessTool setAckCmdSeqId), multi-packet reassembly.
3. Connection handshake after GATT connect: exact ordered command sequence SmaManager sends (login/bind/user id?, time, unit settings, etc.) and what the watch replies; any "bind confirm on watch" step; how disconnect is detected; reconnection logic in EaseConnector (autoConnect flag, retries).
4. The commands and payload layouts for: device info/firmware version, battery, set time (timezone/DST), real-time steps, daily step history (SmaSportHisInfo or similar), sleep history (segments, states), and how "sync done" is signalled.
5. Any encryption/auth: confirm none beyond CRC, or document it.
6. Differences Android vs iOS implementations that reveal protocol variants (e.g. different watch generations, 'ff60' vs other services).
7. OTA: just name the mechanism (OtaHelper crc16_ccitt, DfuUpdate Nordic) — we will NOT implement it.
8. Known quirks the SDK works around (delays between packets, retries, MTU).`, { label: 'explore:sma-protocol', phase: 'Explore', agentType: 'Explore', schema: FINDINGS }),

  () => agent(`${COMMON}
GOAL: Document how the CURRENT Core (react-native-technos-ware-core, ${CORE}) handles SMA watches end to end, so a new Core can keep behaviour parity for the PoC.
SOURCES: ${CORE}/android/src/main/java/com/sma/bluetooth/ (SMAService.java, activitymanagerv2/, any sync/history managers), ${CORE}/android/src/main/java/com/reactlibrary/ (SDKService.java interface, SDKServiceManager, AutomaticPairingManager, TechnosForegroundService, NotificationListener, SDKUtils), ${CORE}/android/src/main/java/br/com/grupotechnos/libs/core/NativeCoreModule.kt, and iOS ${CORE}/ios/smaBluetooth/ (SMAService.m/.h) plus ${CORE}/ios/reactlibrary/ where the RN bridge lives.
REPORT:
1. Pairing flow for SMA: scan (filters, name prefixes used to recognise SMA), connect, bind, what is persisted (last paired device, MAC/UUID), events emitted to JS, error paths.
2. Sync flow: which SMA SDK APIs are called for steps and sleep, in which order, how results are mapped to the Core's entities, and the exact JSON shape emitted to JS for pedometer and sleep (field names!). Point to the classes/methods.
3. The subset of the SDKService interface actually used for SMA (list method names) and which ones are no-ops.
4. How the Core currently keeps the connection on Android (foreground service start points, START_STICKY, onHostResume) and iOS (CBCentralManager owner in SMAService.m:48, restoration key, retrievePeripherals).
5. Logging: LogHelpers usage pattern — how logs are structured (provider, sdk, context, dictionary) so the new repo can keep compatible diagnostics.
6. Anything SMA-specific that smells like a firmware quirk workaround (delays, retries, special handling per model).
7. Where the JS API surface is defined: ${CORE}/src (TypeScript spec for codegen, NativeCoreSpec). List the method and event names related to scan/pair/connect/device info/battery/pedometer/sleep with their signatures.`, { label: 'explore:core-sma-path', phase: 'Explore', agentType: 'Explore', schema: FINDINGS }),

  () => agent(`${COMMON}
GOAL: Document the Core's example app "Basic" (${CORE}/examples/basic) and the Core's build/packaging so a new repo can offer an equivalent test app.
REPORT:
1. examples/basic structure: screens/components, how it links the local Core (package.json path dependency? metro config? podfile?), RN version, how it is launched (scripts), what it lets a tester do (scan, pair, sync, logs?). List the files.
2. Core packaging: ${CORE}/package.json (codegenConfig, scripts, peerDeps), ${CORE}/android/build.gradle (how vendor jars/aars are consumed: libs/, maven-deps flatDir/maven local), ${CORE}/*.podspec (dependencies, vendored pods from github Radix-Technos), ${CORE}/react-native.config.js if any, TurboModule registration (Android package class, iOS RCT module), new-arch specifics.
3. Existing tests in the Core (any jest/junit/XCTest?) and lint/format configs.
4. How the Mormaii app consumes the Core (${APP}/package.json dependency form, ${APP}/android/settings.gradle or build.gradle references, ${APP}/ios/Podfile lines mentioning technos-ware-core and the four *TechnosIosSdk pods).
5. Gradle/Kotlin/AGP/Gradle-wrapper versions in Core and App (for KMP compatibility), minSdk/compileSdk, Java toolchain, iOS deployment target, use_frameworks linkage.
6. Any CI config (azure-pipelines*.yml, .github) in Core or App.`, { label: 'explore:basic-and-packaging', phase: 'Explore', agentType: 'Explore', schema: FINDINGS }),

  () => agent(`${COMMON}
GOAL: Document how the Mormaii React Native app (${APP}/src) identifies SMA watches and consumes pairing + pedometer + sleep data from the Core, so the new Core's JS surface for the PoC can be shaped to fit.
REPORT:
1. Device catalogue: where models are listed (remote config? constants?), how a model maps to an SDK/vendor (fields like sdkType/deviceType), which models are SMA and their BLE name prefixes/images. Look in src/store/TopLevelContext (pairing, remote config), src/@types, src/types, src/constants, src/helpers.
2. Pairing UI → Core calls: which Core methods are invoked (scan, pair, connect, forget), which events are listened to, and the pairing state kept in context (src/store/TopLevelContext/*Pairing*).
3. Sync: src/store/LowerLevelContext/SyncHandler and src/services/ActivityHistoryService.ts / ActivityMonitorService.ts — which Core events/methods for pedometer and sleep, and the entity types + mappers (src/mappers/entities/*) for pedometer and sleep. Give the TypeScript field names.
4. Tests: jest setup, example tests near store/mappers, mocks for the Core module (how the Core is mocked in tests).
5. Anything in the app that special-cases SMA (grep -i sma).`, { label: 'explore:app-usage', phase: 'Explore', agentType: 'Explore', schema: FINDINGS }),
])

const [proto, corePath, packaging, appUsage] = explores
const dump = (x) => x ? `${x.findings}\n\nKEY FILES:\n${x.key_files.join('\n')}\n\nOPEN QUESTIONS:\n${x.open_questions.join('\n')}` : '(agent failed)'

phase('Design')
const plan = await agent(`${COMMON}
You are a software architect. Design an implementation plan (in Portuguese, pt-BR) for a PROOF OF CONCEPT with TWO NEW REPOSITORIES, scoped to the SMA watch family only:

REPO 1 — "technos-watch-protocol" (Kotlin Multiplatform, zero React Native and zero vendor SDK dependencies): common domain model, a single pairing/sync state machine, a Transport interface implemented natively by the host, a DeviceProfile per model, and the first codec: SMA. Must be unit-testable with recorded frames (golden tests) and runnable end-to-end against a fake Transport that replays captured traffic. Ships as an Android AAR and an iOS XCFramework (static, prebuilt artifact, NOT the cocoapods gradle plugin).

REPO 2 — new Core: a thin React Native TurboModule (Kotlin on Android, Objective-C or Swift on iOS — recommend one and justify briefly given the current Core is 100% ObjC) that owns the BLE transport (BluetoothGatt / CBCentralManager with state restoration), implements Transport, bridges domain ↔ JS, and includes an example app equivalent to the current "Basic" so the user can connect a real SMA watch and validate: scan, pair, device info + battery, set time, steps sync, sleep sync, disconnect, and a live log view. No DFU, no notifications/calls, no other vendors, no vendor SDK adapter in this PoC (but the DeviceDriver seam must exist so a VendorSdkDriver can be added later).

CONSTRAINTS: the user's team knows Kotlin/Java/ObjC/TypeScript, not Rust. Code conventions: tabs, double quotes in TS. Comments at most one line. Keep the JS API shape close to the current Core's NativeCoreSpec names where sensible so the Mormaii app can later switch with minimal change, but do not replicate the full 126-method interface.

FACTS GATHERED (treat as ground truth; cite them in the plan):
=== SMA PROTOCOL ===
${dump(proto)}
=== CURRENT CORE SMA PATH ===
${dump(corePath)}
=== BASIC APP + PACKAGING ===
${dump(packaging)}
=== MORMAII APP USAGE ===
${dump(appUsage)}

DELIVER a plan with these sections, concrete and scannable:
1. Contexto e objetivo da PoC (3-6 bullets) + critérios de aceite verificáveis com o relógio SMA.
2. Repo 1 layout: Gradle modules, package tree, every layer with its responsibility, the public API (Kotlin signatures for Transport, DeviceDriver, WatchSession, DeviceProfile, domain types for DeviceInfo/Battery/StepsDay/SleepSession), the SMA codec internals (framing, CRC, command catalogue to implement with hex ids from the facts, reassembly), the state machine states/transitions for connect→bind→ready→sync, threading/coroutines model, error model.
3. Repo 1 testing: golden frame tests, codec property tests, fake transport replay, how to capture frames from a real watch (Android HCI snoop / Core logs), CI (GitHub Actions or Azure) building AAR + XCFramework and running tests; artifact publishing (Maven local/GitHub Packages, XCFramework zip + podspec).
4. Repo 2 layout: TurboModule spec (TS) listing methods/events with signatures, Android transport implementation details (connectGatt autoConnect strategy, MTU, CCCD, write queue, FGS only while syncing, reconnection), iOS transport (CBCentralManager restoration, retrievePeripherals, pending connect), DI seam for DeviceDriver, logging, how the KMP artifact is consumed (gradle dep + vendored_frameworks), example app screens.
5. Ordem de implementação em etapas com entregável testável ao fim de cada uma (e.g. E1 skeleton+golden tests, E2 fake transport e2e, E3 Android transport + example app connect, E4 steps+sleep on real watch, E5 iOS). Estimate relative size (S/M/L) per step, no hours.
6. Riscos e decisões em aberto (e.g. bind confirm on watch, MTU, iOS restoration, KMP interop) with the recommended default for each.
7. Explicit non-goals.
Return the plan as markdown text.`, { label: 'design:plan', phase: 'Design', effort: 'high' })

phase('Critique')
const critique = await agent(`${COMMON}
You are a skeptical senior engineer reviewing a plan. Find concrete problems: contradictions with the facts, missing steps that would block the PoC on a real watch, untestable layers, KMP/RN integration pitfalls, over-scoping for a PoC, and anything that could not be verified. For each problem: say what, why, and the fix. Also list what the plan gets right in one short paragraph. Portuguese.
=== FACTS ===
${dump(proto)}
${dump(corePath)}
${dump(packaging)}
=== PLAN ===
${plan}`, { label: 'critique:plan', phase: 'Critique', effort: 'high' })

return { proto, corePath, packaging, appUsage, plan, critique }