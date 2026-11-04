export const meta = {
  name: 'ido-desk-spike',
  description: 'Desk spike for the iDO protocol (Life Ultra GPS): map GATT, framing, bind/auth/encryption and the basic commands from the decompiled SDK and its native library; build a btsnoop-to-jsonl parser; synthesize a protocol draft with the unknowns a real capture must answer',
  phases: [
    { title: 'Map', detail: 'Java side, native library, btsnoop parser in parallel' },
    { title: 'Synthesize', detail: 'protocol draft + go/no-go assessment for an own driver by tomorrow' },
  ],
}

const S = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const W = `${S}/ido`
const CTX = `
CONTEXT
- Goal: tomorrow there is a presentation; we want our own Kotlin driver for the iDO watch family (protocol reimplemented, no vendor SDK) doing the same basic functions already done for the SMA fitGPS: connect + bind/login (handshake), battery, firmware/device info, set time, today's steps (and the step history read used by sync, if simple). Test watch: Mormaii Life Ultra GPS (iDO SDK; see /Users/joao.farias/TechnosWareCore/android/src/main/java/com/reactlibrary/devices/AvailableDevices.java: Device("Smart Watch 6010", "Life Ultra GPS", "Life Ultra GPS", "IDOService")). Speed and certainty matter more than completeness.
- Sources (read-only): decompiled iDO SDK at ${S}/vendor-sdks/ido/src (obfuscated names; Fernflower output); the SDK artifacts in /Users/joao.farias/TechnosWareCore/android/libs/ (idoblesdk; may contain an .aar/.jar with jni/<abi>/*.so) and libs/maven-deps; the production Core's iDO integration in /Users/joao.farias/TechnosWareCore/android/src/main/java/com/ido/ (how initIDOSDK, pairDevice, getBatteryStatus, getFirmwareInfo, setTime, pedometer/history are called); an earlier analysis ${S}/results/sdk-ido.md (connection, bind, encrypted auth, UUIDs 0x0AF0 service, notify 0x0AF7 and 0x0AF2). For reference on how we documented SMA: /Users/joao.farias/technos-watch-protocol/docs/protocolo-sma.md.
- Tools: Android Studio decompilers (see memory: /Applications/Android Studio.app/Contents/plugins/java-decompiler/lib/java-decompiler.jar for jars), xcrun llvm-objdump / llvm-nm / llvm-readelf for ELF .so (aarch64 and armv7), strings, python3 (run with -I). No Ghidra, no tshark. Downloaded tools are not allowed. Put every intermediate file under ${W}/ (your own subfolder). Do NOT modify /Users/joao.farias/TechnosWareCore, /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/technos-watch-protocol or /Users/joao.farias/react-native-technos-core-next (another workflow is editing technos-watch-protocol right now).
- Report facts with sources (file:line, symbol name, address, string). Mark each claim as CONFIRMED (seen in code/disassembly) or INFERRED.
`

const FIND = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    facts: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, claim: { type: 'string' }, status: { type: 'string', enum: ['CONFIRMED', 'INFERRED'] }, source: { type: 'string' } }, required: ['topic', 'claim', 'status', 'source'] } },
    unknowns: { type: 'array', items: { type: 'string' } },
    artifacts: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'facts', 'unknowns', 'artifacts'],
}

