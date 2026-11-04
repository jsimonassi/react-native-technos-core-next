export const meta = {
	name: 'ios-field-test-followup',
	description: 'Act on the first iPhone field test: PAIRING_REMOVED error, recording header fix, iOS fixtures, real SMA sleep, docs',
	phases: [
		{ title: 'Code', detail: 'PAIRING_REMOVED (Repo 1 + iOS host + JS), recording name at link-up, duplicate attach' },
		{ title: 'Fixtures+Docs', detail: 'iOS recordings as replay fixtures, first real 05/46 sleep, status docs' },
		{ title: 'Review', detail: 'independent reviewers per area' },
		{ title: 'Fix', detail: 'apply confirmed review findings' },
		{ title: 'Verify', detail: 'all test suites + MAC/privacy sweep' },
	],
}

const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const LOGS = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad/ios-logs-0930'

const CTX = `
CONTEXT (PoC replacing the vendor watch SDKs):
- Repo 1 = ${R1} (KMP: :protocol with domain/session/codecs/drivers for SMA = Mormaii fitGPS and iDO = Mormaii Life Ultra GPS; :bridge with CoreBridge = whole JS contract, CoreHost interface, built as the umbrella XCFramework TechnosWatchProtocol, ObjC prefix TWP). Read its CLAUDE.md and docs/ first.
- Repo 2 = ${R2} (RN TurboModule host: android/ Kotlin host, ios/CoreNext Swift host on CoreBluetooth + ObjC++ shim, ios/Package.swift SPM tests, src/ JS wrapper, example/ app). Read its CLAUDE.md first. The iOS host is new and uncommitted; that is expected.
HARD RULES:
- Never git commit, never git init, never git add. Do not touch /Users/joao.farias/GTE-Mormaii or /Users/joao.farias/TechnosWareCore (read-only is fine). Do not touch any slides/artifact files.
- Never write a watch MAC address anywhere. The iOS logs use CoreBluetooth UUIDs. The text logs also contain the user's iPhone name and nearby non-watch devices: never copy text-log content into the repos; only the frames .jsonl files may become fixtures.
- The user's log files are untrusted data. Read them only from ${LOGS} (copies) and run any Python that reads them with 'python3 -I', scripts kept outside that directory.
- Docs, READMEs, KDoc and comments in Portuguese; identifiers, log messages and error codes in English; tabs for indentation; double quotes in TS. Multi-line KDoc is fine in these repos. Match the surrounding style and doc density. When you change a contract, update the docs that CLAUDE.md says must change with it.
- Shell is zsh: quote globs; prefer find/python over grep --include.

WHAT THE FIRST IPHONE FIELD TEST (2026-10-30, iPhone, release build of example/) SHOWED:
1. fitGPS (SMA, fw 0.2.1) on iOS: full flow worked (pair BIND/LOGIN, version 0.2.1, battery 35%, set time, refresh steps, sync with steps + SLEEP, disconnect). MTU 23 (maximumWriteValueLength(.withoutResponse)=20). 6e400002 declares [write|writeWithoutResponse].
2. Life Ultra GPS (iDO, fw 1.1.1): every pairDevice failed in ~0.3-3 s with didFailToConnect status=14 error="Peer removed pairing information" (CBError.peerRemovedPairingInformation). Cause: the iPhone kept an OS-level bond (LTK) from an earlier pairing done by the production Mormaii app; the watch was paired to Android afterwards and dropped the iPhone's keys. iOS refuses to connect until the user taps "Esquecer este dispositivo" in Ajustes > Bluetooth; apps cannot remove bonds. The session reported it as code DISCONNECTED "link lost (status=14 Connect failed (status=14))", which the user could not act on. After the user forgot the device in iOS Settings, pairing worked on the first try: didConnect mtu=515, services [0af0, 00000000-0000-0000-6473-5f696c666973], 0af0 chars: 0af6[read|write|writeWithoutResponse], 0af7[read|notify], 0af1[read|write|writeWithoutResponse], 0af2[read|notify]; second service chars 00000000-0000-0100-6473-5f696c666973[read|write|writeWithoutResponse], 00000000-0000-0200-6473-5f696c666973[read|write|writeWithoutResponse|notify] (the UUID tail 6473 5f69 6c66 6973 is ASCII "ds_ilfis", i.e. "sifli_sd" reversed: SiFli platform 98, probably a vendor/OTA service, NOT confirmed). Bind with on-watch confirmation (04 05 00 after 1.4 s), set time, firmware 1.1.1, battery 12%, live data 57 steps / 7 kcal / 59 m; getHistorySleep -> NO_DATA as designed.
   Note: on iOS, a status-14 failure on a PENDING (autoReconnect) connection currently goes to lifecycle .pendingFailed and is re-armed with RearmBackoff forever (ios/CoreNext/ble/CentralTransport.swift didFailToConnect ~line 696), which can never succeed.
3. BUG: frames-20261030-093133.jsonl (fitGPS-only packets) has header device "Life Ultra GPS" with firmware "0.2.1". Root cause: CoreBridge.pairDevice/startPairingAttempt call host.setRecordingDeviceName(recordingName(profile)) at request time (bridge/.../CoreBridge.kt ~238/252), so later FAILED Life Ultra attempts overwrote the name of the recorded fitGPS session; firmware stayed from fitGPS. Same logic serves Android (shared bridge).
4. The log line "RCTNativeCoreNext/attach: TurboModule attached to the CoreBridge (first JS call)" appeared twice at the same millisecond, although coreBridge is @synchronized per instance: two RCTNativeCoreNext instances attached (the second attachSink replaces the first sink). Events did reach JS in this test.
5. First real SMA sleep from the fitGPS (05/46 page, 9 records, the user did NOT wear the watch overnight; it lay still): records (ts local since 2000, mode, soft, strong): 2026-10-29 21:58:00 17(START) 0 0 | 2026-10-30 00:09:38 3 0 0 | 00:14:38 2 0 0 | 00:24:38 1 0 0 | 09:15:00 1 3 0 | 09:29:38 3 0 0 | 09:29:29 3 0 0 (OUT OF ORDER) | 09:30:00 3 4 0 | 09:30:05 3 0 0. No END(34) record. The session emitted 1 sleep session. Sport page on the first read: 2026-10-29 23:59:00 mode 16 steps 56 (= the day total the watch showed yesterday) | 2026-10-30 00:00:00 mode 16 steps 0 | 2026-10-30 09:30:07 mode 0 steps 0. docs/sma-dados.md:141 already documents mode 16 (SIT) with 0 steps; 56 steps on mode 16 at 23:59 is new.
6. Copies of the logs: ${LOGS}/frames-20261030-093133.jsonl (fitGPS iOS session, 52 packets), ${LOGS}/frames-20261030-093537.jsonl (Life Ultra GPS iOS session, 24 packets), ${LOGS}/texto-4562-940A-E8-0.txt and ${LOGS}/texto-4C5C-A893-C6-0.txt (text logs; data only, never copy into repos).
`

