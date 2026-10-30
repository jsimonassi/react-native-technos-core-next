# `ios/` (não implementado nesta PoC)

A PoC prova o desenho no Android. O iOS tem só o esqueleto do pod (`react-native-technos-core-next.podspec`, na raiz)
e este README. Plano detalhado e armadilhas em [`../docs/ios-pendente.md`](../docs/ios-pendente.md).

## O que existe

- `react-native-technos-core-next.podspec`: iOS 15.1, `source_files "ios/**/*.{h,m,mm,swift}"`,
  `vendored_frameworks "ios/Frameworks/TechnosWatchProtocol.xcframework"`, `install_modules_dependencies`.
  O 15.1 é o mínimo do RN 0.81 (`react-native/scripts/cocoapods/helpers.rb:83-85`) e o
  `IPHONEOS_DEPLOYMENT_TARGET` do `example/ios`; um pod 16.0 seria recusado pelo `pod install` do example. O app
  Mormaii está em 16.0 (`GTE-Mormaii/ios/Podfile:68`), o que um pod 15.1 aceita.
- O XCFramework do Repo 1 (estático, prefixo ObjC `TWP`). Ele sai do módulo `:bridge` de lá, com o `:protocol`
  exportado: um framework só, com a `WatchSession`, o contrato JS comum (`EventMapper`, `StateMapper`,
  `SavedDataMapper`, `HostErrorCodes`, `PendingEvents`, `RequestRegistry`, `FoundationConverter`; ADR 20 de lá) e o
  controlador `CoreBridge` com `CoreHost`, `CoreEventSink` e `CoreCompletion` (ADR 21), o mesmo que o Android usa.
  Gerado assim:
  ```
  cd ../technos-watch-protocol
  ./gradlew assembleTechnosWatchProtocolXCFramework
  mkdir -p ../react-native-technos-core-next/ios/Frameworks
  cp -R bridge/build/XCFrameworks/release/TechnosWatchProtocol.xcframework ../react-native-technos-core-next/ios/Frameworks/
  ```
  A pasta `ios/Frameworks/` é artefato de build: não versionar. Até a ADR 20 do Repo 1, o framework saía de
  `protocol/build/XCFrameworks/`; um XCFramework antigo copiado de lá não tem o contrato JS.

## O que falta (em ordem)

1. `CentralTransport.swift`: implementação do `Transport` (`TWPTransport`) sobre `CBCentralManager`/`CBPeripheral`,
   com fila de operações equivalente à `GattQueue` do Android.
2. `CoreNext.bootstrap(launchOptions:)`: cria o `CBCentralManager` com `CBCentralManagerOptionRestoreIdentifierKey`
   no `application(_:didFinishLaunchingWithOptions:)` do app, antes do JS. O TurboModule só se anexa depois.
3. `CoreGraph.swift`: `WatchSession(transport:logger:store:)` e `CoreBridge(session:logger:host:)`, um por processo;
   implementa `CoreHost` como o `AndroidCoreHost` (`../docs/ios-pendente.md`, seção "Sem regra no host") e chama os
   ganchos do processo; `FileSampleStore` (JSON em `Application Support`), `PairingPrefs` (`UserDefaults` numa suíte
   própria), `RingLogger` com `os_log`, thread-safe como o do Android (a sessão o chama de mais de uma thread;
   [`../docs/ios-pendente.md`](../docs/ios-pendente.md#threading-visto-pelo-host-ios)).
4. `RCTNativeCoreNext.mm`: shim ObjC++ que conforma ao `NativeCoreNextSpec` gerado pelo codegen; cada método embrulha
   resolve/reject numa `TWPCoreCompletion` e chama o seletor de mesmo nome do `TWPCoreBridge`, e o módulo é o
   `TWPCoreEventSink` (o `emitOnX` de cada nome). Sem regra: a forma exata é o
   `bridge/objc-interop/MinimalTurboModule.mm` do Repo 1, que o `check` de lá compila.
5. ~~Conversão `NSData` ↔ `KotlinByteArray`~~: pronta no Repo 1 (`iosMain`, pacote `ios`). No Swift:
   `value.toData()` no `write` e no `frame`, `session.events.onNotification(characteristic:data:)` e
   `session.events.onReadCompleted(requestId:data:status:)` com o `Data` do `CoreBluetooth`,
   `ByteBridgeKt.toByteArray(data)` para o resto; conferida pelo `./gradlew :bridge:checkSwiftInterop` de lá
   ([`../docs/ios-pendente.md`](../docs/ios-pendente.md#bytes-nsdata--kotlinbytearray)).
6. ~~Payloads para o JS como `NSDictionary`~~: pronto no Repo 1 (`:bridge`, `iosMain`, `FoundationConverter`), com
   booleanos `CFBoolean` (o JS recebe `true`/`false`, não `1`/`0`). No Swift:
   `FoundationConverter.shared.toDictionary(payload:)` antes de cada `emitOnX`, e
   `FoundationConverter.shared.toArray(values: [value])[0]` em todo `resolve` de uma `CoreCompletion`
   ([`../docs/ios-pendente.md`](../docs/ios-pendente.md#payloads-para-o-js-nsdictionary-e-cfboolean)).
7. Example iOS (`example/ios`, `Podfile` com o pod por `:path`, `UIBackgroundModes` `bluetooth-central`,
   `NSBluetoothAlwaysUsageDescription`).

## O que não vai existir aqui

Lógica de protocolo nem regra de método JS (ficam no Repo 1: `:protocol` e `CoreBridge`). SDK de fabricante
(`SmaTechnosIosSdk` e afins): o transporte fala direto com o CoreBluetooth.
