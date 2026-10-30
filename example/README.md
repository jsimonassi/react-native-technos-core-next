# App de exemplo

App React Native 0.81.4 (a mesma versão do app Mormaii) para validar o `react-native-technos-core-next` com o relógio
de verdade. É o equivalente ao `examples/basic` do Core atual, reduzido ao escopo da PoC: Mormaii fitGPS, Android.

A biblioteca é ligada da raiz do repositório, sem cópia em `node_modules`: `react-native.config.js` (autolinking),
`metro.config.js` (`watchFolders`/`extraNodeModules`), `tsconfig.json` (`paths`) e `jest.config.js`
(`moduleNameMapper`). Editar `../src` recarrega no Metro como código do próprio app.

## Pré-requisitos

- Node 20+, JDK 17 e Android SDK (compileSdk 36). O `npm install` é feito aqui; a raiz não tem `node_modules`.
- Celular Android físico com depuração USB. O emulador não tem Bluetooth de verdade.
- Os módulos do Repo 1 publicados no Maven local, porque o build Android depende de
  `br.com.grupotechnos.watch:bridge:0.1.0`, que traz o `br.com.grupotechnos.watch:protocol:0.1.0`. O
  `publishToMavenLocal` publica os dois:

  ```sh
  cd ../../technos-watch-protocol && ./gradlew publishToMavenLocal
  ```

- Um Mormaii fitGPS carregado. Feche o app Mormaii em outros celulares por perto: um periférico BLE já conectado em
  geral para de anunciar e não aparece no scan.

## Rodar

```sh
cd example
npm start                 # terminal 1: Metro
npm run android           # terminal 2: build, instala e abre no celular conectado (faz o adb reverse da porta 8081)
```

`adb devices` precisa listar o aparelho como `device`. Para ver o log nativo junto: `adb logcat -s CoreNext`.

## Permissões

Pedidas ao abrir o app (aba Conexão, cartão "Permissões"):

