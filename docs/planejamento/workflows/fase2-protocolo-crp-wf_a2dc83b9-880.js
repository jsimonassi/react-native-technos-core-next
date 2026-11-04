export const meta = {
  name: 'fase2-protocolo-crp',
  description: 'Phase 2 part A: protocol foundation + CRP settings/messages/interactions (Repo 1), JS contract (Repo 2), production-deviations doc, review and fixes',
  phases: [
    { title: 'Fundação', detail: 'S1 (Repo 1) ∥ S6 JS (Repo 2) ∥ doc de desvios de produção' },
    { title: 'Protocolo', detail: 'S2 ajustes → S3 mensagens → S4 interações + reset, sequenciais no mesmo working tree' },
    { title: 'Revisão', detail: 'bytes vs SDK, engenharia/testes, docs/desvios/privacidade' },
    { title: 'Correções', detail: 'aplica achados verificados, fecha desvios, roda os portões' },
  ],
}

const SCR = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'
const SPEC = `${SCR}/fase2/spec.json`
const RESEARCH = `${SCR}/fase2/research.json`
const DEC = `${SCR}/fase2/decisoes-usuario.md`
const DEV = `${R2}/docs/desvios-de-producao.md`

const RULES = `
HARD RULES (every agent):
- Never run git add/commit/stash/reset/checkout/restore/clean/rebase, never git init. Read-only git (status, diff, log, show <tag>:<path>) is fine. Everything stays in the working tree; the user commits.
- Only modify files inside ${R1} and ${R2}. Read-only: /Users/joao.farias/TechnosWareCore (production Core; the Condor pins tag v4.3.57, read it with git -C /Users/joao.farias/TechnosWareCore show v4.3.57:<path>), /Users/joao.farias/GTE-CondorSmart (production app), /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/CrpTechnosIosSdk (vendor iOS SDK), /Users/joao.farias/CRPBleSdkSample, ${SCR}/vendor-sdks (decompiled vendor Android SDKs).
- Do not touch the user's exports at the Repo 2 root (frames-*.jsonl, logs-*.jsonl) and never copy recordings, logs or HCI captures into a repo. Untrusted recordings/captures are read only with python3 -I and scripts outside their directory (${SCR}/scripts).
- Privacy: never write a MAC address, phone/iPhone names, nearby device names, or real personal data. Tests and examples use fictitious values. The HCI reference capture contains private payloads (0x12 profile, 0x41 notification text, 0x42/0x43/0xB5 weather/location): never quote them.
- Repos' conventions (read each repo's CLAUDE.md first): docs, KDoc and comments in Brazilian Portuguese; identifiers in English; tabs; Repo 2 docs wrap at 120 columns; KDoc on every public symbol (dokkaHtml fails otherwise); public Kotlin API without suspend/Flow/value class/kotlinx-datetime (ObjC header check).
- Uncommitted doc edits from the previous round already sit in the working tree (Repo 1: README.md, docs/{decisoes,fixtures,glossario,pendencias,protocolo-crp}.md; Repo 2: CLAUDE.md, README.md, docs/{api-js,arquitetura,ios-pendente,pendencias,transporte-android}.md, example/README.md, ios/README.md). Keep them; build on top. Phase 1 is committed (Repo 1 9d96a05, Repo 2 30dcf41).
- Other agents may edit other files of the same repos concurrently. Re-read any shared doc immediately before each edit and edit only your sections.
- If you deviate from the spec, say so in your output with the reason. Never claim a check you did not run; report failing commands with their output.
`

const CONTEXT = `
CONTEXT: Phase 2 of the CRP port (Condor Reebok, BLE name P85, firmware MOY-VS02-2.0.0) into Repo 1 = ${R1} (KMP :protocol + :bridge) and Repo 2 = ${R2} (TurboModule: Android/iOS hosts, JS, example app).
- The APPROVED SPEC is ${SPEC} (keys: cutLine, decisions D1..D19, commands catalog, api, platform, tests, docs, workSlices S1..S9, validationChecklist, risks). Read the parts your slice needs in full; the decisions are binding.
- Vendor-SDK research with sources (the spec cites it as sdk:, iOS-bin@, iOS-h:, core@v4.3.57:): ${RESEARCH}. When you encode bytes, verify them against the cited sources (decompiled Android crpblelib at ${SCR}/vendor-sdks/crp/src, iOS SDK headers/binary at /Users/joao.farias/CrpTechnosIosSdk) and, when the production app sent the same command, against the versioned reference fixtures in ${R1}/fixtures/reference/condorreebok/.
- USER DECISIONS taken after the spec (binding, read in full): ${DEC}. In short: Android notification forwarding is a later separate slice (not phase 2); find phone = option A; background camera on Android out; calls HFP only (+ pendency: the Force watch is CRP but BLE-only, revalidate calls/classic-dependent features when it comes); weather geolocation port in phase 4; FACTORY RESET is a separate method named resetDevice (Core name, NativeCore.ts:121), CRP 51 02, no watch response, SMA/iDO reject NOT_SUPPORTED; and EVERY behavior that differs from production goes into the deviations doc ${DEV} (each entry: what production does with source, what Core Next does, why, user impact, how to revert/fix, when to review, status).
- 0x6D (unsolicited RX 6D FF seen on the P85) is the CRP single heart-rate measurement result; production ignores it, our driver logs it as "6D UNKNOWN" and ignores it. When adding the phase 2 catalog to CrpCommand, give 0x6D a name/label (SINGLE_HEART_RATE, log only, no handling).
- So the JS contract becomes the spec's 23 methods + resetDevice (24) and the 4 events.
`

