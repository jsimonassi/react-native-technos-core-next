# react-native-technos-core-next

Core React Native (TurboModule `NativeCoreNext`) dos smartwatches Technos, escrito sobre o módulo Kotlin
Multiplatform [`technos-watch-protocol`](../technos-watch-protocol/README.md). Lá ficam o domínio, a sessão e os
codecs (`:protocol`) e o que cada método JS faz (o `CoreBridge`, no `:bridge`: checagens, eventos, ordem
evento/`resolve`, rejeições, pareamento salvo, reconexão automática). Esta biblioteca é a casca React Native sobre o
`CoreBridge` e é dona do BLE do Android, do histórico local e do log.

**Estado: PoC.** Família SMA (Mormaii fitGPS), só Android, RN 0.81 com a nova arquitetura. O iOS ainda não existe
(ver [`docs/ios-pendente.md`](docs/ios-pendente.md)); importar a biblioteca no iOS lança erro. Uma primeira sessão
com o relógio real (fitGPS 0.2.1, 2026-10-29) pareou, sincronizou e reconectou depois de desligar e religar o
Bluetooth ([o que ela mostrou](docs/transporte-android.md#o-que-a-gravação-do-fitgps-mostrou)); o checklist completo
([`example/README.md`](example/README.md#checklist-de-aceite-com-o-fitgps)) ainda não foi feito. O que falta está em
[`docs/pendencias.md`](docs/pendencias.md).

## Início rápido

Pré-requisitos: Node 20+, JDK 17, Android SDK (`ANDROID_HOME`), um Android físico e um Mormaii fitGPS.

```sh
# 1. Publicar os módulos do Repo 1 (:protocol e :bridge) no Maven local (~/.m2)
cd technos-watch-protocol && ./gradlew publishToMavenLocal

# 2. Rodar o app de exemplo no celular
cd ../react-native-technos-core-next/example
npm install
npm start               # terminal 1: Metro
npm run android         # terminal 2
```

No app: aba Conexão → `Scan` → tocar no `fitGPS` → confirmar no relógio se ele pedir → estado `Conectado (2)`.

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
ios/                 # só o README do que falta; o podspec fica na raiz
example/             # app RN 0.81.4 com as abas Conexão, Dados e Log
docs/                # arquitetura, API JS, transporte Android, iOS pendente, pendências
```

Cada pasta de `android/.../corenext/` tem um `README.md` com o que faz, o que não faz e de quem depende.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Comandos, convenções, arquivos de contrato e quando atualizar cada doc |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Quem é dono de quê (o que mora no `CoreBridge` do Repo 1 e o que fica aqui), ciclo de vida da conexão, threading, eventos, códigos de erro |
| [`docs/api-js.md`](docs/api-js.md) | Cada método e evento, com payload de exemplo e o equivalente no Core atual |
| [`docs/transporte-android.md`](docs/transporte-android.md) | Fila GATT, autoConnect, MTU, CCCD, write type, Bluetooth on/off e limites conhecidos |
| [`docs/ios-pendente.md`](docs/ios-pendente.md) | O que falta para o iOS e as armadilhas já mapeadas |
| [`docs/pendencias.md`](docs/pendencias.md) | Pendências do host e da integração com o app Mormaii (sync de 59 s contra o watchdog de 50 s, polling de passos, `deviceId`, eventos sem equivalente) e o achado de que o Core de produção provavelmente infla os passos do fitGPS no backend |
| [`example/README.md`](example/README.md) | Rodar o exemplo, permissões, exportar o log, checklist com o relógio |
| [`src/README.md`](src/README.md) | Arquivos da camada JS |
| [`ios/README.md`](ios/README.md) | Como o XCFramework do Repo 1 entra no pod (futuro) |

O protocolo SMA (frames, CRC, handshake, catálogo de comandos) está documentado no Repo 1, em
[`docs/protocolo-sma.md`](../technos-watch-protocol/docs/protocolo-sma.md).
