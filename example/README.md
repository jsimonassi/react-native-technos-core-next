# App de exemplo

App React Native 0.81.4 (a mesma versão do app Mormaii) para validar o `react-native-technos-core-next` com o relógio
de verdade. É o equivalente ao `examples/basic` do Core atual, reduzido ao escopo da PoC: Mormaii fitGPS, Mormaii Life
Ultra GPS (iDO, funções básicas) e Condor Reebok (CRP, fase 1), Android e iPhone ([Rodar no iPhone](#rodar-no-iphone));
o mesmo JS nos dois.

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

- Um Mormaii fitGPS, Life Ultra GPS ou Condor Reebok carregado. Feche o app Mormaii (ou o Condor) em outros celulares
  por perto: um periférico BLE já conectado em geral para de anunciar e não aparece no scan. Com o Life Ultra GPS,
  desfaça o pareamento no app Mormaii de produção (ou force a parada dele) antes de testar, para os dois apps não
  disputarem o relógio; com o Condor Reebok, o mesmo no app Condor (roteiro em
  [Checklist com o Condor Reebok](#checklist-com-o-condor-reebok-crp)).

## Rodar

```sh
cd example
npm start                 # terminal 1: Metro
npm run android           # terminal 2: build, instala e abre no celular conectado (faz o adb reverse da porta 8081)
```

`adb devices` precisa listar o aparelho como `device`. Para ver o log nativo junto: `adb logcat -s CoreNext`.

## Rodar no iPhone

O simulador não tem Bluetooth: o teste com relógio é num iPhone físico (iOS 15.1 ou mais novo), assinado com o seu
Apple ID. Na primeira vez leva uns 20 minutos.

1. **Mac**: Xcode 26 (abra uma vez e aceite os componentes), CocoaPods (`pod --version`), Node 20+, JDK 17 (o
   `--build` do passo 2 roda o Gradle e o Kotlin/Native do Repo 1; `java -version` tem de dizer 17) e o clone do
   `technos-watch-protocol` ao lado deste repositório (`../technos-watch-protocol`), ou a variável
   `TECHNOS_WATCH_PROTOCOL_DIR` apontando para ele. A primeira geração do framework baixa o Kotlin/Native e leva vários
   minutos.
2. **Framework e dependências**, na raiz do repositório:

   ```sh
   ios/scripts/sync-xcframework.sh --build   # gera o TechnosWatchProtocol.xcframework no Repo 1 e copia para ios/Frameworks/
   cd example && npm install
   cd ios && pod install                      # roda também o codegen do TurboModule
   xed .                                      # abre o CoreNextExample.xcworkspace no Xcode (nunca o .xcodeproj)
   ```

3. **Conta**: Xcode → Settings → Accounts → `+` → Apple ID. Um Apple ID comum vira um time "Personal Team".
4. **Assinatura**: no navegador do projeto, `CoreNextExample` → target `CoreNextExample` → Signing & Capabilities →
   marque "Automatically manage signing" e escolha o seu "(Personal Team)". Troque o **Bundle Identifier** por um só seu
   (ex.: `br.com.grupotechnos.corenext.example.<seu-nome>`): o time pessoal não registra um identificador que outra conta
   já usou. Não precisa adicionar capability: o `Info.plist` já tem `bluetooth-central`, que não exige conta paga.
5. **iPhone**: conecte no cabo, desbloqueie e toque em "Confiar" neste computador. No iOS 16 ou mais novo, ative o
   Modo Desenvolvedor: Ajustes → Privacidade e Segurança → Modo Desenvolvedor (a opção só aparece depois de o iPhone ter
   sido visto pelo Xcode) → ligar → reiniciar → "Ativar".
6. **JS**: em Debug o app carrega o JS do Metro pela rede (iPhone e Mac na mesma Wi-Fi): `cd example && npm start`.
   Na primeira abertura em Debug o iOS pergunta se o app pode encontrar dispositivos na rede local → Permitir: é por
   ela que o app chega ao Metro do Mac. Se recusar, o app não carrega o JS; para desfazer: Ajustes → CoreNextExample →
   Rede Local. Para rodar sem o Mac por perto (demonstração), use Release: Product → Scheme → Edit Scheme → Run → Build
   Configuration → Release (o JS vai embutido e não há esse pedido).
7. **Rodar**: escolha o iPhone como destino no topo do Xcode e ⌘R. Na primeira vez o iPhone recusa abrir um app de
   "desenvolvedor não confiável": Ajustes → Geral → VPN e Gerenciamento de Dispositivo → o seu Apple ID → Confiar, e
   ⌘R de novo. Com o time pessoal o app vale 7 dias; depois é só rodar de novo pelo Xcode.
8. **Bluetooth**: ao abrir, o iOS pergunta se o app pode usar o Bluetooth ("O app usa o Bluetooth para encontrar,
   parear e sincronizar o seu relógio.") → Permitir. Se recusar: Ajustes → CoreNextExample → Bluetooth.
9. **Antes de cada relógio**: feche o app Mormaii no iPhone e em outros celulares por perto (um relógio conectado a
   outro app não anuncia nem aceita dois apps). Não pareie o relógio em Ajustes → Bluetooth: o app conecta direto. Se o
   relógio já aparece em Ajustes → Bluetooth (de um pareamento antigo, pelo app Mormaii de produção, por exemplo) e foi
   pareado com outro celular depois, esqueça-o ali antes: senão o iOS recusa a conexão (`PAIRING_REMOVED`, em
   [Problemas comuns](#problemas-comuns)).

**Log nativo**: o console do Xcode (filtre por `CoreNext`) ou o Console.app com o iPhone selecionado e o filtro
`subsystem:br.com.grupotechnos.corenext`. No Console.app, ligue Ação → Incluir Mensagens de Informação (e Incluir
Mensagens de Depuração, para o hex dos frames): o Core loga quase tudo em `info` e `debug`, e sem isso só aparecem WARN
e ERROR. O JS escreve `[CoreNextExample] initialize() resolved` e cada `onConnectStateChanged` no mesmo console (também
em `info`).

**Exportar no iPhone**: aba Log → `Export` → `Compartilhar arquivo` (AirDrop para o Mac, por exemplo), ou o app
Arquivos → No meu iPhone → CoreNextExample → corenext, onde ficam o `frames-*.jsonl` e o `logs-*.jsonl`. O
`frames-*.jsonl` (cabeçalho com `"platform":"ios"`) vira fixture no Repo 1 como no Android
(`fixtures/real/<perfil>/<fw>/<cenário>.jsonl`, cenário com `ios` no nome, ex.: `ios-pair-info-time-steps-sync.jsonl`).
No iOS o log não tem MAC (o endereço é um UUID que o iPhone gera para o app), mas o `logs-*.jsonl` continua fora do git:
as linhas do scan trazem o nome do iPhone e de outros aparelhos por perto.

**Roteiro**: os mesmos [A3–A8](#checklist-de-aceite-com-o-fitgps) (fitGPS) e [I1–I9](#checklist-com-o-life-ultra-gps-ido)
(Life Ultra GPS), com estas diferenças:

| Item | No iPhone |
|---|---|
| A3, I1 | O endereço na lista é um UUID (`6F1C2B8E-…`), não um MAC. A linha do scan no log é `CentralTransport/onScanResult`. Se o relógio não aparecer, anote nome e serviços dessa linha. |
| A3, I2 | No log: `CentralTransport/connect`, `didConnect … mtu=<n>`, `discoverServices`, `enableNotifications` (no Life Ultra GPS, `0af7` e depois `0af2`); no fitGPS, `requestMtu requested=247 effective=<n>`: anote o `<n>` (esperado 23; foi 23 em 2026-10-30). Anote também as linhas `discoverServices service=… characteristics=[…]`: as propriedades do `0af6` (Life Ultra GPS) e do `6e400002` (fitGPS). Nenhum `CentralTransport/write` com status de erro nem WARN `… declares [...]`. |
| A5, I5 | Hora manual no iPhone: Ajustes → Geral → Data e Hora → desligue "Ajustar Automaticamente". Volte depois. |
| A7, I7 | Desligue o Bluetooth em Ajustes → Bluetooth (o botão da Central de Controle só desconecta acessórios e pode não chegar ao app como Bluetooth desligado). O estado deve ir a `Bluetooth desligado (4)` e voltar a `Conectado (2)` sozinho, só com LOGIN. Teste também fechar o app pelo app switcher, abrir de novo e ver a reconexão sozinha. |
| A8, I9 | `Export` e `Compartilhar arquivo` em vez do `adb pull`. |
| Extra | Negar o Bluetooth (Ajustes → CoreNextExample → Bluetooth desligado) e tocar em `Scan`: "Último erro" `PERMISSION_DENIED`, `Missing Bluetooth`. Religar. |
| Extra (segundo plano) | Com o relógio em `Conectado (2)`, mande o app para o segundo plano (botão de início) e afaste o relógio até cair (o log mostra `didDisconnectPeripheral` e um `connect … autoReconnect=true`). Com o relógio longe, abra apps pesados (câmera, jogos) até o iOS encerrar o CoreNextExample; **não** feche pelo app switcher, que desliga a restauração. Traga o relógio de volta sem abrir o app. No Console.app: `CoreGraph/init` novo (o iOS relançou o app), `willRestoreState`, `Keeping restored connection` ou um `didConnect` da tentativa da sessão, `reconnectIfPaired … (Bluetooth turned on)` e a sessão chegando a `READY`. `No connect for restored` é falha. |

**Primeira rodada no iPhone (2026-10-30, Release, os dois relógios).** O que ela cobriu; o que não está aqui continua
aberto. Detalhes em [`docs/ios-pendente.md`](../docs/ios-pendente.md#o-que-o-iphone-mostrou-2026-10-30).

| Item | Resultado |
|---|---|
| A3 | Feito: UUID na lista, BIND e LOGIN, `Conectado (2)`; MTU 23 e as propriedades do `6e400002` no log. |
| A4 | Feito: firmware `0.2.1`, bateria 35% (a comparação com a tela não foi anotada). |
| A5 | Em parte: `Set time` com a hora automática; a hora manual à frente não foi testada. |
| A6 | Em parte: `Refresh steps` e `Sync` com passos e sono, mas 0 passos no dia (o relógio não foi usado): o total contra a tela fica para uma rodada com passos. |
| A7 | Em parte: `Disconnect` (sem reconexão sozinha) e `Forget` com a sessão já desconectada (sem `UNBIND`). Não feitos: `Reconnect last`, o novo pareamento depois do `Forget`, o Bluetooth desligado com o relógio conectado (só foi desligado e religado sem relógio conectado) e o app fechado e aberto de novo. |
| A8 | Em parte: os pacotes com hex no log e o `Export` (52 pacotes). O cabeçalho saiu com o nome do Life Ultra GPS (corrigido depois, ADR 24 do Repo 1). |
| Exploratório (sono) | O `Sync` trouxe uma sessão de sono com o relógio parado durante a noite, sem uso. Não é uma noite real. |
| I1 | Feito: `Life Ultra GPS` na lista, com UUID. |
| I2 | Feito, depois de esquecer o relógio em Ajustes → Bluetooth (antes, todas as tentativas falharam com status 14, hoje `PAIRING_REMOVED`): `0af7` e `0af2`, BIND com o toque na tela, `READY`, `03/01` 1 s depois; propriedades do `0af6` no log, sem WARN `… declares`. |
| I3 | Não feito. |
| I4 | Feito: firmware `1.1.1`, bateria 12% (a comparação com a tela não foi anotada). |
| I5 | Em parte: `Set time` com a hora automática. |
| I6 | Feito: 57 passos, 7 kcal e 59 m; `Sync` em menos de um segundo; `Sono` com `NO_DATA`. Os valores da tela do relógio não foram anotados. |
| I7, I8 | Não feitos. |
| I9 | Feito: `Export` com 24 pacotes, cabeçalho `Life Ultra GPS` `1.1.1`. |
| Extras | Não feitos (recusa do Bluetooth, segundo plano). |

Registre os resultados no [`docs/ios-pendente.md`](../docs/ios-pendente.md#pendências) (caixas da seção Pendências) e,
para o protocolo, no `docs/pendencias.md` do Repo 1.

## Permissões

Pedidas ao abrir o app (aba Conexão, cartão "Permissões"):

| Android | Permissões | Por quê |
|---|---|---|
| 12+ (API 31+) | `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` | scan e conexão BLE; sem localização graças ao `neverForLocation` do manifest do módulo |
| 13+ (API 33+) | `POST_NOTIFICATIONS` (opcional) | notificação do serviço de sync; negada, o sync roda igual e a notificação não aparece na gaveta |
| 11 ou menor | `ACCESS_FINE_LOCATION` | o scan BLE exige localização até a API 30 |

Negou com "não perguntar de novo": o cartão mostra "Bloqueadas" e o botão "Abrir configurações". Para começar do
zero: `adb uninstall br.com.grupotechnos.corenext.example` e `npm run android` de novo.

No iOS o JS não pede nada (o cartão diz isso): o sistema mostra o pedido do Bluetooth no primeiro uso do Core, e o app
não espera por ele para inicializar.

## As três abas

**Conexão.** Permissões; situação do `initialize()`; estado (`state` numérico, `sessionState` e fase do handshake);
último erro; `Disconnect` (desconecta e mantém o pareamento); `Forget` (UNBIND quando o modelo suporta, nunca no Life
Ultra GPS, `F8` no Condor Reebok, que no Android também tira o relógio dos Ajustes de Bluetooth; apaga pareamento e
histórico); `Reconnect last` (`getLastPairedDevice` + `startPairingAttempt`);
`isConnected()`; `Scan`/`Stop` (7 s) com a lista
`{name, bleName, deviceId, rssi}`; toque num relógio = `pairDevice`, com spinner até resolver ou rejeitar. Cartões
Relógio (`getDeviceInfo` + `getFirmwareInfo`), Bateria, Hora (`setTime`) e Passos de hoje (`refreshSteps`).

**Dados.** `Sync` com a barra de `onSyncProgress`. `Passos` = `getHistoryPedometer(3)` esperando `onHistoryPedometer`
por até 20 s (o mesmo tempo do app Mormaii): passos, kcal e km por dia, o JSON cru selecionável e o botão para
confirmar o envio dos dias anteriores (`deletedSavedData`). `Sono` = `getHistorySleep` esperando `onHistorySleep` ou
`NO_DATA`.

**Log.** Entradas de `onLog`, a mais nova embaixo, até 2000 (o tamanho do anel nativo; ao abrir, o app carrega o
que o nativo já tinha com `getLogs`). Filtro por texto (tag, mensagem, hex), nível mínimo, "Hex dos frames",
"Só pacotes" (`TX`, `RX` e `READ`, as leituras GATT do Condor Reebok), `Clear` (JS e nativo), `Recarregar`, `Export`, `Share` e o nível do log nativo (`setLogLevel`).

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
   `technos-watch-protocol/fixtures/real/<perfil>/<fw>/<cenário>.jsonl` (ex.: `fitgps/0.2.1/pair-battery-version.jsonl`,
   `condorreebok/MOY-VS02-2.0.0/pair-battery-firmware-sync.jsonl`; formato e nomes em `docs/fixtures.md` do Repo 1). Um cenário por gravação: `Export` antes de cada `Clear` (o `Clear`
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

## Checklist com o Life Ultra GPS (iDO)

O driver iDO do Repo 1 foi escrito a partir do log de bytes da SDK de produção (`docs/protocolo-ido.md` de lá) e nunca
falou com o relógio por este app: este roteiro é a primeira validação. Antes de começar: pareamento desfeito no app
Mormaii de produção (ou o app parado), `Clear` na aba Log, "Hex dos frames" ligado, relógio perto.

| # | Passos | Esperado |
|---|---|---|
| I1 | Conexão → `Scan`. | A lista mostra `Life Ultra GPS`, `Life Ultra GPS · lifeultragps` (ou `Smart Watch 6010 · lifeultragps`), o MAC e o RSSI. Se não aparecer, anote o nome e os serviços da linha `BleScanner/onScanResult`. |
| I2 | Tocar no `Life Ultra GPS`. Confirmar na tela do relógio. | O estado passa por `CONNECTING`, `CONFIGURING`, `HANDSHAKING · BIND` e fica nele até o toque; depois `Conectado (2)` `READY` e "Pareado com Life Ultra GPS". No log: `Session/configure` com `extra notify [00000af2-…]`, dois `enableNotifications` (`0af7` e depois `0af2`) e "MTU not requested"; pacotes `TX`/`RX` `02/01`, `04/01`, `04/05` (o `RX 04/05` só depois do toque) e, 1 s depois do READY, `03/01`. Nenhum `AndroidGattTransport/write` com status de erro. |
| I3 | Repetir I2 recusando na tela (ou deixando a tela sem resposta por 90 s). | `HANDSHAKE_FAILED` e `Desconectado (0)`. Um pareamento novo pede a confirmação de novo. |
| I4 | Cartão Relógio → `Ler`. Cartão Bateria → `Ler`. | Firmware `1.1.1` e `onFirmwareInfo` com `braceletType 0 · platformCode 0`. A porcentagem é a mesma da tela do relógio. |
| I5 | Cartão Hora → `Set time` (com a hora do celular alguns minutos à frente, como no A5). | "Hora enviada" e o relógio mostra a mesma hora e o mesmo dia da semana. |
| I6 | `Refresh steps`; Dados → `Sync`; depois `Passos`. | Passos e distância de hoje iguais aos da tela do relógio (a distância do relógio pode estar em milhas). As calorias não batem: o app mostra as totais do `02/A0` (repouso + atividade; 13 no log de produção) e a tela, só as de atividade (0 no mesmo momento); anote os dois valores. O `Sync` termina em menos de um segundo; `Passos` lista hoje. `Sono` responde `NO_DATA`. |
| I7 | Bluetooth do celular desligado e religado; depois `Disconnect` e `Reconnect last`. | Volta a `Conectado (2)` com `HANDSHAKING · LOGIN`, só `02/01` e `03/01` no log, sem tela de confirmação no relógio. |
| I8 | `Forget` e repetir I2. | `Desconectado (0)` e "Último pareado: nenhum"; nenhum TX no `Forget` (os bytes do desvínculo iDO não são conhecidos; o log tem `UNBIND failed (...)`). O novo pareamento pede a confirmação de novo. |
| I9 | `Export` depois de cada cenário. | Copie o `frames-*.jsonl` mais recente para `technos-watch-protocol/fixtures/real/lifeultragps/1.1.1/<cenário>.jsonl`; ele roda no `IdoRealFixturesReplayTest` do Repo 1. O `logs-*.jsonl` tem o MAC e não entra no repositório. |

Registre os resultados nas caixas da seção "Life Ultra GPS (iDO)" do `docs/pendencias.md` do Repo 1.

O que a primeira gravação com o relógio (2026-10-29) já respondeu está em
[`../docs/transporte-android.md`](../docs/transporte-android.md#o-que-a-gravação-do-fitgps-mostrou); o que ainda
falta testar no aparelho, no `docs/pendencias.md` do Repo 1.

## Checklist com o Condor Reebok (CRP)

O driver CRP do Repo 1 foi escrito a partir da SDK CRP decompilada e da captura HCI do app Condor de produção pareando o
P85 (`docs/protocolo-crp.md` de lá); nunca falou com o relógio por este app: este roteiro é a primeira validação.
Antes de começar: o Condor de produção desconectado do relógio (ou parado), `Clear` na aba Log, "Hex dos frames"
ligado, relógio perto e carregado.

### No Android

| # | Passos | Esperado |
|---|---|---|
| C1 | Conexão → `Scan`. | A lista mostra `Condor Reebok`, `P85 · condorreebok` (o `bleName` é o nome anunciado, que começa com `P85`), o MAC e o RSSI. No log, `BleScanner/start … without filters (a profile accepts name prefixes)`. Se não aparecer, anote o nome da linha `BleScanner/onScanResult`. |
| C2 | Tocar no `Condor Reebok`. | O estado passa por `CONNECTING`, `CONFIGURING`, `HANDSHAKING · VERSION` e termina em `Conectado (2)` `READY`, sem confirmação no relógio. No log: `enableNotifications` de `fee3`, `2a37`, `fee1` e `2a19` (nesta ordem; um WARN numa das três últimas não é falha), `requestMtu requested=512 effective=<n>` (esperado 517: o relógio abre a troca de MTU; anote), `READ` de `2a29` (`MOYOUNG-V2`), `TX` `5A/00`, `B7/0E`, `BB/16` e, 250 ms depois do `READY`, `31` e `BB/07` (hora e fuso). Nenhum `AndroidGattTransport/write` com status de erro. |
| C3 | Logo depois do `READY`. | O diálogo de pedido de pareamento do Android, com o P85: aceitar. No log, `ClassicBonder/request`, `createBond attempt 1 … started=true` e `onBondStateChanged … 11 -> 12`; depois o relógio passa a tocar chamadas e música (o Android abre os perfis sozinho). Se a primeira tentativa falhar (no HCI do app Condor ela falhou antes do diálogo), o diálogo aparece de novo sozinho em 1,5 s. Anote se veio o WARN de reserva (`createBond(TRANSPORT_BREDR) by reflection failed`). |
| C4 | Repetir com `Forget` + `Scan` + pareamento, recusando o diálogo nas duas vezes. | "Último erro: `CLASSIC_BOND_FAILED` em `classicBond`", com a dica de parear de novo; o estado continua `Conectado (2)` e os comandos funcionam. Nenhum diálogo a mais até um pareamento novo. |
| C5 | Cartão Bateria → `Ler`. Repetir com o relógio no carregador. | A porcentagem da tela do relógio e `charging false`. No carregador, `charging true` e a porcentagem certa (regra "acima de 100 = carregando", ainda não confirmada: anote o hex do `READ` de `2a19`). Sem tocar em nada, um `onBatteryStatus` por minuto (o relógio avisa sozinho). |
| C6 | Cartão Relógio → `Ler`. | Firmware `MOY-VS02-2.0.0` e `bleVersion` `MOYOUNG-V2` no `onDeviceInfo`; `onFirmwareInfo` com `braceletType 0 · platformCode 0`. |
| C7 | Cartão Hora → `Set time` (com a hora do celular alguns minutos à frente, como no A5). Depois trocar o formato 12/24 h no celular. | "Hora enviada" e o relógio mostra a mesma hora. O formato 12/24 h do relógio não muda (fica para a fase 2). |
| C8 | Andar um pouco olhando o cartão Passos de hoje. | O total sobe sozinho, no máximo uma vez a cada 2 s (`onPedometer` sem pedido), com passos, kcal e metros iguais aos da tela do relógio. |
| C9 | Dados → `Sync`; depois `Passos` e `Sono`. | A barra chega a 100%. `Passos` lista hoje (e ontem, se o relógio tiver passos de ontem) com os totais da tela. No log: `READ` de `fee1`, `TX` `59/00` a `59/03`, `33/01` (pode ficar sem resposta: anote) e `32`. `Sono` responde `NO_DATA` sem uma noite; depois de dormir com o relógio, a noite com início, fim e estágios (anote os totais da tela). |
| C10 | Bluetooth do celular desligado e religado; depois sair do alcance e voltar. | Volta a `Conectado (2)` sozinho, com `HANDSHAKING · VERSION`, sem diálogo de pareamento (o vínculo clássico já existe: `Classic bond with … already exists` no log). |
| C11 | `Forget`. | `Desconectado (0)` e "Último pareado: nenhum"; no log, `TX` `F8` e `ClassicBonder/remove … returned true`; o relógio some de Ajustes → Bluetooth do Android. Um pareamento novo pede o diálogo de novo. |
| C12 | `Export` depois de cada cenário. | Copie o `frames-*.jsonl` mais recente para `technos-watch-protocol/fixtures/real/condorreebok/MOY-VS02-2.0.0/<cenário>.jsonl` (as leituras saem como `"dir":"READ"`); ele roda no `CrpRealFixturesReplayTest` do Repo 1. **Nunca** o `logs-*.jsonl` (tem o MAC). |

### Condor Reebok no iPhone

Os mesmos itens, com estas diferenças:

| Item | No iPhone |
|---|---|
| Antes | Se o Condor iOS já pareou este relógio neste iPhone, esqueça o P85 em Ajustes → Bluetooth antes (senão pode vir `PAIRING_REMOVED`). |
| C1, C2 | UUID na lista. No log, `CentralTransport/connect … options=…TransportBridging…=true` (o `connect` do P85 pede transport bridging, como a SDK iOS CRP) e as linhas `discoverServices service=… characteristics=[…]`: anote as propriedades do `fee2` (esperado só `writeWithoutResponse`), o `requestMtu requested=512 effective=<n>` e **se o iOS mostrou um pedido de pareamento** ao conectar. |
| C3, C4 | Nenhum diálogo e nenhum `onError`: o log traz o WARN `IosCoreHost/requestClassicBond … pair calls in Settings > Bluetooth`. Anote se o relógio aparece em Ajustes → Bluetooth depois do `READY` e se as chamadas funcionam depois de parear lá. |
| C11 | O `F8` sai igual; o relógio continua em Ajustes → Bluetooth (o log traz a dica `IosCoreHost/removeClassicBond … forget the watch in Settings > Bluetooth`): esqueça à mão. |
| C12 | `Export` e `Compartilhar arquivo` em vez do `adb pull` (cabeçalho com `platform` `ios`). |

Registre os resultados nas caixas da seção 7 do [`docs/pendencias.md`](../docs/pendencias.md#7-condor-reebok-crp), no
[`docs/ios-pendente.md`](../docs/ios-pendente.md#pendências) (iPhone) e, para o protocolo, na seção "Condor Reebok
(CRP)" do `docs/pendencias.md` do Repo 1.

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
src/hooks/usePermissions.ts  # PermissionsAndroid por nível de API (no iOS não pede nada)
src/hooks/useCommand.ts      # spinner, erro e hora do último sucesso de um comando
src/screens/                 # ConnectionScreen, DataScreen, LogScreen
src/components/              # botões, cartões, badge de estado, barra de abas
src/helpers/                 # formatação, anel de log e jsonl, comandos adb
ios/                         # app iOS: AppDelegate (CoreNext.bootstrap), Info.plist, Podfile
__tests__/                   # Jest
```

## Problemas comuns

- **Nada aparece no scan.** Veja "Último erro" no cartão Estado: `PERMISSION_DENIED` (permissões) ou `BLUETOOTH_OFF`.
  Sem erro: o relógio pode estar conectado a outro celular ou longe.
- **`HANDSHAKE_FAILED` no pareamento.** O relógio não respondeu o BIND/LOGIN, ou a confirmação na tela não foi feita
  em 60 s (90 s no Life Ultra GPS). Tente de novo; se repetir, `Forget` e reinicie o relógio. No Life Ultra GPS, uma
  reconexão com `HANDSHAKE_FAILED` quer dizer que o relógio se diz desvinculado (`pairFlag` 0): pareie de novo.
- **`NOT_READY` nos botões.** O estado não é `Conectado (2)`.
- **Condor Reebok: `CLASSIC_BOND_FAILED` no "Último erro".** O diálogo de pareamento do Android foi recusado duas vezes
  (ou não foi respondido em 45 s cada). O relógio continua conectado pelo BLE, mas sem chamadas e música; o app só pede
  de novo num pareamento novo (`Forget` e toque no relógio). Um `Forget` com o diálogo aberto cancela o pedido sem esse
  erro.
- **`Passos` volta vazio.** Rode o `Sync` antes: `getHistoryPedometer` lê só o histórico local.
- **iPhone: `pod install` para com "Falta ios/Frameworks/TechnosWatchProtocol.xcframework".** Rode
  `../ios/scripts/sync-xcframework.sh --build` na raiz do repositório e repita.
- **iPhone: "Failed to register bundle identifier" ou "No profiles for ...".** Troque o Bundle Identifier por um seu
  (passo 4 de [Rodar no iPhone](#rodar-no-iphone)).
- **iPhone: tela vermelha "No bundle URL present" (Debug).** O Metro não está rodando ou o iPhone não alcança o Mac
  (mesma rede Wi-Fi). Ou rode em Release, que embute o JS.
- **iPhone: `PAIRING_REMOVED` no pareamento ou na reconexão** (no log, `didFailToConnect status=14 error=Peer removed
  pairing information`; o build do primeiro teste mostrava `DISCONNECTED` com `status=14`). O iPhone guarda um vínculo
  Bluetooth com o relógio, de um pareamento antigo (por exemplo pelo app Mormaii de produção neste iPhone), que o relógio
  apagou ao ser pareado com outro celular depois. O iOS recusa toda conexão até você esquecer o relógio: Ajustes →
  Bluetooth → (i) ao lado do relógio → Esquecer Este Dispositivo. Desligar o Bluetooth do outro celular não resolve.
  Depois, `Scan` e toque no relógio (ou, se ele já estava salvo neste app, volte ao app, que reconecta sozinho). O app
  não consegue esquecer o vínculo por você, e o nativo não tenta de novo sozinho; a tela mostra a dica junto com o erro.
  Visto com o Life Ultra GPS em 2026-10-30.
- **iPhone: `BLUETOOTH_OFF (4)` com o Bluetooth ligado.** O app ficou sem autorização: Ajustes → CoreNextExample →
  Bluetooth. O `Scan` mostra `PERMISSION_DENIED` com `Missing Bluetooth`.
- **Build falha com `Could not find br.com.grupotechnos.watch:bridge:0.1.0` (ou `protocol:0.1.0`).** Falta o
  `publishToMavenLocal` do Repo 1, que publica os dois. Um `~/.m2` de antes do `:bridge` tem só o `protocol`, e o erro
  cita o `bridge`.