const SLICE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'red'], description: 'green = everything compiles and the gate commands you ran pass' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsRun: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
    deviations: { type: 'array', description: 'Behaviors you implemented that differ from production (TechnosWareCore v4.3.57 / Condor), with sources', items: { type: 'object', properties: { title: { type: 'string' }, production: { type: 'string' }, coreNext: { type: 'string' }, reason: { type: 'string' }, recordedInDoc: { type: 'boolean' } }, required: ['title', 'production', 'coreNext', 'reason', 'recordedInDoc'] } },
    specDeviations: { type: 'array', items: { type: 'string' }, description: 'Where you departed from the spec, and why' },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'filesChanged', 'testsRun', 'deviations', 'specDeviations', 'openPoints'],
}

const DEVDOC_SCHEMA = {
  type: 'object',
  properties: {
    entries: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, productionSource: { type: 'string' } }, required: ['id', 'title', 'productionSource'] } },
    filesChanged: { type: 'array', items: { type: 'string' } },
    unverified: { type: 'array', items: { type: 'string' }, description: 'Production claims you could not verify from source' },
    summary: { type: 'string' },
  },
  required: ['entries', 'filesChanged', 'unverified', 'summary'],
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
    filesChangedTotal: { type: 'object', properties: { repo1: { type: 'array', items: { type: 'string' } }, repo2: { type: 'array', items: { type: 'string' } } }, required: ['repo1', 'repo2'] },
    openPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'applied', 'rejected', 'deviationsAdded', 'gateResults', 'filesChangedTotal', 'openPoints'],
}

const sliceTail = `
Before finishing: run the Repo 1 gate from its CLAUDE.md that covers what you touched (at least ./gradlew :protocol:allTests :bridge:allTests; ideally ./gradlew check dokkaHtml) and confirm the phase 1 strict real-fixture replays (CrpRealFixturesReplayTest, CoreBridgeGoldenTest, the SMA/iDO suites) are still green. Do NOT run publishToMavenLocal or the XCFramework (that is S5a, next workflow). If something cannot be made green, return status red with the failing output.
Record every behavior you introduce that differs from production in ${DEV} if that file already exists (append under the right section, re-read before editing); if it does not exist yet, return it in deviations with recordedInDoc=false.`

