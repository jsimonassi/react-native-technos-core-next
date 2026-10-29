# `br.com.grupotechnos.corenext` (Android)

Implementação Android do TurboModule `NativeCoreNext`. É um host fino: transporte BLE, persistência, log e ponte
com o JavaScript. Toda regra de protocolo (frames SMA, handshake, sync) está no `technos-watch-protocol` (Repo 1),
consumido como AAR (`br.com.grupotechnos.watch:protocol:0.1.0`, via `mavenLocal`).

## Arquivos da raiz

| Arquivo | Papel |
|---|---|
| `NativeCoreNextModule.kt` | Estende o `NativeCoreNextSpec` gerado pelo codegen. Só traduz JS ↔ `WatchSession`: valida entrada, registra a Promise com um `requestId`, chama a sessão. |
| `NativeCoreNextPackage.kt` | `BaseReactPackage` encontrado pelo autolinking. |
| `CoreGraph.kt` | Grafo do processo: `WatchSession(AndroidGattTransport, RingLogger, FileSampleStore)`, scanner, prefs, fila de eventos. Sobrevive ao reload do JS. |
| `CoreSessionListener.kt` | `WatchSessionListener` do grafo: grava pareamento, sobe/desce o FGS do sync, emite eventos e liquida Promises. |

## Pastas

- [`ble/`](ble/README.md): `BluetoothGatt`, fila GATT, scan, estado do adaptador, FGS do sync.
- [`bridge/`](bridge/README.md): domínio → payload JS, estado → `deviceConnectStates`, fila de eventos, Promises.
- [`store/`](store/README.md): histórico em JSON e último pareamento.
- [`log/`](log/README.md): anel de log, Logcat, `onLog` e gravação de frames em `.jsonl`.

## O que não fica aqui

Protocolo de fabricante, máquina de estados da sessão, agregação de passos e análise de sono (Repo 1).
Pedido de permissão (o JS pede; o nativo só confere e rejeita com `PERMISSION_DENIED`). iOS (`ios/README.md`).

## Invariantes

- Um `CoreGraph` por processo; um `NativeCoreNextModule` por instância React (recriado no reload).
- Todo comando com Promise termina com exatamente um `resolve` ou `reject`, porque a sessão garante um callback
  terminal por `requestId`. Toda rejeição também sai como evento `onError` com o nome do método.
- Nada aqui bloqueia a thread do GATT nem a do JS: o módulo roda na thread de módulos nativos do RN, o transporte na
  `HandlerThread` "corenext-gatt" e o listener na thread da sessão.

## Testes

`cd example/android && ./gradlew :react-native-technos-core-next:testDebugUnitTest` (JVM, sem aparelho).
Arquitetura completa em `docs/arquitetura.md`; transporte em `docs/transporte-android.md`.