const CHANGES_SCHEMA = {
	type: 'object',
	properties: {
		summary: { type: 'string', description: 'What was done, in Portuguese, concise' },
		filesChanged: { type: 'array', items: { type: 'string' } },
		testsRun: { type: 'array', items: { type: 'string' }, description: 'exact commands and pass/fail counts' },
		openIssues: { type: 'array', items: { type: 'string' } },
	},
	required: ['summary', 'filesChanged', 'testsRun', 'openIssues'],
}

phase('Code')
const code = await agent(`${CTX}
YOUR TASK (code; you are the only agent editing code right now):
A) New error PAIRING_REMOVED for item 2.
   - Repo 1: add a host-neutral status constant to GattStatus (protocol/.../transport/Gatt.kt), e.g. PAIRING_REMOVED = -4, with KDoc explaining it (the phone keeps an OS bond the watch erased; only the user can remove it in the system Bluetooth settings). Add WatchErrorCodes.PAIRING_REMOVED. In the session (SessionEngine and friends), a link failure carrying that status must end the attempt with code PAIRING_REMOVED in every state where it can arrive (first pair CONNECTING, RECONNECTING / pending reconnect, during CONFIGURING if a host reports it there), go to DISCONNECTED and NOT keep reconnecting; message in English telling to forget the device in the system Bluetooth settings. Check how the CoreBridge turns session errors into onError/rejections and whether HostErrorCodes or any code list there needs it; check reconnectIfPaired so it does not loop (one attempt per trigger is fine). Unit tests in commonTest for the session + bridge behaviour. ADR entry in docs/decisoes.md and update any doc that lists error codes or GattStatus values (arquitetura.md etc.).
   - Repo 2 iOS: CentralTransport maps CBError.peerRemovedPairingInformation (code 14) to GattStatus.PAIRING_REMOVED, logs WARN with the hint, and does NOT re-arm a pending connection for it (end the attempt like a connect failure). Keep other statuses as they are. Add/adjust Swift tests in ios/Tests (SPM package ios/Package.swift) if the structure allows testing this mapping (e.g. a pure helper for status/rearm decision). Android: do not invent behaviour; only document in docs/transporte-android.md or docs/pendencias.md that the Android counterpart (stale bond, removeBond) is not handled yet.
   - Repo 2 JS: add PAIRING_REMOVED to errorCodes in src/constants.ts (TSDoc in Portuguese), the mock if it lists codes, docs/api-js.md, and make the example app show a clear Portuguese hint when this code arrives (e.g. "Esqueça o relógio em Ajustes > Bluetooth do iPhone e tente parear de novo") where it shows errors today. Keep JS tests green (example/__tests__ and any root tests).
B) Fix item 3 (recording header). The bridge must set the recording device name only when a connection attempt actually reaches the link (session state CONFIGURING, i.e. link up) for that attempt's profile, not when the request is made; keep onDeviceInfo setting bleName and firmware. When the recorded device changes, the previous firmware must not leak into the new header (reset it or set it from the new device). Update the bridge tests that assert the journal order (CoreBridgeConnectionTest, CoreBridgeLifecycleTest, CoreBridgeIdoTest ...). Update the KDoc of pairDevice/startPairingAttempt and any doc describing the header. Also check both host recorders (android .../log/FrameRecorder.kt and ios/CoreNext/log/FrameRecorder.swift) for anything else that would mix two devices in one header, and document the remaining limitation (one export = one header) where the fixture docs live if you do not fix it.
C) Investigate item 4 (two RCTNativeCoreNext instances). Look at how the module is registered (RCT_EXPORT_MODULE / moduleName / codegenConfig.ios.modulesProvider in package.json / getTurboModule / the example AppDelegate) and at the RN 0.81 TurboModule manager behaviour (node_modules/react-native in example/). Fix it only if you find a clear, low-risk cause (e.g. double registration under two names); otherwise make sure the sink always ends up on the instance JS uses and document the finding in docs/ios-pendente.md. Do not guess.
VERIFY before returning: in Repo 1 './gradlew :protocol:jvmTest :bridge:jvmTest' (and the iosSimulatorArm64 tests if the project already runs them, e.g. ':protocol:iosSimulatorArm64Test :bridge:iosSimulatorArm64Test'); then in Repo 2 run 'ios/scripts/sync-xcframework.sh --build' and the SPM tests: cd ${R2}/ios && xcodebuild test -scheme TechnosCoreNext -destination "platform=iOS Simulator,id=585526EE-D218-4733-8B2F-8429E02D8783"; Android unit tests per Repo 2 CLAUDE.md (publishToMavenLocal in Repo 1 first if the Android host consumes the published AAR); JS tests per Repo 2 CLAUDE.md. Report exact counts.`, { label: 'code:pairing-removed+recording', phase: 'Code', schema: CHANGES_SCHEMA })

