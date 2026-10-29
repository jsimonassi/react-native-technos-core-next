# CLAUDE.md

Guia curto para agentes e para quem chega agora. O que a biblioteca faz e como começar está no
[`README.md`](README.md); o desenho, em [`docs/arquitetura.md`](docs/arquitetura.md).

## O que é e o que não é

- **É**: um Core React Native fino (TurboModule `NativeCoreNext`, nova arquitetura) para os relógios Technos, sobre
  o módulo Kotlin Multiplatform `technos-watch-protocol` (Repo 1). O Android é dono do BLE (`ble/`), do
  armazenamento local (`store/`) e do log (`log/`); o JS (`src/`) expõe os mesmos nomes do Core atual
  (`TechnosCore`, `TechnosEvents`, `deviceConnectStates`, `deletedCategory`).
- **Não é**: lugar de regra de protocolo. Bytes, frames, handshake, estados da sessão, fila de comandos, sync e
  agregação de passos moram no Repo 1. Se a mudança mexe em algum desses, ela vai para lá.
- Escopo da PoC: família SMA (Mormaii fitGPS), só Android. Fora: iOS (só o podspec esqueleto, ver
  [`docs/ios-pendente.md`](docs/ios-pendente.md)), DFU, notificações, chamadas, outras famílias, CI e publicação.
- O `TechnosWareCore` e o app Mormaii são só referência de leitura; cite-os (`arquivo:linha`), não mude nada lá.

## Dependência do Repo 1 (Maven local)

O `android/build.gradle` depende de `br.com.grupotechnos.watch:protocol:0.1.0`, lido do `~/.m2` (`mavenLocal`
limitado ao grupo `br.com.grupotechnos.watch`, na biblioteca e no `example/android/build.gradle`). Não há
publicação remota. Mudou o Repo 1:

```sh
cd ../technos-watch-protocol && ./gradlew :protocol:check publishToMavenLocal
cd ../react-native-technos-core-next/example/android && ./gradlew --refresh-dependencies :app:assembleDebug
```

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

Antes de dizer que terminou: testes nativos + `:app:assembleDebug`, `npm test`, os dois typechecks e o ESLint.

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

## Exportar e puxar o log

Aba Log → `Export` (chama `TechnosCore.exportLogs()`). O nativo grava `frames-<carimbo>.jsonl` (pacotes GATT no
formato de fixture do Repo 1) e `logs-<carimbo>.jsonl` (o anel de 2000 entradas) em
`/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/`:

```sh
adb pull /storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext ./corenext-export
```

A gravação de frames vira fixture real do Repo 1 em `fixtures/real/fitgps/<fw>/<cenário>.jsonl` (formato no
`docs/fixtures.md` de lá). Um cenário por gravação: `Export` antes de cada `Clear` (o `Clear` apaga o anel e a
gravação). Os exports são cumulativos (o anterior é prefixo do seguinte): copie só o `frames-*.jsonl` mais recente.
**Nunca** versione `logs-*.jsonl` nem a pasta `corenext-export/`: o log tem o MAC do relógio. Quem os ignora é o
`.gitignore` da raiz, e ele só protege um clone se estiver versionado: `git ls-files .gitignore` tem de imprimir o
nome. Se não imprimir, ele (e o `.editorconfig`) entra no próximo commit, antes de qualquer `git add -A`.

## Contrato (mudar com cuidado)

| Arquivo | O que é | Mudou? |
|---|---|---|
| `src/specs/NativeCoreNext.ts` | Spec do TurboModule; o codegen gera o `NativeCoreNextSpec` Java a partir dele | Mude o `NativeCoreNextModule.kt`, o wrapper `src/index.ts`, o mock `src/__mocks__/` e o `docs/api-js.md` na mesma alteração |
| `src/types/events.ts` | Formato de cada evento | Mude o `bridge/EventMapper.kt` (e o teste dele), o mock e o `docs/api-js.md` juntos |
| `package.json` `codegenConfig` | Nome `NativeCoreNextSpec`, pacote Java `br.com.grupotechnos.corenext` | Quebra o autolinking e o JNI; só com motivo forte |

Nomes e formatos do Core atual (`react-native-technos-ware-core`) são mantidos de propósito para o app Mormaii
trocar de pacote mudando só o import; um campo novo entra como opcional. Códigos de erro: os da sessão vêm do
`WatchErrorCodes.kt` do Repo 1, os do host de `bridge/HostErrorCodes.kt`; os dois aparecem em `src/constants.ts`
(`errorCodes`) e na tabela do `docs/api-js.md`. Mudou uma lista, mude as três.

