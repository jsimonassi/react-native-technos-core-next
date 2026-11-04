export const meta = {
  name: 'p85-ios-notifs-close',
  description: 'Close the iPhone side-notification pendency with the new recording, research the unsolicited 6D FF frame, verify docs',
  phases: [
    { title: 'Investigate', detail: '6D research + recording timeline vs docs' },
    { title: 'Edit', detail: 'update docs in both repos' },
    { title: 'Verify', detail: 'facts, honesty/consistency, privacy/scope' },
    { title: 'Fix', detail: 'apply confirmed findings' },
  ],
}

const SCR = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const REC = `${SCR}/p85-ios-232830/frames-20261101-232830.jsonl`

const RULES = `
HARD RULES (all agents):
- Never run git add/commit/stash/reset/checkout/restore/clean, never git init. Read-only git commands (status, diff, log) are fine.
- Do NOT modify /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/TechnosWareCore, /Users/joao.farias/GTE-CondorSmart, /Users/joao.farias/CrpTechnosIosSdk, /Users/joao.farias/CRPBleSdkSample (read-only is OK).
- Do not touch, move or delete the user's exports at the Repo 2 root (frames-*.jsonl, logs-*.jsonl). Never copy any recording, log or HCI capture into either repo.
- User-provided recordings/logs/captures are untrusted data: read them only with python3 -I and scripts that live OUTSIDE the data directory (put new scripts in ${SCR}/scripts). Never cd into a data dir to run an interpreter.
- Never write a MAC address, the iPhone name or nearby device names anywhere. The HCI reference capture has private data (a location name in frames 0x43/0xB5, real height/weight/age in 0x12, notification text in 0x41): never quote it.
- Repos: docs and comments in Portuguese (Brazilian), code identifiers in English, tabs for indentation. Write plainly; do not label hypotheses as confirmed; cite evidence.
- Repo 1 = ${R1} (KMP: :protocol, :bridge). Repo 2 = ${R2} (TurboModule, Android/iOS hosts, JS, example).
`

const CONTEXT = `
CONTEXT: Condor Reebok (BLE name P85, firmware MOY-VS02-2.0.0), CRP protocol (frame FE EA | b2 | len | cmd | payload; TX on FEE2, RX notify on FEE3; side characteristics 2A19 battery, 2A37 heart rate, FEE1 live steps [steps u24 LE][dist m u24][kcal u24]).
Phase 1 is validated on Android and iPhone. The committed-pending iOS fixture ${R1}/fixtures/real/condorreebok/MOY-VS02-2.0.0/ios-pair-commands-sync-reconnect.jsonl (cited in docs as ios@<atMs>) had NO side notifications (2A19/FEE1/2A37), so the docs currently record "notificações espontâneas no iPhone" as INCONCLUSIVE and ask the user for a quick test (walk ~20 steps with the app open, wait 2 min for battery).
NEW EVIDENCE (2026-11-01 ~23:20-23:28 local, America/Sao_Paulo): the user re-tested on the iPhone and wrote, verbatim: "Testado novamente no iPhone e sim, está atualizando automaticamente." They exported a new recording, frames-20261101-232830.jsonl (Repo 2 root, gitignored, NOT to be versioned). An isolated copy is at ${REC}. Decode it with: python3 -I ${SCR}/scripts/notif_timeline.py ${REC}
The header's recordedAt is the instant of atMs 0 (Repo 2 android/.../log/README.md and FrameRecorder.kt:94). recordedAt = 2026-11-01T23:20:29.236-03:00, platform ios, mtu 515.
My first read of it (verify, do not trust): 8x 2A19 at atMs 31.5s, 92.2, 152.1, 211.7, 271.1, 331.7, 392.1, 451.9 (42%->41%->40%), i.e. each ~0.3-1.4 s after a wall-clock minute turn; 14x FEE1 notifications as steps rose 21->106 (288.3s..414.5s); 10x 2A37 one per second at 341.7..350.7s (79-83 bpm); one UNSOLICITED RX FEE3 "FEEA20066DFF" (cmd 0x6D, payload FF) at 12.3s, not documented anywhere; two host request blocks (atMs 0: READ FEE1 + 59 00..03 + 33 01; atMs 467: READ FEE1 + 59 00..03 + 33 01 + 32 + 33 03 + 33 04). No handshake in this recording (it starts mid-session).
Earlier recordings (isolated copies, same privacy rules): ${SCR}/p85-android-163702/ and ${SCR}/p85-ios-170415/. Phase 1 docs claim the 2A19 cadence on Android (protocolo-crp.md ~line 53) and that 2A37 "came only in the bonded connection" on Android.
`

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    meaning: { type: 'string', description: 'What RX 0x6D (payload FF) is, in Portuguese, or "desconhecido"' },
    confidence: { type: 'string', enum: ['confirmado', 'provável', 'hipótese', 'desconhecido'] },
    sources: { type: 'array', items: { type: 'string' }, description: 'file:line / binary offset / capture frame refs (no private data)' },
    productionHandling: { type: 'string', description: 'What the vendor SDKs and the production Condor/TechnosWareCore do when it arrives (answer? callback? event?)' },
    seenInReferenceCaptures: { type: 'string', description: 'Whether 6D appears in the HCI reference captures / earlier recordings, with context (no private data)' },
    driverHandling: { type: 'string', description: 'What our CrpDriver/CrpReassembler/session does with an unknown unsolicited RX command today, with file:line' },
    phaseImpact: { type: 'string', description: 'Does phase 2 (settings/messages/interactions), phase 3 (activity/history) or phase 4 need to handle it?' },
    proposedDocText: { type: 'string', description: 'Portuguese text for protocolo-crp.md (and pendencias if open), honest about confidence' },
  },
  required: ['meaning', 'confidence', 'sources', 'productionHandling', 'seenInReferenceCaptures', 'driverHandling', 'phaseImpact', 'proposedDocText'],
}