phase('Fixtures+Docs')
const [fixtures, statusDocs] = await parallel([
	() => agent(`${CTX}
Another agent already changed code (PAIRING_REMOVED error, recording name at link-up). Its report: ${JSON.stringify(code)}
YOUR TASK (Repo 1 fixtures, data docs; do not edit session/bridge/host code):
1. Turn the two iOS recordings into real fixtures following docs/fixtures.md conventions (paths under fixtures/real/<slug>/<fw>/, naming like the existing ones, e.g. fixtures/real/fitgps/0.2.1/ios-pair-info-time-steps-sleep-sync.jsonl and fixtures/real/lifeultragps/1.1.1/ios-pair-info-time-steps-sync.jsonl). Copy the frames files with Python -I, fixing ONLY the fitGPS header device field to the correct fitGPS BLE name ("Mormaii_fitGPS", the name the bridge uses for the fitGPS) and recording that correction in fixtures.md; keep platform "ios". Confirm there is no MAC in them (iDO 02/04 replies contain the MAC; these recordings should not have 02/04; the iDO bind challenge bytes change per bind; compare with the existing lifeultragps fixtures to be sure the challenge is not constant).
2. Add replay tests exactly like the existing real-fixture replay tests (find them; they run multiplatform), asserting strict TX match counts, final states, steps (fitGPS today 0 steps; Life Ultra 57 steps, 7 kcal, 59 m if the domain exposes them) and, for the fitGPS, the sleep session produced from the real 05/46 page. Before asserting the sleep output, check SmaSleepAnalyzer against the original SDK (the decompiled SMA SDK is under /private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad/vendor-sdks/sma if it still exists; also docs/sma-dados.md cites SmaSleep.java lines) for: records out of order, no END(34) record, START far before the first stage. Write down what the analyzer outputs (start, end, stages, minutes) and whether that matches the SDK. If the analyzer diverges from the SDK in a way that is a bug, fix the analyzer with a unit test; if it matches the SDK but the result is odd (e.g. session ends at the last record, the watch counts sleep while not worn), document it, do not change behaviour.
3. Docs: docs/sma-dados.md (first real 05/46 page: format confirmed on the device, out-of-order records, missing END, sleep detected while not worn; mode 16 at 23:59:00 carrying 56 = the previous day's total, with the fixture as proof), docs/protocolo-ido.md (what iOS showed: the GATT table with properties, 0af6 declares writeWithoutResponse which answers an open question, MTU 515 offered by iOS while the profile keeps 20-byte frames, the second service UUID and its "sifli_sd" reading as a hypothesis, bind confirmation timing), docs/fixtures.md (new files, the header correction), docs/pendencias.md (close what this test answered; add: Android stale-bond counterpart, ask whether iOS shows the system pairing dialog for the Life Ultra GPS i.e. whether the watch requests encryption). Keep the existing style.
VERIFY: './gradlew :protocol:jvmTest' plus the iOS simulator test task that runs the replay suite if the project has one; report counts.`, { label: 'fixtures:ios+sleep', phase: 'Fixtures+Docs', schema: CHANGES_SCHEMA }),
	() => agent(`${CTX}
Another agent already changed code (PAIRING_REMOVED error, recording name at link-up). Its report: ${JSON.stringify(code)}
YOUR TASK (Repo 2 status docs only; do not edit code, do not edit Repo 1, do not run builds):
Update the docs to say the iOS host now ran on a real iPhone with both watches on 2026-10-30, precisely and without overclaiming:
- README.md "Estado" paragraph (today it says the iOS "ainda não rodou num iPhone com relógio").
- docs/ios-pendente.md: a section "O que o iPhone mostrou (2026-10-30)" with the facts above (both flows, MTUs, write properties, status 14 and the new PAIRING_REMOVED behaviour as implemented per the report, the duplicate attach finding per the report) and update the open items: what is now answered (e.g. 0af6 writeWithoutResponse, connect on device, release build without Metro) and what is still NOT tested (state restoration / background relaunch, reconnection after Bluetooth off/on and after leaving range on iOS, app killed, reinstall changing the UUID, coexistence with the production Core, the BLE-1 restored-connection assumption). Do not mark anything as tested that the logs above do not show (the user did turn Bluetooth off and on once while DISCONNECTED; nothing was connected at that time, so BT reconnection is NOT tested).
- example/README.md: the iPhone checklist (I1..I9 or similar): mark what this test covered, leave the rest open, and add a troubleshooting note for PAIRING_REMOVED / status 14 (forget the watch in Ajustes > Bluetooth; happens when the watch was paired to another phone or to the production app before).
- docs/pendencias.md and docs/arquitetura.md only where they state iOS was never run on a device.
Read the current files fully before editing; keep the style.`, { label: 'docs:ios-status', phase: 'Fixtures+Docs', schema: CHANGES_SCHEMA }),
])

