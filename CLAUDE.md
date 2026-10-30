# CLAUDE.md

Guia curto para agentes e para quem chega agora. O que a biblioteca faz e como começar está no
[`README.md`](README.md); o desenho, em [`docs/arquitetura.md`](docs/arquitetura.md).

## O que é e o que não é

- **É**: um Core React Native fino (TurboModule `NativeCoreNext`, nova arquitetura) para os relógios Technos, sobre
  o módulo Kotlin Multiplatform `technos-watch-protocol` (Repo 1). O que cada método JS faz mora no `CoreBridge` do
  `:bridge` de lá; o `NativeCoreNextModule` (Android) e o `RCTNativeCoreNext.mm` (iOS) só chamam o controlador, e cada
  plataforma implementa o `CoreHost` (`AndroidCoreHost`, `IosCoreHost`) e é dona do BLE (`ble/`), do armazenamento local
  (`store/`) e do log (`log/`). O JS (`src/`) expõe os mesmos nomes do Core atual (`TechnosCore`, `TechnosEvents`,
  `deviceConnectStates`, `deletedCategory`).
- **Não é**: lugar de regra de protocolo nem de regra de método JS. Bytes, frames, handshake, estados da sessão,
  fila de comandos, sync e agregação de passos moram no `:protocol` do Repo 1; as checagens antes de chamar a sessão,
  os eventos e a ordem evento/`resolve`, as rejeições, o `NO_DATA`, o pareamento salvo, o FGS do sync, a reconexão
  automática e o ciclo de vida do módulo moram no `CoreBridge` (`:bridge`). Se a mudança mexe em algum desses, ela vai
  para lá.
- Escopo da PoC: famílias SMA (Mormaii fitGPS) e iDO (Mormaii Life Ultra GPS, só as funções básicas), no Android e no
  iOS (o iOS testado no simulador e ainda não num iPhone com relógio; [`docs/ios-pendente.md`](docs/ios-pendente.md)).
  Os perfis, os nomes do scan, os UUIDs e os CCCD vêm do Repo 1 (`Profiles.all`); nada aqui é escrito por família.
  Fora: DFU, notificações, chamadas, outras famílias e modelos, CI e publicação.
- O `TechnosWareCore` e o app Mormaii são só referência de leitura; cite-os (`arquivo:linha`), não mude nada lá.

## Dependência do Repo 1 (Maven local)

O `android/build.gradle` depende de `br.com.grupotechnos.watch:bridge:0.1.0` (que traz o `protocol:0.1.0` como
`api`), lido do `~/.m2` (`mavenLocal` limitado ao grupo `br.com.grupotechnos.watch`, na biblioteca e no
`example/android/build.gradle`). Não há publicação remota. Mudou o Repo 1:

```sh
cd ../technos-watch-protocol && ./gradlew check publishToMavenLocal
cd ../react-native-technos-core-next/example/android && ./gradlew --refresh-dependencies :app:assembleDebug
```

O Repo 1 tem dois módulos: `:protocol` (sessão, domínio, protocolos SMA e iDO) e `:bridge` (o contrato JS comum e o
`CoreBridge`, que os dois hosts usam para cada método JS). O `publishToMavenLocal` publica os dois para o Android. O iOS
usa o XCFramework que sai do `:bridge` (`bridge/build/XCFrameworks/release/`), copiado para `ios/Frameworks/` (não
versionado) por `ios/scripts/sync-xcframework.sh` (`--build` gera antes no Repo 1); sem ele o `pod install` para com a
instrução. Mudou API que o Swift vê no Repo 1: `sync-xcframework.sh --build`, `pod install` e os testes do iOS.

A versão continua `0.1.0`, então o Gradle não percebe a troca sozinho em todos os casos: use
`--refresh-dependencies` depois de republicar. Conferir que o app pegou o artefato:
`./gradlew :app:dependencies --configuration debugRuntimeClasspath | grep grupotechnos`.