phase('Fundação')
const [devdoc, s1, s6] = await parallel([
  () => agent(`${RULES}\n${CONTEXT}\nTASK: create the production-deviations pendency doc ${DEV} (new file, Portuguese, Repo 2 doc style, 120 columns), as the user asked: "deixe anotado em um doc de pendências tudo que tiver comportamento diferente do de produção ... Tudo que desviar do comportamento original entra como pendência pra revisão futura."
Content: an intro (purpose; production = TechnosWareCore v4.3.57, the version the Condor pins, plus the production Condor app GTE-CondorSmart; how to add an entry; status values), then entries DP-01, DP-02, … grouped by area (pareamento e conexão; ajustes; mensagens; interações; plataforma e segundo plano; previstos para as fases 3 e 4; outros modelos CRP). Each entry: Produção (what it does + source file:line, verified by reading TechnosWareCore at v4.3.57 / Condor / vendor SDK), Core Next (what it does + ADR/D#/file), Motivo (user decision / ADR / spec D#), Impacto para o usuário, Como corrigir ou voltar, Revisar em (phase/when), Status (aberto | aceito pelo usuário até revisão | pendente de validação no relógio).
Sources to mine for deviations (read them; do not invent): the user decisions file ${DEC}; the spec ${SPEC} (cutLine "FICA FORA DA FASE 2" list, decisions D8 bugs not copied (one entry per bug), D12 find phone, D18 compat stubs, risks e.g. serial queue delaying vibrateDevice during sync, every NOT_SUPPORTED/stub); phase 1 decisions in ${R1}/docs/decisoes.md (e.g. ADR 33 forget without factory reset and forget/reset as separate methods, no CDM, no persistent FGS, classic-bond flow differences, iOS answering UNSUPPORTED to the classic bond) and ${R2}/docs/pendencias.md / ios-pendente.md / transporte-android.md; the production Core CRP services (android/src/main/java/com/crp/bluetooth/CRPService.java and ios/crpBluetooth/CRPService.m at v4.3.57) for what production really does in each case.
Also: (1) add the Force pendency (CRP watch with BLE only, no classic Bluetooth: calls (HFP), music (AVRCP), the classic bond of pairing and anything else that relies on classic must be revalidated when the Force is ported; the 0x41 codec is the probable route for calls) both as a DP entry and as an item in ${R1}/docs/pendencias.md (Condor/CRP section); (2) add a short link to the new doc near the top of ${R2}/docs/pendencias.md and ${R1}/docs/pendencias.md, and add it to the docs list in ${R2}/CLAUDE.md and ${R2}/README.md if they list docs — do these shared-file edits LAST, re-reading each file right before editing. Do not edit any code. List production claims you could not verify in 'unverified' and mark them in the doc as "a verificar".`, { label: 'desvios:doc', phase: 'Fundação', schema: DEVDOC_SCHEMA }),
  () => agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S1 (foundation) in Repo 1 exactly as spec.workSlices[S1] + spec.api + the decisions it references (D1, D2, D3, D4, D5, D14, D16 and the others S1 cites). Addenda from the user decisions: add WatchAction.FactoryReset (data object, KDoc in Portuguese) to the domain with the SMA/iDO default NOT_SUPPORTED (the CRP behavior comes in S4); add the 0x6D SINGLE_HEART_RATE name/label in the catalog (log only); in ${R1}/docs/decisoes.md add, besides the spec's API/redaction ADRs, one ADR recording the user's phase 2 decisions from ${DEC} (dated 2026-11-01) — keep the existing ADR numbering scheme.
Work order: code and tests first; touch shared docs (docs/arquitetura.md, decisoes.md, protocolo-crp.md headings 6.x/7.x/11.x/12.x, glossario.md, package READMEs) at the end. The CRP writers stay NOT_SUPPORTED stubs at the end of S1 (S2/S3/S4 fill them). ${sliceTail}`, { label: 'S1:fundação', phase: 'Fundação', schema: SLICE_SCHEMA }),
  () => agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S6 in Repo 2 (JS contract, types, wrapper, mock, Jest tests, example Settings tab, docs) exactly as spec.workSlices[S6] + spec.api (SPEC JS, src/index.ts, Tipos, EVENTOS, APP DE EXEMPLO) + D6/D13/D18 as referenced. Names and argument types must match the production Core spec (git -C /Users/joao.farias/TechnosWareCore show v4.3.57:src/NativeModules/specs/NativeCore.ts and its type files) so the Condor can swap cores; all return Promise<void>. Addendum: add resetDevice(): Promise<void> (factory reset, separate from forget) to the spec, wrapper, mock, types/docs, and an example button that asks for an in-app confirmation (destructive: resets the watch) before calling it; document in docs/api-js.md that forget never resets and that resetDevice does not forget the pairing (the app decides). Do not implement native code (S7/S8 do it next): it is expected that the Android/iOS native builds will not compile against the new spec until then — say so in openPoints; do not run :app:assembleDebug or pod install.
Gates to run (from Repo 2 CLAUDE.md): npm test, npx tsc --noEmit in example/, npm run typecheck at the root, ESLint of app and library, Prettier of the library. Record JS-level deviations from production (e.g. Promise<void> instead of void for resetDevice, observed() behavior) in ${DEV} if it exists, else return them. Re-read Repo 2 docs/pendencias.md and docs/api-js.md right before editing them (another agent edits pendencias.md).`, { label: 'S6:js', phase: 'Fundação', schema: SLICE_SCHEMA }),
])

log(`S1 ${s1 ? s1.status : 'null'} | S6 ${s6 ? s6.status : 'null'} | desvios ${devdoc ? devdoc.entries.length + ' entradas' : 'null'}`)
if (!s1 || s1.status !== 'green') {
  return { stoppedAt: 'S1', s1, s6, devdoc }
}