phase('Review')
const FINDINGS = {
	type: 'object',
	properties: {
		findings: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					file: { type: 'string' },
					line: { type: 'number' },
					severity: { type: 'string', enum: ['high', 'medium', 'low'] },
					issue: { type: 'string' },
					evidence: { type: 'string' },
					suggestedFix: { type: 'string' },
				},
				required: ['file', 'severity', 'issue', 'evidence', 'suggestedFix'],
			},
		},
	},
	required: ['findings'],
}
const reviewCtx = `${CTX}
Uncommitted changes from this round are in both repos (Repo 2 also has the whole iOS host uncommitted from an earlier round; review only what relates to this round unless you see a real bug). Use git diff / git status in each repo. Reports of the implementers: CODE=${JSON.stringify(code)} FIXTURES=${JSON.stringify(fixtures)} DOCS=${JSON.stringify(statusDocs)}
Report only real, verified problems with evidence (file:line, a failing scenario, or a test you ran). Do not edit files.`
const reviews = await parallel([
	() => agent(`${reviewCtx}
LENS: correctness of PAIRING_REMOVED end to end. Trace CBError 14 from CentralTransport.didFailToConnect through the session to the JS rejection/onError for: first pairDevice, startPairingAttempt (pending reconnect), automatic reconnect after app start / Bluetooth on (reconnectIfPaired), and a failure during CONFIGURING. Check there is no infinite re-arm/reconnect loop, that other statuses still re-arm as before, Contract B (Bluetooth off emits only onBluetoothStateChanged(false)) is intact, thread-safety, and that tests really cover it.`, { label: 'review:pairing-removed', phase: 'Review', schema: FINDINGS }),
	() => agent(`${reviewCtx}
LENS: recording header fix and the duplicate TurboModule attach change. Check every path that sets recording name/firmware (pairDevice, startPairingAttempt, reconnectIfPaired, onDeviceInfo, link-up), failed attempts, forget + pair another watch, reconnect after app restart, and that both hosts write correct headers. For the attach change, verify the claimed cause against example/node_modules/react-native sources and that events still reach the JS-visible instance; flag any guess presented as fact.`, { label: 'review:recording+attach', phase: 'Review', schema: FINDINGS }),
	() => agent(`${reviewCtx}
LENS: fixtures and documentation accuracy. Re-derive the facts from the frames copies with python3 -I (record decoding, timestamps, steps, sleep), compare with the new fixtures (byte-identical except the corrected header field), the replay test assertions, the SmaSleepAnalyzer conclusions versus the SDK source, and every new doc sentence in both repos (no overclaiming of iOS tests; BT reconnection, restoration, background NOT tested). Scan the repos for any MAC address pattern (XX:XX:XX:XX:XX:XX) introduced by this round and for any text-log content (iPhone name, other device names) copied into the repos. Check Portuguese in docs, English identifiers, tabs.`, { label: 'review:fixtures+docs', phase: 'Review', schema: FINDINGS }),
])
const allFindings = reviews.filter(Boolean).flatMap(r => r.findings)
log(`${allFindings.length} review findings`)