## Comandos

A raiz não tem `node_modules` nem wrapper Gradle, e não deve ganhar: tudo roda pelo `example/`. O build Android
precisa de `ANDROID_HOME` (ou `example/android/local.properties` com `sdk.dir`) e JDK 17.

| O quê | Onde | Comando |
|---|---|---|
| Instalar dependências JS | `example/` | `npm install` |
| Testes unitários nativos (JVM) | `example/android/` | `./gradlew :react-native-technos-core-next:testDebugUnitTest` |
| Lint Android da biblioteca | `example/android/` | `./gradlew :react-native-technos-core-next:lintDebug` |
| Codegen do spec | `example/android/` | `./gradlew :react-native-technos-core-next:generateCodegenArtifactsFromSchema` |
| APK de debug do exemplo | `example/android/` | `./gradlew :app:assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk` |
| Jest (wrapper, utils, hooks, App) | `example/` ou raiz | `npm test` (na raiz, `npm test` chama o do `example/`) |
| Typecheck do app + `../src` | `example/` | `npx tsc --noEmit` |
| Typecheck só da biblioteca | raiz | `npm run typecheck` (usa o `tsc` do `example/node_modules`) |
| ESLint do app | `example/` | `npx eslint .` |
| ESLint da biblioteca | `example/` | `npx eslint --no-eslintrc --config .eslintrc.js --resolve-plugins-relative-to . ../src --ext .ts,.tsx` |
| Prettier da biblioteca | `example/` | `npx prettier --config .prettierrc.js --check "../src/**/*.ts"` |
| Bundle Metro (prova que o JS resolve) | `example/` | `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output <dir>/index.android.bundle --assets-dest <dir>/assets` |
| Trazer o framework do Repo 1 (iOS) | raiz | `ios/scripts/sync-xcframework.sh` (`--build` roda o Gradle do Repo 1 antes) |
| Testes do host iOS no simulador (Swift, sem RN) | `ios/` | `xcodebuild test -scheme TechnosCoreNext -destination "platform=iOS Simulator,id=<UDID>"` (linhas `IOS-REPLAY`; `ios/Tests/README.md`) |
| Pods do exemplo (roda o codegen iOS) | `example/ios/` | `pod install` |
| App de exemplo no simulador | `example/ios/` | `xcodebuild -workspace CoreNextExample.xcworkspace -scheme CoreNextExample -configuration Debug -destination "platform=iOS Simulator,id=<UDID>" build` (ou `npx react-native run-ios` no `example/`) |
| Build para iPhone sem assinar (só compila) | `example/ios/` | `xcodebuild -workspace CoreNextExample.xcworkspace -scheme CoreNextExample -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build` |

`<UDID>`: de `xcrun simctl list devices available`. Não use `name=iPhone 17 Pro`: com dois simuladores de mesmo nome
(há dois no iOS 26.1 desta máquina) o `xcodebuild` falha com "multiple devices matched". Log do simulador:
`xcrun simctl spawn <UDID> log stream --level debug --predicate 'subsystem == "br.com.grupotechnos.corenext"'` (sem
`--level` não aparece nada: o Core loga em `info`/`debug`).

Antes de dizer que terminou: testes nativos + `:app:assembleDebug`, `npm test`, os dois typechecks e o ESLint. Mexeu no
iOS (`ios/`, podspec, `codegenConfig`, `example/ios`): também os testes do host no simulador e os dois builds do
exemplo (simulador Debug e iPhone Release sem assinar).

## Rodar no celular

O emulador não tem Bluetooth de verdade: use um Android físico com depuração USB (`adb devices` mostra
`device`).

```sh
cd example
npm start                 # terminal 1: Metro
npm run android           # terminal 2: npx react-native run-android (build, instala, abre, adb reverse 8081)
```