Do lado nativo, o host também cumpre o contrato do Repo 1: `Transport` (um `onDisconnected` por `disconnect()`
com link aberto ou pendente; Bluetooth desligado entrega só `onBluetoothStateChanged(false)`, nenhum `onDisconnected`,
e o `disconnect()` seguinte não emite nada; eventos em ordem; regra no `ble/LinkLifecycle`), `SampleStore` e
`WatchSessionListener` (um callback terminal por `requestId`; o `RequestRegistry` nunca usa `-1`).

## Pacotes Android e dependências

Código em `android/src/main/java/br/com/grupotechnos/corenext/`. As pastas `ble/`, `bridge/`, `store/` e `log/` **nunca
importam umas às outras**: quem as liga é o `CoreGraph` (um por processo) e o `NativeCoreNextModule` (um por instância
do JS), na raiz do pacote, com o `CoreSessionListener`.

| Pacote | Pode depender de | Quem liga |
|---|---|---|
| raiz (`CoreGraph`, `CoreSessionListener`, `NativeCoreNextModule`, `NativeCoreNextPackage`) | `ble/`, `bridge/`, `store/`, `log/`, Repo 1, Android SDK, `react-android` | — (é o ponto de montagem) |
| `ble/` | Repo 1 (`transport`, `profile`, `log`), Android SDK | `CoreGraph` |
| `bridge/` | Repo 1 (`domain`, `profile`, `log`), `java.time`; `react-android` **só** em `WritableConverter` | `CoreGraph` e `NativeCoreNextModule` |
| `store/` | Repo 1 (`session.SampleStore`, `domain`, `log`), Android SDK, `org.json` | `CoreGraph` |
| `log/` | Repo 1 (`log`), Android SDK, `org.json` | `CoreGraph` |

Nenhum pacote fala o protocolo SMA: regra de protocolo mora no Repo 1. Público para quem consome a biblioteca é só o
que `src/index.ts` exporta (e o mock `src/__mocks__/`); as classes Kotlin são detalhe de implementação, mesmo as que
estão `public` por exigência do RN (o módulo e o pacote).

## Convenções

- **Idioma**: documentação, READMEs, KDoc, TSDoc e comentários em português do Brasil. Identificadores, nomes de
  arquivo, mensagens de log e de exceção e códigos de erro em inglês. Textos que o usuário vê no app de exemplo
  ficam em português.
- **Formato**: tabs em Kotlin, Gradle, TS e JS (`.editorconfig`); aspas duplas em TS/JS (ESLint e Prettier do
  `example/`); JSON com 2 espaços.
- **KDoc** nas classes de `ble/`, `bridge/`, `store/` e `log/`; **TSDoc** nos métodos do spec e do `src/index.ts`.
- **Comentários** explicam o porquê (quirk do Android ou do relógio, compatibilidade com o Core atual), nunca o quê.
  Afirmação sobre o relógio ou sobre o Core atual cita a fonte (`SMAService.java:254-262`) ou a fixture.
- Cada pasta de `android/src/main/java/br/com/grupotechnos/corenext/` tem `README.md` (o que faz, o que não faz,
  de quem depende); pasta nova ganha o seu.
- Lógica testável sem Android fica em Kotlin puro (`bridge/`, `store/SampleJsonCodec`, `GattQueue`, `LinkLifecycle`)
  com teste em `android/src/test/`.

## Onde está cada doc e quando atualizar

| Mudou… | Atualize |
|---|---|
| método, evento, payload, código de erro, comportamento visto pelo JS | [`docs/api-js.md`](docs/api-js.md) + TSDoc do spec/wrapper |
| quem faz o quê, ciclo de vida, threading, FGS, reconexão automática | [`docs/arquitetura.md`](docs/arquitetura.md) |
| GATT, fila, MTU, CCCD, write type, autoConnect, Bluetooth on/off | [`docs/transporte-android.md`](docs/transporte-android.md) |
| algo descoberto que afeta o iOS futuro | [`docs/ios-pendente.md`](docs/ios-pendente.md) |
| pendência do host ou da integração com o app Mormaii (watchdog do sync, polling, `deviceId`, eventos sem equivalente) | [`docs/pendencias.md`](docs/pendencias.md) |
| como rodar, permissões, abas, checklist com o relógio | [`example/README.md`](example/README.md) |
| arquivos do `src/` | [`src/README.md`](src/README.md) |
| hipótese do protocolo confirmada ou derrubada no relógio | `docs/decisoes.md` e `docs/protocolo-sma.md` do Repo 1 |
| o que falta validar com o relógio | `docs/pendencias.md` do Repo 1 |