phase('Map')
const [javaSide, nativeSide, parser] = await parallel([
  () => agent(`${CTX}
YOUR LENS: the Java side of the iDO SDK and how the production Core drives it. Work dir ${W}/java/.
Map, with sources: (1) GATT: service and characteristic UUIDs used for write and notify (normal channel vs health/big-data channel), write type, MTU/fragment size, CCCD order, delays after connect. (2) The JNI boundary: every native method (class, signature), how a command goes from Java to native (JSON string? struct? evt_type/cmd id ints?) and how bytes come back (callback methods, evt ids). Build a table of command/event ids with their names for: bind (BindPara, evt 200/202/203), unbind, encrypted auth at connect (encryptedAtConnected), get basic info / device info (version, battery?), get function table (needed? which flags gate bind/auth), set time, get battery, get live/today activity or steps, health/history sync (steps) if it is a simple request/response, setMode/bind mode, and any 'heartbeat' or mandatory post-connect commands. (3) The exact sequence the SDK runs from GATT connected to 'ready' for a first bind and for a reconnect of an already-bound watch, including what is stored in SharedPreferences (is_bind, bind_auth, encrypted_auth, function table) and what the watch must show (confirm on screen?). (4) For each basic function, the Java model fields (e.g. BasicInfo fields, battery fields, SystemTime fields, step fields) so we know what the JSON/struct carries. (5) What the production Core does for the Life Ultra GPS specifically (any special cases, gps_platform 3 etc.). Also look for any Java-side byte building (some commands may be framed in Java, e.g. CustomBytesDataSendManager, 'addCmdData', byte arrays starting with constants like 0x33, 0xDA, 0x02 0x01...).`, { label: 'map:java', phase: 'Map', schema: FIND }),
  () => agent(`${CTX}
YOUR LENS: the native library that implements the iDO protocol. Work dir ${W}/native/.
1. Find the .so files (unzip the SDK .aar/.jar into ${W}/native/unpacked/; list ABIs). Pick arm64-v8a (or the richest ABI). List exported symbols (JNI_OnLoad, Java_* functions, other exports) with llvm-nm -D / llvm-readelf; list RegisterNatives tables if JNI_OnLoad registers methods dynamically (find the JNINativeMethod arrays: name/signature string pointers).
2. strings: JSON keys, command names, format strings, log tags, version strings — they often reveal the protocol vocabulary (e.g. 'bind', 'auth', 'time', 'battery', 'activity', 'crc', 'v3', 'protocol').
3. Framing: find the function that turns a command into bytes and the one that parses incoming notifications. Determine with disassembly (xcrun llvm-objdump -d --no-show-raw-insn, follow from the JNI entry points): header/magic bytes, command/key layout, length fields, sequence/serial numbers, CRC/checksum algorithm (look for CRC tables: 0xA001/0x1021/0x8408 polynomials, 256-entry tables, or byte-sum loops), fragmentation into 20-byte packets and how continuation packets are marked, ACK behaviour.
4. Encryption/auth: look for AES S-box (63 7c 77 7b ...), TEA/XTEA constants (0x9E3779B9), MD5/SHA constants, embedded keys, and the function used by encrypted auth / encryptedAtConnected; say whether a secret key is embedded (and where) or derived (from what: MAC, random from watch, fixed string).
5. Give concrete byte layouts for as many of the basic commands as you can (bind, set time, get device info/battery, get steps), with the evidence. Be explicit about what is CONFIRMED by disassembly vs INFERRED.`, { label: 'map:native', phase: 'Map', schema: FIND }),
  () => agent(`${CTX}
YOUR LENS: tooling. Write ${W}/parser/btsnoop2jsonl.py (python3, stdlib only, run with python3 -I): input an Android btsnoop_hci.log (from adb bugreport: FS/data/misc/bluetooth/logs/btsnoop_hci.log, possibly several rotated files) or a whole bugreport .zip; output our fixture format (see /Users/joao.farias/technos-watch-protocol/docs/fixtures.md §1 for the exact JSON line format: a header line {"type":"header","device":...,"firmware":...,"platform":"android","mtu":...,"recordedAt":ISO with ms and offset,"timeZone":...} then {"type":"packet","dir":"TX"|"RX","atMs":...,"characteristic":"<uuid lowercase short or full as our docs use>","hex":"..."}). Requirements: parse btsnoop v1 (datalink 1002 H4 and 1001 H1), HCI ACL with L2CAP reassembly (continuation fragments), ATT on CID 0x0004: track Read By Type/Read By Group responses and Find Information responses to map handles to characteristic UUIDs and to know which CCCD belongs to which characteristic; emit TX for Write Request (0x12) and Write Command (0x52) and Prepare/Execute writes if present, RX for Handle Value Notification (0x1B) and Indication (0x1D); record Exchange MTU (0x02/0x03) to fill the header mtu; options --connection <handle> (default: the LE connection that carries the most ATT traffic to service 0x0AF0 or to any non-standard UUID) and --device/--firmware/--tz for the header; print a summary to stderr (connections found, handles→UUIDs, packet counts, SMP pairing presence, encryption change events). Handle the filtered snoop mode by detecting truncated ACL payloads and warning loudly. Write a unit test with a synthetic btsnoop file you generate in Python (including a fragmented L2CAP PDU, a discovery sequence, writes and notifications) and make it pass. Also write a tiny decoder skeleton ${W}/parser/ido_decode.py that prints each TX/RX packet with its characteristic and hex, grouping consecutive packets per characteristic, ready to be extended once the framing is known.`, { label: 'tool:btsnoop', phase: 'Map', schema: FIND }),
])

phase('Synthesize')
const synth = await agent(`${CTX}
Three mappers reported (claims; verify the critical ones yourself in the sources before relying on them):
JAVA: ${JSON.stringify(javaSide)}
NATIVE: ${JSON.stringify(nativeSide)}
TOOLING: ${JSON.stringify(parser)}

YOUR TASK (work dir ${W}/synth/):
1. Write ${W}/synth/protocolo-ido-rascunho.md in Portuguese: GATT, framing (with byte tables), CRC, fragmentation, handshake for first bind and reconnect (diagram), the encrypted auth question, and each basic command (bind, set time, device info/version, battery, today's steps, step history) with request/response layouts and the source of every statement, marking CONFIRMED vs INFERRED. End with a precise list of what an HCI snoop of the production Mormaii app pairing a Life Ultra GPS must answer (which packets to look for).
2. A go/no-go assessment for implementing our own Kotlin driver for the basic functions by tomorrow: biggest risks (encryption secret, unknown framing parts), what we can implement right now vs what needs the capture, and the fallback if encrypted auth cannot be reproduced. Be concrete and honest.
3. A proposed Kotlin design sketch for an IdoDriver inside technos-watch-protocol :protocol (mirroring the SMA package layout: codec, commands, driver, data mapper; a new DeviceProfile for Life Ultra GPS with its GATT candidates and quirks), listing files and the tests that would prove it with a captured fixture.
Return a short summary plus the path of the draft.`, { label: 'synthesize', phase: 'Synthesize', schema: FIND })

return { javaSide, nativeSide, parser, synth }
