# `ios/`

O Core iOS: o pod do React Native (`../react-native-technos-core-next.podspec`, módulo Swift `TechnosCoreNext`) sobre o
framework do Repo 1, um pacote Swift só para os testes no simulador e o script que traz o framework. O desenho, as
decisões e o que ainda não foi validado estão em [`../docs/ios-pendente.md`](../docs/ios-pendente.md) ("iOS: estado e
pendências").

```
ios/
	CoreNext/            fontes do pod: host Swift (sem React) e o shim ObjC++ do TurboModule (README em cada pasta)
	Frameworks/          TechnosWatchProtocol.xcframework copiado do Repo 1 (não versionado; ver abaixo)
	scripts/             sync-xcframework.sh
	Package.swift        pacote Swift dos testes no simulador (não entra no app)
	Tests/               testes do host no simulador, com as gravações reais do Repo 1
```

## O que existe

- **Shim do TurboModule** (`CoreNext/turbomodule/RCTNativeCoreNext.mm`): os 23 métodos do spec, cada um uma chamada ao
  `TWPCoreBridge`, e o `TWPCoreEventSink` (os 13 eventos). Registrado pelo `codegenConfig.ios.modulesProvider` do
  `package.json` (o codegen escreve `"NativeCoreNext": "RCTNativeCoreNext"` no `RCTModuleProviders.mm` do app).
- **Host Swift** (`CoreNext/`): `CoreGraph` (um por processo), `IosCoreHost` (o `CoreHost`), `CentralTransport` (o
  `Transport` sobre o CoreBluetooth), `FileSampleStore`, `PairingStore`, `RingLogger`, `FrameRecorder` e
  `CoreNext.bootstrap(launchOptions:)` para a restauração do Bluetooth.
- **Testes no simulador** (`Tests/`, 47 testes): o host inteiro com o `CoreBridge` e a sessão do framework, sobre um
  transporte que responde com as gravações reais do fitGPS (167 e 32 TX) e do Life Ultra GPS (12 TX), mais o contrato B,
  a fila de operações, a restauração, o re-arme (e o vínculo apagado que não re-arma), o status de cada `NSError` e o
  tipo de escrita sem CoreBluetooth.
- **App de exemplo** (`../example/ios`): `pod install`, build Debug no simulador e Release para iPhone (sem assinatura
  aqui), `NSBluetoothAlwaysUsageDescription`, `UIBackgroundModes` `bluetooth-central`, export visível no app Arquivos e
  `CoreNext.bootstrap` no `AppDelegate`.

Rodou num iPhone com os dois relógios em 2026-10-30 (Release; sem reconexão nem segundo plano): o resultado e o que falta
estão no [`docs/ios-pendente.md`](../docs/ios-pendente.md#o-que-o-iphone-mostrou-2026-10-30), e o roteiro, no
[`example/README.md`](../example/README.md#rodar-no-iphone).

## O framework do Repo 1

`Frameworks/TechnosWatchProtocol.xcframework` é o framework guarda-chuva do módulo `:bridge` do Repo 1 (com o
`:protocol` exportado; estático; prefixo ObjC `TWP`). **Não é versionado aqui** (`.gitignore`: `ios/Frameworks/`): são
cerca de 22 MB de binário gerados do código do Repo 1, que mudariam a cada alteração de lá e duplicariam no git o que o
Repo 1 já reproduz. O custo é um passo antes do `pod install`:

```sh
ios/scripts/sync-xcframework.sh           # copia bridge/build/XCFrameworks/release/ do Repo 1 (irmão deste repo)
ios/scripts/sync-xcframework.sh --build   # roda antes ./gradlew assembleTechnosWatchProtocolXCFramework no Repo 1
```

O script confere o header das duas fatias (`ios-arm64` e `ios-arm64-simulator`) e que o `CoreBridge` está lá, e grava
em `Frameworks/VERSION.txt` o commit do Repo 1 copiado. Outro lugar para o Repo 1: `TECHNOS_WATCH_PROTOCOL_DIR`. Sem o
framework, o `pod install` para com a instrução (o podspec levanta `Pod::Informative`), e o `xcodebuild test` do pacote
Swift reclama do `binaryTarget`. Mudou API que o Swift vê no Repo 1: `--build`, `pod install` e build de novo.

## Escolher o simulador

Os comandos abaixo usam o UDID do simulador, não o nome: com dois simuladores de mesmo nome (dois "iPhone 17 Pro" no
iOS 26.1, por exemplo), `-destination 'platform=iOS Simulator,name=iPhone 17 Pro'` falha com "multiple devices
matched". `name=` só serve se o nome for único.

```sh
xcrun simctl list devices available       # escolha um iPhone e copie o UDID (o código entre parênteses)
SIM=<UDID>
```

## Testes do host no simulador

```sh
cd ios
xcodebuild test -scheme TechnosCoreNext -destination "platform=iOS Simulator,id=$SIM"
```

Detalhes, o que cada teste confere e as linhas `IOS-REPLAY`: [`Tests/README.md`](Tests/README.md).

## App de exemplo no simulador

O simulador não tem Bluetooth (o central fica `.unsupported`), então o app mostra `Bluetooth desligado (4)`; serve para
provar que o módulo registra, responde e emite.

```sh
cd example && npm install && npm start          # Metro (terminal 1)
cd example/ios && pod install
xcrun simctl boot "$SIM" 2>/dev/null; open -a Simulator    # liga o simulador, se ainda não estiver
xcodebuild -workspace CoreNextExample.xcworkspace -scheme CoreNextExample -configuration Debug \
	-destination "platform=iOS Simulator,id=$SIM" -derivedDataPath build/dd build
xcrun simctl install "$SIM" build/dd/Build/Products/Debug-iphonesimulator/CoreNextExample.app
xcrun simctl spawn "$SIM" log stream --level debug \
	--predicate 'subsystem == "br.com.grupotechnos.corenext" OR category == "javascript"'     # terminal 2, antes do launch
xcrun simctl launch "$SIM" br.com.grupotechnos.corenext.example
```

O `--level debug` é obrigatório: o Core loga em `info` e `debug` no `os_log` (`RingLogger.osLogType`; só WARN e ERROR
saem como `default` e `error`), e o `console.info` do JS também é `info`; sem `--level`, o `log stream` mostra só
`default` e acima, e a tela fica vazia. `--level info` basta se não quiser o hex dos frames (`Frame/…`, em `debug`).

(ou `npx react-native run-ios` no `example/`). No log: `CoreGraph/init`, `centralManagerDidUpdateState: state=unsupported`,
`RCTNativeCoreNext/attach`, `[CoreNextExample] initialize() resolved` e `onConnectStateChanged {"state":4,...}`.

## iPhone

Build para aparelho, assinatura com o time pessoal, Modo Desenvolvedor, o pedido do Bluetooth e os roteiros com os dois
relógios: [`../example/README.md`](../example/README.md#rodar-no-iphone). Para conferir só que compila, sem assinar:

```sh
cd example/ios
xcodebuild -workspace CoreNextExample.xcworkspace -scheme CoreNextExample -configuration Release -sdk iphoneos \
	-destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

## Integração num app (o Mormaii)

1. `ios/scripts/sync-xcframework.sh` e o pod por `:path` (ou autolinking) no `Podfile`; `pod install`.
2. No `AppDelegate`, antes do React Native: `import TechnosCoreNext` e `CoreNext.bootstrap(launchOptions: launchOptions)`.
3. `Info.plist`: `NSBluetoothAlwaysUsageDescription` e `UIBackgroundModes` com `bluetooth-central` (o Mormaii já tem
   os dois).

O que muda para o app e o que não foi verificado (frameworks dinâmicos, o identificador de restauração do Core atual):
[`../docs/ios-pendente.md`](../docs/ios-pendente.md#integração-no-app-mormaii).

## O que não vai existir aqui

Lógica de protocolo nem regra de método JS (ficam no Repo 1: `:protocol` e `CoreBridge`). SDK de fabricante
(`SmaTechnosIosSdk` e afins): o transporte fala direto com o CoreBluetooth.