| Android | Permissões | Por quê |
|---|---|---|
| 12+ (API 31+) | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` | scan e conexão BLE; sem localização graças ao `neverForLocation` do manifest do módulo |
| 13+ (API 33+) | `POST_NOTIFICATIONS` (opcional) | notificação do serviço de sync; negada, o sync roda igual e a notificação não aparece na gaveta |
| 11 ou menor | `ACCESS_FINE_LOCATION` | o scan BLE exige localização até a API 30 |

Negou com "não perguntar de novo": o cartão mostra "Bloqueadas" e o botão "Abrir configurações". Para começar do
zero: `adb uninstall br.com.grupotechnos.corenext.example` e `npm run android` de novo.

## As três abas

**Conexão.** Permissões; situação do `initialize()`; estado (`state` numérico, `sessionState` e fase do handshake);
último erro; `Disconnect` (desconecta e mantém o pareamento); `Forget` (UNBIND, apaga pareamento e histórico);
`Reconnect last` (`getLastPairedDevice` + `startPairingAttempt`); `isConnected()`; `Scan`/`Stop` (7 s) com a lista
`{name, bleName, deviceId, rssi}`; toque num relógio = `pairDevice`, com spinner até resolver ou rejeitar. Cartões
Relógio (`getDeviceInfo` + `getFirmwareInfo`), Bateria, Hora (`setTime`) e Passos de hoje (`refreshSteps`).

**Dados.** `Sync` com a barra de `onSyncProgress`. `Passos` = `getHistoryPedometer(3)` esperando `onHistoryPedometer`
por até 20 s (o mesmo tempo do app Mormaii): passos, kcal e km por dia, o JSON cru selecionável e o botão para
confirmar o envio dos dias anteriores (`deletedSavedData`). `Sono` = `getHistorySleep` esperando `onHistorySleep` ou
`NO_DATA`.

**Log.** Entradas de `onLog`, a mais nova embaixo, até 2000 (o tamanho do anel nativo; ao abrir, o app carrega o
que o nativo já tinha com `getLogs`). Filtro por texto (tag, mensagem, hex), nível mínimo, "Hex dos frames",
"Só TX/RX", `Clear` (JS e nativo), `Recarregar`, `Export`, `Share` e o nível do log nativo (`setLogLevel`).

## Exportar e copiar o log

1. Aba Log → `Export`. O app mostra o caminho e os comandos, selecionáveis (toque e segure para copiar).
2. O nativo grava dois arquivos em
   `/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/`:
   `frames-<carimbo>.jsonl` (todos os pacotes GATT desde o último `Clear`, no formato de fixture do Repo 1) e
   `logs-<carimbo>.jsonl` (o anel do log).
3. No computador, com o celular no USB:

   ```sh
   adb pull "/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/frames-20261028-143000.jsonl"
   adb pull "/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/logs-20261028-143000.jsonl"
   # ou a pasta inteira:
   adb pull /storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext ./corenext-export
   ```

   Se o caminho mostrado começar com `/data/user/0/` (aparelho sem armazenamento externo), use o comando `run-as`
   que o app mostra: `adb pull` não lê a área interna do app sem root.
4. A gravação de frames vira fixture real no Repo 1, em
   `technos-watch-protocol/fixtures/real/fitgps/<fw>/<cenário>.jsonl` (ex.: `fitgps/0.2.1/pair-battery-version.jsonl`;
   formato e nomes em `docs/fixtures.md` do Repo 1). Um cenário por gravação: `Export` antes de cada `Clear` (o `Clear`
   apaga o anel e a gravação), e `Clear` antes do cenário seguinte.
   - Copie **só o `frames-*.jsonl` mais recente** de cada cenário. Os exports são cumulativos: cada um traz tudo desde
     o último `Clear`, e o anterior é prefixo exato dele (na gravação de 2026-10-29, `frames-20261029-082857.jsonl` é
     prefixo de `frames-20261029-083254.jsonl`).
   - **Nunca** versione `logs-*.jsonl`: o log tem o MAC do relógio. O arquivo de frames não tem.
   - Uma reconexão no meio do cenário (Bluetooth desligado e religado) pode ficar no mesmo arquivo: o harness de
     replay do Repo 1 a reproduz.

`Share` manda as últimas 500 entradas do log como texto `.jsonl` (uma entrada por linha). O `Share` do React Native
não anexa arquivo no Android, e um texto muito grande estoura o limite do Intent; para o arquivo completo, use
`Export`.

## Checklist de aceite com o fitGPS

Critérios A3 a A8 do plano da PoC. Antes de começar: `Clear` na aba Log, relógio perto, Bluetooth ligado.

| # | Passos | Esperado |
|---|---|---|
| A3 | Conexão → `Scan`. Tocar no `fitGPS`. Confirmar no relógio se ele pedir. | A lista mostra `fitGPS`, `Mormaii_fitGPS · fitgps`, o MAC e o RSSI. O estado passa por `Conectando (1)` (`CONNECTING`, `CONFIGURING`, `HANDSHAKING · BIND`, `HANDSHAKING · LOGIN`) e termina em `Conectado (2)` `READY`. Aparece "Pareado com fitGPS". |
| A4 | Cartão Relógio → `Ler`. Cartão Bateria → `Ler`. | Firmware no formato `x.y.z` e `onFirmwareInfo` com `braceletType 0 · platformCode 0`. A porcentagem é a mesma da tela do relógio. |
| A5 | Mudar a hora do celular (Data e hora manual, alguns minutos à frente). Voltar ao app → cartão Hora → `Set time`. | "Hora enviada" com a hora do celular, e o relógio passa a mostrar a mesma hora. Volte a hora automática depois. |
| A6 | Andar um pouco com o relógio. Dados → `Sync`. Depois `Passos`. | A barra chega a 100% e o status fica "Concluído". `onHistoryPedometer` lista até 4 dias (hoje e os 3 anteriores) e o total de hoje é o mesmo da tela de passos do relógio. `Refresh steps` na aba Conexão mostra o mesmo total. |
| A7 | Conexão → `Disconnect`; depois `Reconnect last`; depois `Forget` e repetir A3. | `Disconnect` leva a `Desconectado (0)` e o app não reconecta sozinho. `Reconnect last` volta a `Conectado (2)` sem confirmação no relógio (só LOGIN). `Forget` leva a `Desconectado (0)` e "Último pareado: nenhum"; o novo pareamento funciona sem reinstalar o app. |
| A8 | Aba Log durante A3 a A6, com "Hex dos frames" ligado. Depois `Export` e `Share`. | Cada **pacote** aparece como `TX`/`RX` com tag `Frame/<uuid>` e hex. Com MTU 23 o cabeçalho de RX chega sozinho numa notificação, então as linhas de pacote RX não trazem `cmd/key` nem CRC: são o resumo do `SmaDriver.describe` do Repo 1 seguido do tamanho do pacote (`ACK seq=<n> len=8`, `seq=<n> header len=<n> len=8`) ou só `len=<n> (cont.)` nos fragmentos seguintes (`RingLogger.frame`; ex.: `logs-20261029-083254.jsonl`). O resumo de cada **frame** remontado está nas linhas `SmaDriver/frame`: `TX seq=<n> <rótulo> len=<n>` e `RX seq=<n> <rótulo> len=<n> crc=ok`. `Export` mostra o caminho; o `adb pull` traz `frames-*.jsonl` com o cabeçalho e uma linha por pacote. `Share` abre o seletor com o `.jsonl` em texto. |
| Exploratório | Dormir com o relógio. De manhã: `Sync` e depois `Sono`. | `onHistorySleep` com estágios, ou "NO_DATA". Nunca fica sem resposta: o botão volta ao normal em até 20 s. |

A cada rodada, registre (para o `decisoes.md` do Repo 1): firmware do relógio, modelo e versão do Android, os UUIDs
anunciados no scan (linha `BleScanner/onScanResult` do log) e os arquivos exportados. No fitGPS 0.2.1 o anúncio traz
`180f`, `180a` e `00000001-0000-1000-8000-00805f9b34fb`, sem o NUS (`logs-20261029-083254.jsonl`, linha 6, ts
1793272444786): o
relógio só aparece no scan pelo filtro de nome `Mormaii_fitGPS`. Vale conferir de novo em outro firmware.

O que a primeira gravação com o relógio (2026-10-29) já respondeu está em
[`../docs/transporte-android.md`](../docs/transporte-android.md#o-que-a-gravação-do-fitgps-mostrou); o que ainda
falta testar no aparelho, no `docs/pendencias.md` do Repo 1.

## Verificações sem relógio

```sh
cd example
npx tsc --noEmit          # app + ../src
npm test                  # Jest: wrapper, utils, useCoreEvents, helpers, renderização do App
npx eslint .              # tabs, aspas duplas e as regras do @react-native/eslint-config
```

Nos testes, o nome do pacote aponta para o mock oficial (`../src/__mocks__/react-native-technos-core-next.ts`) e os
imports profundos (`react-native-technos-core-next/src/...`) para os arquivos reais (ver `jest.config.js`).

## Estrutura

```
App.tsx                      # abas e initialize()
src/theme.ts                 # paletas clara e escura (useColorScheme)
src/hooks/useCoreEvents.ts   # inscreve em todos os eventos; estado + anel de log
src/hooks/coreState.ts       # reducer puro do estado
src/hooks/usePermissions.ts  # PermissionsAndroid por nível de API
src/hooks/useCommand.ts      # spinner, erro e hora do último sucesso de um comando
src/screens/                 # ConnectionScreen, DataScreen, LogScreen
src/components/              # botões, cartões, badge de estado, barra de abas
src/helpers/                 # formatação, anel de log e jsonl, comandos adb
__tests__/                   # Jest
```

## Problemas comuns

- **Nada aparece no scan.** Veja "Último erro" no cartão Estado: `PERMISSION_DENIED` (permissões) ou `BLUETOOTH_OFF`.
  Sem erro: o relógio pode estar conectado a outro celular ou longe.
- **`HANDSHAKE_FAILED` no pareamento.** O relógio não respondeu o BIND/LOGIN, ou a confirmação na tela não foi feita
  em 60 s. Tente de novo; se repetir, `Forget` e reinicie o relógio.
- **`NOT_READY` nos botões.** O estado não é `Conectado (2)`.
- **`Passos` volta vazio.** Rode o `Sync` antes: `getHistoryPedometer` lê só o histórico local.
- **Build falha com `Could not find br.com.grupotechnos.watch:bridge:0.1.0` (ou `protocol:0.1.0`).** Falta o
  `publishToMavenLocal` do Repo 1, que publica os dois. Um `~/.m2` de antes do `:bridge` tem só o `protocol`, e o erro
  cita o `bridge`.