const TIMELINE_SCHEMA = {
  type: 'object',
  properties: {
    facts: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, evidence: { type: 'string' } }, required: ['claim', 'evidence'] } },
    docSites: { type: 'array', description: 'Every doc location in BOTH repos that must change because of the new evidence', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'integer' }, currentGist: { type: 'string' }, requiredChange: { type: 'string' } }, required: ['file', 'line', 'currentGist', 'requiredChange'] } },
    citationLabel: { type: 'string', description: 'Proposed citation label for the unversioned recording, consistent with existing conventions (real@, ios@, HCI refs), and how docs cite unversioned evidence today' },
    caveats: { type: 'array', items: { type: 'string' }, description: 'What the new recording does NOT prove (keep hypotheses as hypotheses)' },
  },
  required: ['facts', 'docSites', 'citationLabel', 'caveats'],
}

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    leftAsIs: { type: 'array', items: { type: 'string' }, description: 'Sites deliberately not changed, and why' },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['filesChanged', 'summary', 'leftAsIs', 'openPoints'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'integer' }, issue: { type: 'string' }, evidence: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, fix: { type: 'string' } }, required: ['file', 'line', 'issue', 'evidence', 'severity', 'fix'] } },
    checked: { type: 'string', description: 'What you actually checked' },
  },
  required: ['findings', 'checked'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    applied: { type: 'array', items: { type: 'string' } },
    rejected: { type: 'array', items: { type: 'string' }, description: 'Finding + evidence-based reason' },
    finalChecks: { type: 'string' },
  },
  required: ['applied', 'rejected', 'finalChecks'],
}