Sem o `run-android`: `cd example/android && ./gradlew :app:assembleDebug`, depois
`adb install -r app/build/outputs/apk/debug/app-debug.apk` e `adb reverse tcp:8081 tcp:8081` com o Metro rodando
(o APK de debug não embute o JS). Log nativo: `adb logcat -s CoreNext`. Permissões, abas e o checklist A3–A8
estão em [`example/README.md`](example/README.md).

No iPhone (o simulador não tem Bluetooth): assinatura com o time pessoal, Modo Desenvolvedor e o resto em
[`example/README.md`](example/README.md#rodar-no-iphone). Log nativo: console do Xcode ou Console.app, subsistema
`br.com.grupotechnos.corenext`; no Console.app, ligue Ação → Incluir Mensagens de Informação (e de Depuração, para o hex
dos frames), senão só WARN e ERROR aparecem.

## Exportar e puxar o log

Aba Log → `Export` (chama `TechnosCore.exportLogs()`). O nativo grava `frames-<carimbo>.jsonl` (pacotes GATT no
formato de fixture do Repo 1) e `logs-<carimbo>.jsonl` (o anel de 2000 entradas) em
`/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/`:

```sh
adb pull /storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext ./corenext-export
```

A gravação de frames vira fixture real do Repo 1 em `fixtures/real/<perfil>/<fw>/<cenário>.jsonl` (`fitgps` ou
`lifeultragps`; formato no
`docs/fixtures.md` de lá). Um cenário por gravação: `Export` antes de cada `Clear` (o `Clear` apaga o anel e a
gravação). Os exports são cumulativos (o anterior é prefixo do seguinte): copie só o `frames-*.jsonl` mais recente.
**Nunca** versione `logs-*.jsonl` nem a pasta `corenext-export/`: o log tem o MAC do relógio. Quem os ignora é o
`.gitignore` da raiz, e ele só protege um clone se estiver versionado: `git ls-files .gitignore` tem de imprimir o
nome. Se não imprimir, ele (e o `.editorconfig`) entra no próximo commit, antes de qualquer `git add -A`.

## Contrato (mudar com cuidado)

| Arquivo | O que é | Mudou? |
|---|---|---|
| `src/specs/NativeCoreNext.ts` | Spec do TurboModule; o codegen gera o `NativeCoreNextSpec` Java a partir dele | Mude o `CoreBridge` do Repo 1 (com os testes e os portões de interop de lá), o `NativeCoreNextModule.kt`, o `ios/CoreNext/turbomodule/RCTNativeCoreNext.mm`, o wrapper `src/index.ts`, o mock `src/__mocks__/` e o `docs/api-js.md` na mesma alteração |
| `src/types/events.ts` | Formato de cada evento | Mude o `EventMapper` do `:bridge` do Repo 1 (e o teste e o golden de lá), republique, e mude o mock e o `docs/api-js.md` juntos |
| `package.json` `codegenConfig` | Nome `NativeCoreNextSpec`, pacote Java `br.com.grupotechnos.corenext`, `ios.modulesProvider` (`NativeCoreNext` → `RCTNativeCoreNext`) | Quebra o autolinking, o JNI ou o registro do módulo no iOS; só com motivo forte |
| `react-native-technos-core-next.podspec` | Pod iOS: fontes `ios/CoreNext/**`, módulo `TechnosCoreNext`, framework do Repo 1 vendorizado | Muda o `import TechnosCoreNext` do app e o `TechnosCoreNext-Swift.h` do shim |

Nomes e formatos do Core atual (`react-native-technos-ware-core`) são mantidos de propósito para o app Mormaii
trocar de pacote mudando só o import; um campo novo entra como opcional. Códigos de erro: os da sessão vêm do
`WatchErrorCodes.kt` do `:protocol`, os do host do `HostErrorCodes.kt` do `:bridge` (os dois no Repo 1); os dois
aparecem em `src/constants.ts` (`errorCodes`) e na tabela do `docs/api-js.md`. Mudou uma lista, mude as três.

Do lado nativo, o host também cumpre o contrato do Repo 1: `Transport` (um `onDisconnected` por `disconnect()`
com link aberto ou pendente; Bluetooth desligado entrega só `onBluetoothStateChanged(false)`, nenhum `onDisconnected`,
e o `disconnect()` seguinte não emite nada; eventos em ordem; regra no `ble/LinkLifecycle` de cada plataforma) e
`SampleStore`; e o do `CoreBridge`: `CoreHost` (o `AndroidCoreHost` e o `IosCoreHost`, thread-safe e sem lançar, salvo
`exportLogs`), `CoreEventSink` (o módulo de cada plataforma, que se liga com `attach` no primeiro método JS e só chama
`invalidate`/`onHostResume` depois disso) e `CoreCompletion` (o `PromiseCompletion` de cada plataforma; no iOS, todo
valor passa pelo `FoundationConverter`). O `WatchSessionListener` é o do `CoreBridge` (um callback terminal por
`requestId`; o `RequestRegistry` de lá nunca usa `-1`).

## Pacotes Android e dependências

Código em `android/src/main/java/br/com/grupotechnos/corenext/`. As pastas `ble/`, `bridge/`, `store/` e `log/` **nunca
importam umas às outras**: quem as liga é o `CoreGraph` (um por processo, com o `AndroidCoreHost`) e o
`NativeCoreNextModule` (um por instância do JS), na raiz do pacote. O pacote `bridge/` daqui é só o lado React Native
da ponte; o `br.com.grupotechnos.watch.bridge` do Repo 1 é o controlador.

| Pacote | Pode depender de | Quem liga |
|---|---|---|
| raiz (`CoreGraph`, `AndroidCoreHost`, `NativeCoreNextModule`, `NativeCoreNextPackage`) | `ble/`, `bridge/`, `store/`, `log/`, Repo 1 (`:bridge` e `:protocol`), Android SDK, `react-android` | — (é o ponto de montagem) |
| `ble/` | Repo 1 (`transport`, `profile`, `log`), Android SDK | `CoreGraph` |
| `bridge/` | `react-android`, Repo 1 (`CoreCompletion` do `:bridge`) | `NativeCoreNextModule` |
| `store/` | Repo 1 (`session.SampleStore`, `domain`, `log`), Android SDK, `org.json` | `CoreGraph` |
| `log/` | Repo 1 (`log`), Android SDK, `org.json` | `CoreGraph` |

Nenhum pacote fala o protocolo SMA nem decide o que um método JS faz: as duas coisas moram no Repo 1. Público para
quem consome a biblioteca é só o que `src/index.ts` exporta (e o mock `src/__mocks__/`); as classes Kotlin são
detalhe de implementação, mesmo as que estão `public` por exigência do RN (o módulo e o pacote).

## Pastas iOS e dependências

Código em `ios/CoreNext/` (README em cada pasta). Como no Android, `ble/`, `store/` e `log/` não usam umas às outras:
quem as liga é o `CoreGraph.swift`. O Swift não importa o React Native (compila e testa sem ele, pelo `ios/Package.swift`);
só o `turbomodule/RCTNativeCoreNext.mm` conhece o RN, e ele só chama o `TWPCoreBridge` e a API pública Swift
(`TCNCoreNext`, `TCNPromiseCompletion`).

| Pasta | Pode depender de | Quem liga |
|---|---|---|
| raiz (`CoreNext`, `CoreGraph`, `IosCoreHost`, `BackgroundWork`) | `ble/`, `store/`, `log/`, o framework do Repo 1, UIKit, CoreBluetooth | — (é o ponto de montagem) |
| `ble/` | Repo 1 (`transport`, `profile`, `log`), CoreBluetooth | `CoreGraph` |
| `store/` | Repo 1 (`SampleStore`, domínio, `log`), Foundation | `CoreGraph` |
| `log/` | Repo 1 (`log`), Foundation, `os` | `CoreGraph` |
| `turbomodule/` | React Native (codegen), Repo 1, a API pública da raiz | o React Native |

Lógica testável sem CoreBluetooth fica pura (`LinkLifecycle`, `GattQueue`, `BluetoothPowerTracker`, `SampleJsonCodec`)
com teste em `ios/Tests/`; o host inteiro é testado com as gravações reais do Repo 1 (`ReplayTransport`).

## Convenções

- **Idioma**: documentação, READMEs, KDoc, TSDoc e comentários em português do Brasil. Identificadores, nomes de
  arquivo, mensagens de log e de exceção e códigos de erro em inglês. Textos que o usuário vê no app de exemplo
  ficam em português.
- **Formato**: tabs em Kotlin, Gradle, TS, JS, Swift, Objective-C++ e shell (`.editorconfig`); aspas duplas em TS/JS
  (ESLint e Prettier do `example/`); JSON com 2 espaços. Os arquivos do `example/ios` gerados pelo template do RN
  (`AppDelegate.swift`, `Podfile`) mantêm os 2 espaços do template.
- **KDoc** nas classes de `ble/`, `bridge/`, `store/` e `log/`; comentários de documentação (`///`) em português nos
  tipos Swift e ObjC++ de `ios/CoreNext/`; **TSDoc** nos métodos do spec e do `src/index.ts`.
- **Comentários** explicam o porquê (quirk do Android ou do relógio, compatibilidade com o Core atual), nunca o quê.
  Afirmação sobre o relógio ou sobre o Core atual cita a fonte (`SMAService.java:254-262`) ou a fixture.
- Cada pasta de `android/src/main/java/br/com/grupotechnos/corenext/` e de `ios/CoreNext/` tem `README.md` (o que
  faz, o que não faz, de quem depende); pasta nova ganha o seu.
- Lógica testável sem Android fica em Kotlin puro (`bridge/ReadableConverter`, as conversões no fim do
  `AndroidCoreHost.kt`, `store/SampleJsonCodec`, `GattQueue`, `LinkLifecycle`) com teste em `android/src/test/`. Regra
  nova de método JS não entra aqui: vai para o `CoreBridge` do Repo 1, com teste de contrato lá.

## Onde está cada doc e quando atualizar

| Mudou… | Atualize |
|---|---|
| método, evento, payload, código de erro, comportamento visto pelo JS | [`docs/api-js.md`](docs/api-js.md) + TSDoc do spec/wrapper; a regra mora no `CoreBridge` (Repo 1: KDoc, `docs/arquitetura.md` seção 13, ADR 21, golden) |
| quem faz o quê, o que mora no `CoreBridge` e o que fica no host, ciclo de vida, threading, FGS, reconexão automática | [`docs/arquitetura.md`](docs/arquitetura.md) |
| GATT, fila, MTU, CCCD, write type, autoConnect, Bluetooth on/off | [`docs/transporte-android.md`](docs/transporte-android.md) |
| host iOS: peça, decisão, limite, algo validado ou descoberto no iPhone | [`docs/ios-pendente.md`](docs/ios-pendente.md) ("iOS: estado e pendências"), o README da pasta em `ios/CoreNext/` e, se mudou como rodar, [`ios/README.md`](ios/README.md) |
| pendência do host ou da integração com o app Mormaii (watchdog do sync, polling, `deviceId`, eventos sem equivalente) | [`docs/pendencias.md`](docs/pendencias.md) |
| como rodar (Android ou iPhone), permissões, abas, checklist com o relógio | [`example/README.md`](example/README.md) |
| arquivos do `src/` | [`src/README.md`](src/README.md) |
| hipótese do protocolo confirmada ou derrubada no relógio | `docs/decisoes.md` e `docs/protocolo-sma.md` do Repo 1 |
| o que falta validar com o relógio | `docs/pendencias.md` do Repo 1 |