phase('Fix')
let fix = null
if (allFindings.length) {
	fix = await agent(`${CTX}
Review findings for this round's uncommitted changes (verify each one yourself before acting; skip the ones that are wrong and say why): ${JSON.stringify(allFindings)}
Implementer reports for context: CODE=${JSON.stringify(code)} FIXTURES=${JSON.stringify(fixtures)} DOCS=${JSON.stringify(statusDocs)}
Fix the confirmed ones (code, tests, docs). Then run the affected test suites (Repo 1 jvmTest; if Repo 1 changed, regenerate the XCFramework with ${R2}/ios/scripts/sync-xcframework.sh --build before the iOS SPM tests).`, { label: 'fix:findings', phase: 'Fix', schema: {
		type: 'object',
		properties: {
			fixed: { type: 'array', items: { type: 'string' } },
			skipped: { type: 'array', items: { type: 'string' } },
			testsRun: { type: 'array', items: { type: 'string' } },
		},
		required: ['fixed', 'skipped', 'testsRun'],
	} })
}

phase('Verify')
const verify = await agent(`${CTX}
Final verification of this round (do not change code unless a test fails because of an obvious slip from this round; if so, fix it minimally and say so).
Run and report exact counts:
1. Repo 1: ./gradlew :protocol:jvmTest :bridge:jvmTest, plus the iosSimulatorArm64 test tasks if they exist; ./gradlew publishToMavenLocal.
2. Repo 2: ios/scripts/sync-xcframework.sh --build; cd ios && xcodebuild test -scheme TechnosCoreNext -destination "platform=iOS Simulator,id=585526EE-D218-4733-8B2F-8429E02D8783"; Android host unit tests and JS tests as in Repo 2 CLAUDE.md; a Debug simulator build of the example only if Repo 2 docs describe a command for it and it takes reasonable time.
3. Privacy sweep: no MAC address (regex [0-9A-F]{2}(:[0-9A-F]{2}){5}, case-insensitive) in files changed or added in either repo this round (git status/diff, including untracked files), no logs-*.jsonl or text-log content in the repos, the user's original logs only under ${R2}/corenext-export/ (gitignored).
4. git status --short of both repos.
Also propose one commit title per repo in Portuguese, title only (e.g. "fix: ..."), matching the repos' history style (git log --oneline -10).`, { label: 'verify:all', phase: 'Verify', schema: {
	type: 'object',
	properties: {
		results: { type: 'array', items: { type: 'string' } },
		privacyOk: { type: 'boolean' },
		privacyNotes: { type: 'string' },
		gitStatusRepo1: { type: 'string' },
		gitStatusRepo2: { type: 'string' },
		commitTitleRepo1: { type: 'string' },
		commitTitleRepo2: { type: 'string' },
		problems: { type: 'array', items: { type: 'string' } },
	},
	required: ['results', 'privacyOk', 'privacyNotes', 'gitStatusRepo1', 'gitStatusRepo2', 'commitTitleRepo1', 'commitTitleRepo2', 'problems'],
} })

return { code, fixtures, statusDocs, findings: allFindings, fix, verify }
