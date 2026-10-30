# react-native-technos-core-next

Core React Native (TurboModule `NativeCoreNext`) dos smartwatches Technos, escrito sobre o módulo Kotlin
Multiplatform [`technos-watch-protocol`](../technos-watch-protocol/README.md). Lá ficam o domínio, a sessão e os
codecs (`:protocol`) e o que cada método JS faz (o `CoreBridge`, no `:bridge`: checagens, eventos, ordem
evento/`resolve`, rejeições, pareamento salvo, reconexão automática). Esta biblioteca é a casca React Native sobre o
`CoreBridge` e é dona do BLE (Android e iOS), do histórico local e do log.

**Estado: PoC.** Famílias SMA (Mormaii fitGPS) e iDO (Mormaii Life Ultra GPS, só as funções básicas: pareamento com confirmação na tela, reconexão, bateria, firmware, hora e o total de passos do dia), Android e iOS, RN 0.81 com a nova arquitetura. O iOS
existe desde 2026-10-30, passou no simulador com as gravações reais dos dois relógios e, no mesmo dia, rodou num iPhone
com os dois (app de exemplo em Release): pareamento, comandos e sync com o fitGPS 0.2.1 e com o Life Ultra GPS 1.1.1,
este depois de esquecer nos Ajustes do iPhone um vínculo Bluetooth antigo que o relógio tinha apagado (o erro
`PAIRING_REMOVED`). No iPhone ainda não foram testados a reconexão (Bluetooth desligado com o relógio conectado,
`Reconnect last`, fora de alcance), o segundo plano e a restauração
([o que o iPhone mostrou](docs/ios-pendente.md#o-que-o-iphone-mostrou-2026-10-30)). Uma primeira sessão
com o relógio real (fitGPS 0.2.1, 2026-10-29) pareou, sincronizou e reconectou depois de desligar e religar o
Bluetooth ([o que ela mostrou](docs/transporte-android.md#o-que-a-gravação-do-fitgps-mostrou)); o checklist completo
([`example/README.md`](example/README.md#checklist-de-aceite-com-o-fitgps)) ainda não foi feito. O que falta está em
[`docs/pendencias.md`](docs/pendencias.md). O Life Ultra GPS (iDO) foi testado no aparelho em 2026-10-30 com o driver próprio, sem SDK de fornecedor:
pareamento com confirmação no relógio, bateria, firmware, hora e passos; a reconexão e o restante do roteiro
([`example/README.md`](example/README.md#checklist-com-o-life-ultra-gps-ido)) ainda não foram gravados.

## Início rápido

Pré-requisitos: Node 20+, JDK 17, Android SDK (`ANDROID_HOME`), um Android físico e um Mormaii fitGPS ou Life Ultra GPS.
Para o iPhone: Xcode 26, CocoaPods, Node 20+, JDK 17 e o clone do `technos-watch-protocol` ao lado deste (para gerar
o framework do Repo 1), e um Apple ID ([`example/README.md`](example/README.md#rodar-no-iphone)).

```sh
# 1. Publicar os módulos do Repo 1 (:protocol e :bridge) no Maven local (~/.m2)
cd technos-watch-protocol && ./gradlew publishToMavenLocal

# 2. Rodar o app de exemplo no celular
cd ../react-native-technos-core-next/example
npm install
npm start               # terminal 1: Metro
npm run android         # terminal 2
```

No app: aba Conexão → `Scan` → tocar no `fitGPS` ou no `Life Ultra GPS` → confirmar no relógio (o Life Ultra GPS sempre
pede no primeiro pareamento) → estado `Conectado (2)`.

No iPhone:

```sh
ios/scripts/sync-xcframework.sh --build   # gera o XCFramework no Repo 1 e copia para ios/Frameworks/
cd example && npm install && npm start    # terminal 1: Metro
cd example/ios && pod install && xed .    # Xcode: assinar com o seu time pessoal e Run no iPhone
```

## Uso no app

A API mantém os nomes do Core atual (`react-native-technos-ware-core`), então trocar de pacote é mudar o import:

```ts
import { TechnosCore, TechnosEvents, utils } from "react-native-technos-core-next";

await TechnosCore.initialize();
const sub = TechnosEvents.onBatteryStatus(event => console.log(event.percentage));
await TechnosCore.getBatteryStatus();
sub.remove();
```

Diferença principal: comandos devolvem `Promise<void>` que rejeita com um código de `errorCodes`; o dado continua
chegando pelo evento. Referência completa, payloads de exemplo e roteiro de migração do Mormaii:
[`docs/api-js.md`](docs/api-js.md). Para Jest há um mock oficial em `src/__mocks__/react-native-technos-core-next.ts`.

## Layout

```
src/                 # JS: spec do TurboModule, wrapper TechnosCore/TechnosEvents, tipos, utils, mock
android/             # módulo Android (Kotlin): NativeCoreNextModule (casca sobre o CoreBridge), CoreGraph,
                     # AndroidCoreHost e as pastas abaixo
  .../corenext/ble/      # BluetoothGatt, fila GATT, scan, Bluetooth on/off, serviço de sync em primeiro plano
  .../corenext/bridge/   # React Native ↔ valores puros: WritableConverter, ReadableConverter, PromiseCompletion
  .../corenext/store/    # histórico local (JSON atômico) e pareamento salvo
  .../corenext/log/      # anel de log, Logcat, onLog e gravação de frames para fixture
ios/                 # pod iOS (o podspec fica na raiz): CoreNext/ com o host Swift (CentralTransport, CoreGraph,
                     # IosCoreHost, stores, log) e o shim ObjC++ do TurboModule; Tests/ (simulador); scripts/
example/             # app RN 0.81.4 com as abas Conexão, Dados e Log
docs/                # arquitetura, API JS, transporte Android, iOS pendente, pendências
```

Cada pasta de `android/.../corenext/` e de `ios/CoreNext/` tem um `README.md` com o que faz, o que não faz e de quem
depende.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Comandos, convenções, arquivos de contrato e quando atualizar cada doc |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Quem é dono de quê (o que mora no `CoreBridge` do Repo 1 e o que fica aqui), ciclo de vida da conexão, threading, eventos, códigos de erro |
| [`docs/api-js.md`](docs/api-js.md) | Cada método e evento, com payload de exemplo e o equivalente no Core atual |
| [`docs/transporte-android.md`](docs/transporte-android.md) | Fila GATT, autoConnect, MTU, CCCD, write type, Bluetooth on/off e limites conhecidos |
| [`docs/ios-pendente.md`](docs/ios-pendente.md) | iOS: estado e pendências (peças, decisões do CoreBluetooth, o que o primeiro teste no iPhone mostrou, o que foi verificado sem iPhone, o que falta) |
| [`docs/pendencias.md`](docs/pendencias.md) | Pendências do host e da integração com o app Mormaii (sync de 59 s contra o watchdog de 50 s, polling de passos, `deviceId`, eventos sem equivalente) e o achado de que o Core de produção provavelmente infla os passos do fitGPS no backend |
| [`example/README.md`](example/README.md) | Rodar o exemplo no Android e no iPhone, permissões, exportar o log, checklists com os relógios |
| [`src/README.md`](src/README.md) | Arquivos da camada JS |
| [`ios/README.md`](ios/README.md) | O pod iOS, o XCFramework do Repo 1 (`sync-xcframework.sh`), testes no simulador e builds |

O protocolo SMA (frames, CRC, handshake, catálogo de comandos) está documentado no Repo 1, em
[`docs/protocolo-sma.md`](../technos-watch-protocol/docs/protocolo-sma.md).