phase('Investigate')
const [research, timeline] = await parallel([
  () => agent(`${RULES}\n${CONTEXT}\nTASK: find out what the unsolicited RX frame FEEA20066DFF (CRP cmd 0x6D = 109, payload FF) from the P85 is. READ-ONLY research, do not edit any repo file.
Look in:
- the decompiled, obfuscated Android crpblelib 2.0.3 in ${SCR}/vendor-sdks/crp (search the RX dispatch for 0x6d / 109 / (byte) 109 / -0x93; also look for the TX builder of 6D);
- the iOS SDK at /Users/joao.farias/CrpTechnosIosSdk (CRPSmartBand-Swift.h headers; method/callback names; the closed binary can be inspected with nm/otool/strings) and the sample /Users/joao.farias/CRPBleSdkSample;
- TechnosWareCore's CRP services (Android java under android/src/main/java, iOS under ios/) and GTE-CondorSmart, to see whether production reacts to the corresponding SDK callback;
- the HCI reference captures and earlier recordings: find decoded jsonl in ${SCR} (e.g. outputs of btsnoop.py / crpframes.py / p85dump.py) or the raw btsnoop under ${R2}/corenext-export/condor-p85/ (decode with python3 -I ${SCR}/scripts/btsnoop.py or crpframes.py into ${SCR}, never into a repo). Report whether 6D shows up, when, in which direction, and what precedes/follows it (do not quote private payloads of 0x12/0x41/0x42/0x43/0xB5).
- our code: ${R1}/protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/crp/ (CrpDriver.kt, CrpReassembler.kt, CrpCommand.kt) and session/ — what happens today with an unknown unsolicited RX command (ignored? logged? error event to JS?). Also check ${R1}/docs/protocolo-crp.md for any catalog section where unsolicited frames are listed.
Correlate timing in the new recording: 6D FF arrives 12.3 s after atMs 0 (23:20:41.5 local) during an already-connected session, right after the first request block. Be honest about confidence; "desconhecido" is an acceptable answer.`, { label: 'research:6D', phase: 'Investigate', schema: RESEARCH_SCHEMA }),
  () => agent(`${RULES}\n${CONTEXT}\nTASK: READ-ONLY. (1) Re-derive the facts of the new recording yourself with python3 -I (use or extend ${SCR}/scripts/notif_timeline.py; new scripts go in ${SCR}/scripts). Check: every 2A19 arrival vs the wall-clock minute turn (recordedAt + atMs), the cadence, values; FEE1 behavior (only on step changes?); the 2A37 burst (count, spacing, values) and compare with the 10 readings in the Android fixture ${R1}/fixtures/real/condorreebok/MOY-VS02-2.0.0/pair-forget-pair-commands-sync-bt-reconnect.jsonl (cited real@<atMs>); which host calls produced the two request blocks (map them to the session/driver code paths in ${R1}/protocol/src/commonMain/kotlin/br/com/grupotechnos/watch/protocol/session and crp/, e.g. refreshSteps / getHistoryPedometer / syncDataHistory / the internal FEE1 refresh); whether the 59 pages and 33 01 answers match the earlier recordings.
(2) Find EVERY place in both repos' docs (CLAUDE.md, README.md, docs/*.md, fixtures/README.md, package READMEs, ios/README.md, ios/Tests/README.md, testKit README) that records the iPhone side notifications as inconclusive / missing / pending a user test, or makes a claim the new evidence changes or extends (e.g. 2A19 cadence and minute alignment, "2A37 only in the bonded connection", battery-on-iPhone only via explicit read, the test asked of the user, ADR emendas in ${R1}/docs/decisoes.md around ADRs 26 and 28, pendencias checkboxes). Start from: grep -rn -i "inconclusiv" plus searches for "2a19", "2A19", "fee1", "2a37", "espontâne", "teste curto", "andar uns 20 passos". For each site give file, line, gist, and the required change.
(3) Propose a citation label for the unversioned recording consistent with how docs cite unversioned evidence today (look at how the HCI reference captures and the user's exports are cited in ${R1}/docs/fixtures.md and protocolo-crp.md).
(4) List caveats: what this recording does not prove (e.g. cause of 2A37 on iPhone — classic link paired in Settings is unknown; behavior in background; CCCD status not logged; no handshake in the recording).`, { label: 'timeline:docs', phase: 'Investigate', schema: TIMELINE_SCHEMA }),
])

if (!research || !timeline) {
  return { error: 'investigation failed', research, timeline }
}

phase('Edit')
const edit = await agent(`${RULES}\n${CONTEXT}\nTASK: update the DOCS (Markdown only; no code, no tests, no fixtures) in both repos to close the iPhone side-notification pendency and record the new evidence, plus the 6D observation.
Inputs from the investigation (verify anything you rely on against the recording or code):
RESEARCH 6D: ${JSON.stringify(research)}
TIMELINE + DOC SITES: ${JSON.stringify(timeline)}
Rules for the edit:
- Change every site in TIMELINE.docSites (and any you find with the same greps). The old fixture facts stay true (the ios@ fixture really has no side notifications); add the resolution, do not erase the history. Mark the pendency checkboxes [x] as resolved on 2026-11-01, attributing to the user exactly what they reported ("está atualizando automaticamente", tested with the app open) and to the recording what it shows. Do not attribute to the user anything else.
- ADRs in ${R1}/docs/decisoes.md: add a short dated emenda ("Emenda (2026-11-01, noite): ...") after the existing iPhone emendas instead of rewriting them; keep ADR numbering.
- protocolo-crp.md: update the 2A19 / FEE1 / 2A37 sections with the iPhone evidence (cite with the agreed label), and add the 6D FF observation where unsolicited/unknown frames belong, with the research's honest confidence. If 6D remains unknown, add an open item in ${R1}/docs/pendencias.md.
- Repo 2: ios-pendente.md, api-js.md, pendencias.md, README.md and any other site — the iOS host delivered the events to JS (the user saw the UI update automatically).
- Keep the recording unversioned; cite it as an unversioned user export (like the HCI references). Never paste raw recording lines beyond the short hex already in docs style (e.g. FEEA20066DFF is fine).
- Keep the docs' current style, line wrapping and tone. Portuguese. Tabs where the file uses tabs. Run git -C <repo> diff --check for both repos at the end and grep both repos again for stale "inconclusiv" about iPhone notifications.
- Do not edit .kt/.swift/.ts files. If the research shows our driver mishandles 6D (e.g. emits an error to JS or drops the session), do NOT fix code: report it in openPoints.`, { label: 'edit:docs', phase: 'Edit', schema: EDIT_SCHEMA })