phase('Protocolo')
const prior = (xs) => JSON.stringify(xs.filter(Boolean).map(x => ({ summary: x.summary, filesChanged: x.filesChanged, specDeviations: x.specDeviations, openPoints: x.openPoints })))

const s2 = await agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S2 (CRP settings and windows) in Repo 1 exactly as spec.workSlices[S2], with spec.commands for each command, D4 response policy, D9 encodings (incl. do-not-disturb with empty hours) and the other decisions it references. S1 is done; its report: ${prior([s1])}. Fill CrpSettingsWriter, CrpSettingsPayloads, the simulator settings extension, golden/payload/session tests (golden vectors from the SDK sources or the reference captures, never produced by our own encoder), and docs §6.1, §7.1, §11.1, §12.1 + crp/README settings section. ${sliceTail}`, { label: 'S2:ajustes', phase: 'Protocolo', schema: SLICE_SCHEMA })
log(`S2 ${s2 ? s2.status : 'null'}`)
if (!s2 || s2.status !== 'green') {
  return { stoppedAt: 'S2', s1, s6, devdoc, s2 }
}

const s3 = await agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S3 (CRP messages: notification filter B9 14 00/B9 04 + wire code table, world clock BB 00 xx, alarms B9 05 03/00, contacts F2 xx incl. the F2 05 codec, weather 8C/43/B5 00/42 with unit conversion, and the 0x41/41 FF codec only for the future Android forwarding slice) in Repo 1 exactly as spec.workSlices[S3], spec.commands, D4, D9, D10, D13, D14 (these frames carry private data: redaction prefixes are mandatory). Priority if time runs short: filter > world clock > alarms > contacts > weather; anything not done must reject NOT_SUPPORTED and be listed. Previous slices: ${prior([s1, s2])}. Golden vectors from the SDK sources or the reference captures (do not quote private payloads from the HCI capture; build fictitious inputs). Docs §6.2, §7.2, §11.2, §12.2. ${sliceTail}`, { label: 'S3:mensagens', phase: 'Protocolo', schema: SLICE_SCHEMA })
log(`S3 ${s3 ? s3.status : 'null'}`)
if (!s3 || s3.status !== 'green') {
  return { stoppedAt: 'S3', s1, s6, devdoc, s2, s3 }
}

const s4 = await agent(`${RULES}\n${CONTEXT}\nTASK: implement slice S4 (CRP interactions) in Repo 1 exactly as spec.workSlices[S4], spec.commands, D4, D11, D12: perform 61 (vibrate), 66 (camera, with the echo window), 53 0E; unsolicited RX 62 → FindPhone (empty or [0]=00 = start, any length), 66 → CameraShutter, 53 0E FF → CameraExited (other 53 only DEBUG); TX 62 FF codec only; events only after READY. ADDENDUM: WatchAction.FactoryReset → CRP 51 02 (verify the exact frame and that the watch sends no answer in the vendor SDKs; check what production does around it at TechnosWareCore v4.3.57 — e.g. whether production forget/disconnect sends it), completing on the write ack per D4; simulator support; golden + session tests; protocolo-crp.md §6.3/§11.3/§12.3 and a note that after 51 02 the watch's behavior (reboot, bond loss, disconnect) is to be confirmed in validation. Previous slices: ${prior([s1, s2, s3])}. ${sliceTail}`, { label: 'S4:interações', phase: 'Protocolo', schema: SLICE_SCHEMA })
log(`S4 ${s4 ? s4.status : 'null'}`)

