# `ios/` (não implementado nesta PoC)

A PoC prova o desenho no Android. O iOS tem só o esqueleto do pod (`react-native-technos-core-next.podspec`, na raiz)
e este README. Plano detalhado e armadilhas em [`../docs/ios-pendente.md`](../docs/ios-pendente.md).

## O que existe

- `react-native-technos-core-next.podspec`: iOS 15.1, `source_files "ios/**/*.{h,m,mm,swift}"`,
  `vendored_frameworks "ios/Frameworks/TechnosWatchProtocol.xcframework"`, `install_modules_dependencies`.
  O 15.1 é o mínimo do RN 0.81 (`react-native/scripts/cocoapods/helpers.rb:83-85`) e o
  `IPHONEOS_DEPLOYMENT_TARGET` do `example/ios`; um pod 16.0 seria recusado pelo `pod install` do example. O app
  Mormaii está em 16.0 (`GTE-Mormaii/ios/Podfile:68`), o que um pod 15.1 aceita.
- O XCFramework do Repo 1 (estático, prefixo ObjC `TWP`), gerado assim:
  ```
  cd ../technos-watch-protocol
  ./gradlew :protocol:assembleTechnosWatchProtocolXCFramework
  mkdir -p ../react-native-technos-core-next/ios/Frameworks
  cp -R protocol/build/XCFrameworks/release/TechnosWatchProtocol.xcframework ../react-native-technos-core-next/ios/Frameworks/
  ```
  A pasta `ios/Frameworks/` é artefato de build: não versionar.

## O que falta (em ordem)

1. `CentralTransport.swift`: implementação do `Transport` (`TWPTransport`) sobre `CBCentralManager`/`CBPeripheral`,
   com fila de operações equivalente à `GattQueue` do Android.
2. `CoreNext.bootstrap(launchOptions:)`: cria o `CBCentralManager` com `CBCentralManagerOptionRestoreIdentifierKey`
   no `application(_:didFinishLaunchingWithOptions:)` do app, antes do JS. O TurboModule só se anexa depois.
3. `CoreGraph.swift`: `WatchSession(transport:logger:store:)`, `FileSampleStore` (JSON em `Application Support`),
   `PairingPrefs` (`UserDefaults` numa suíte própria), `RingLogger` com `os_log`.
4. `RCTNativeCoreNext.mm`: shim ObjC++ que conforma ao `NativeCoreNextSpec` gerado pelo codegen e delega cada método
   para o Swift, e recebe do Swift as chamadas `emitOnX`.
5. Conversão `NSData` ↔ `KotlinByteArray` (o header gerado hoje só expõe `TWPKotlinByteArray`).
6. Example iOS (`example/ios`, `Podfile` com o pod por `:path`, `UIBackgroundModes` `bluetooth-central`,
   `NSBluetoothAlwaysUsageDescription`).

## O que não vai existir aqui

Lógica de protocolo (fica no Repo 1). SDK de fabricante (`SmaTechnosIosSdk` e afins): o transporte fala direto com o
CoreBluetooth.