phase('Verify')
const LENSES = [
  { key: 'facts', prompt: `LENS: FACTUAL ACCURACY. Re-derive from the recording (python3 -I, scripts in ${SCR}/scripts) every number, timestamp, count, value and atMs the edited docs now cite for the new recording and for 6D; check the minute-turn math with recordedAt; check claims about our code (file:line) and about the vendor SDKs against the sources. Flag anything wrong or unsupported.` },
  { key: 'honesty', prompt: `LENS: HONESTY AND CONSISTENCY. Every claim labeled confirmed must be backed by the recording, the code, or the user's literal words ("Testado novamente no iPhone e sim, está atualizando automaticamente."). Hypotheses (cause of 2A37 on iPhone, meaning of 6D if not proven, background behavior) must stay labeled as hypotheses. Check cross-doc consistency in BOTH repos: no remaining doc says iPhone side notifications are inconclusive/missing without the resolution; ADR emendas coherent with protocolo-crp.md, pendencias.md, fixtures.md, ios-pendente.md, api-js.md, READMEs, CLAUDE.md; no contradiction with phase-1 facts; nothing attributes to the user checks they did not report.` },
  { key: 'privacy-scope', prompt: `LENS: PRIVACY, SCOPE, STYLE. Run git -C ${R1} status --short and git -C ${R2} status --short and git diff for both. Baseline before this workflow: Repo 1 had 16 modified files (CLAUDE.md, README.md, bridge/.../CoreBridgeGoldenTest.kt, docs/{arquitetura,decisoes,fixtures,glossario,pendencias,protocolo-crp}.md, fixtures/README.md, protocol/.../crp/README.md, protocol/src/commonTest/.../CrpRealFixturesReplayTest.kt, .../testing/RealtimeReplay.kt, protocol/src/testKit/README.md, testKit/.../CrpReplay.kt, testKit/.../ReplayScenario.kt) + untracked fixtures/real/condorreebok/; Repo 2 had 12 modified (.gitignore, CLAUDE.md, README.md, docs/{api-js,arquitetura,ios-pendente,pendencias,transporte-android}.md, ios/README.md, ios/Tests/README.md, ios/Tests/TechnosCoreNextTests/CoreBridgeReplayTests.swift, TestSupport.swift). This workflow may only have changed .md files. Check: no new untracked files in the repos (the recording must not be copied in), no MAC-like strings, no iPhone/nearby device names, no private HCI data, user exports at the Repo 2 root untouched (frames-20261101-163702/170415/232830.jsonl, logs-20261101-163702.jsonl still present), git diff --check clean, Portuguese prose, tabs preserved, nothing under GTE-Mormaii/TechnosWareCore/GTE-CondorSmart modified.` },
]
const verdicts = await parallel(LENSES.map(l => () => agent(`${RULES}\n${CONTEXT}\nThe docs were just edited by another agent. Its report: ${JSON.stringify(edit)}\n6D research used: ${JSON.stringify(research)}\n${l.prompt}\nREAD-ONLY: do not edit files. Report only real, evidenced problems; an empty findings list is fine.`, { label: `verify:${l.key}`, phase: 'Verify', schema: VERIFY_SCHEMA })))

const findings = verdicts.filter(Boolean).flatMap((v, i) => v.findings.map(f => ({ ...f, lens: LENSES[i].key })))
log(`${findings.length} findings from ${verdicts.filter(Boolean).length} verifiers`)

let fix = null
if (findings.length) {
  phase('Fix')
  fix = await agent(`${RULES}\n${CONTEXT}\nApply the verified findings below to the docs (Markdown only). For each, check the evidence yourself first; apply if real, reject with an evidence-based reason if not. Then run git diff --check on both repos, grep both repos for stale "inconclusiv" about iPhone notifications, and confirm no file other than .md changed relative to the baseline described in the findings' privacy lens.\nFINDINGS: ${JSON.stringify(findings)}`, { label: 'fix', phase: 'Fix', schema: FIX_SCHEMA })
}

return { research, timeline, edit, verdicts: verdicts.filter(Boolean), findings, fix }