phase('Revisão')
const reports = JSON.stringify({ s1, s2, s3, s4, s6, devdoc })
const LENSES = [
  { key: 'bytes', prompt: `LENS: PROTOCOL CORRECTNESS. For every command implemented in S1–S4 (settings, messages, interactions, factory reset) compare our encoder/decoder and the golden vectors byte by byte against the vendor sources (decompiled Android crpblelib in ${SCR}/vendor-sdks/crp/src; iOS SDK headers/binary in /Users/joao.farias/CrpTechnosIosSdk), the spec's D9 encodings and, where the production app sent the same command, the versioned reference fixtures in ${R1}/fixtures/reference/condorreebok/ (compare structure only; never quote private payloads). Check the D4 response policy per command (which ones the watch answers, optional answers, echo windows), the 2-byte isCmd matching, unsolicited RX decoding (62/66/53), and the D14 redaction prefixes (no private byte reaches the recorder; redacted frame has the same length). Flag golden vectors that were produced by our own encoder instead of an independent source.` },
  { key: 'engenharia', prompt: `LENS: ENGINEERING AND TESTS. Run in Repo 1: ./gradlew check dokkaHtml (report counts per target). Run in Repo 2 (from its CLAUDE.md): npm test, npx tsc --noEmit in example/, npm run typecheck, ESLint app + library, Prettier library. Review: WatchSession.applySetting/perform semantics (READY/SYNCING accepted and queued behind a sync, NOT_READY otherwise, DISCONNECTED on link loss, CANCELLED on disconnect/close, exactly one terminal callback per request — D5), thread confinement, SMA/iDO NOT_SUPPORTED, ObjC header constraints, KDoc completeness, phase 1 strict replays still green, regressions in existing tests. Repo 2: the 24 JS methods and 4 events match production names/arguments exactly (diff against git -C /Users/joao.farias/TechnosWareCore show v4.3.57:src/NativeModules/specs/NativeCore.ts and types), observed() wrapper, mock, Jest coverage, example Settings tab and the resetDevice confirmation.` },
  { key: 'docs-desvios', prompt: `LENS: DOCS, DEVIATIONS, PRIVACY, SCOPE. (1) ${R1}/docs/protocolo-crp.md phase 2 sections, decisoes.md ADRs, READMEs and ${R2}/docs/api-js.md: accurate, sourced, hypotheses labeled as such, consistent with the code. (2) ${DEV}: every deviation from production is present — cross-check the spec cutLine "FICA FORA" list, D8 (each bug), D12, D18 stubs, risks, the user decisions in ${DEC} (find phone A, background camera, HFP-only calls, Force pendency, notification forwarding pending with the SMS/accent changes, geolocation until phase 4, forget/reset split), phase 1 ADR deviations, and the slices' reported deviations (recordedInDoc=false ones especially); each production claim verified against TechnosWareCore v4.3.57 / Condor sources. Force pendency also in ${R1}/docs/pendencias.md. (3) Privacy: no MAC-like strings, no real personal data in tests/examples/docs, no private HCI payloads quoted. (4) Scope: git status/diff of both repos — nothing committed, nothing changed outside the two repos, the user's exports at the Repo 2 root untouched, no recording copied in; Portuguese, tabs, 120 columns in Repo 2 docs.` },
]
const verdicts = await parallel(LENSES.map(l => () => agent(`${RULES}\n${CONTEXT}\nThe slices below were just implemented by other agents. Their reports: ${reports}\n${l.prompt}\nREAD-ONLY: do not edit files (you may run builds/tests). Report only real, evidenced problems with file:line and a concrete fix; an empty findings list is fine.`, { label: `review:${l.key}`, phase: 'Revisão', schema: VERIFY_SCHEMA })))

const findings = verdicts.filter(Boolean).flatMap((v, i) => v.findings.map(f => ({ ...f, lens: LENSES[i].key })))
log(`${findings.length} achados de ${verdicts.filter(Boolean).length} revisores`)

phase('Correções')
const pendingDev = [s1, s2, s3, s4, s6].filter(Boolean).flatMap(s => s.deviations.filter(d => !d.recordedInDoc))
const fix = await agent(`${RULES}\n${CONTEXT}\nTASK: close part A of phase 2.
1) For each review finding below, verify the evidence yourself; apply it if real (code, tests or docs), reject with an evidence-based reason if not. High-severity byte or semantics findings first.
2) Record in ${DEV} every deviation the slices reported with recordedInDoc=false (verify each against production sources first): ${JSON.stringify(pendingDev)}
3) Run the full gates and report results: Repo 1 ./gradlew check dokkaHtml; Repo 2 npm test, npx tsc --noEmit (example/), npm run typecheck, ESLint app + library, Prettier library. Leave everything green, or return status red with the failing output. Do not run publishToMavenLocal/XCFramework (next workflow).
4) List the final set of changed/untracked files in both repos (git status --short).
FINDINGS: ${JSON.stringify(findings)}`, { label: 'correções', phase: 'Correções', schema: FIX_SCHEMA })

return {
  s1: s1 && { status: s1.status, summary: s1.summary, specDeviations: s1.specDeviations, openPoints: s1.openPoints, testsRun: s1.testsRun },
  s2: s2 && { status: s2.status, summary: s2.summary, specDeviations: s2.specDeviations, openPoints: s2.openPoints },
  s3: s3 && { status: s3.status, summary: s3.summary, specDeviations: s3.specDeviations, openPoints: s3.openPoints },
  s4: s4 && { status: s4.status, summary: s4.summary, specDeviations: s4.specDeviations, openPoints: s4.openPoints },
  s6: s6 && { status: s6.status, summary: s6.summary, specDeviations: s6.specDeviations, openPoints: s6.openPoints, testsRun: s6.testsRun },
  devdoc,
  findings,
  fix,
}
