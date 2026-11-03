# App de exemplo

App React Native 0.81.4 (a mesma versão do app Mormaii) para validar o `react-native-technos-core-next` com o relógio
de verdade. É o equivalente ao `examples/basic` do Core atual, reduzido ao escopo da PoC: Mormaii fitGPS, Mormaii Life
Ultra GPS (iDO, funções básicas) e Condor Reebok (CRP, fases 1 e 2), Android e iPhone
([Rodar no iPhone](#rodar-no-iphone)); o mesmo JS nos dois.

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

O manifesto do exemplo também declara `VIBRATE` (permissão normal, sem pedido na tela), só para o `onFindPhone` com
`status: "1"` vibrar o telefone (aba Ajustes, `src/hooks/useFindPhoneVibration.ts`); a biblioteca não a declara.

## As quatro abas

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

**Ajustes.** Um cartão por método da fase 2 (só o Condor Reebok executa; o fitGPS e o Life Ultra GPS respondem
`NOT_SUPPORTED`), com um botão por variante e valores fictícios de um catálogo único
(`src/helpers/syntheticSettings.ts`) nos formatos que o app Condor manda: chaves `enable` no alarme, `onOff` no
sedentarismo e `enabled` no resto, `repeat` como string no alarme e objeto nos outros, mês 1-12 no perfil e 0-11 no
ciclo. Agrupados nos três cenários de validação (`fase2-ajustes`, `fase2-mensagens`, `fase2-interacoes`). Cada cartão
mostra o último sucesso ou o erro (`CODE: mensagem`). No topo, o cartão "Eventos do relógio" lista `onFindPhone`,
`onTakeAPicture`, `onDeviceRequestedCameraMode` e `onOpenCameraMode`; só neste app, o `onFindPhone` com `status: "1"`
vibra o telefone. No fim, `Reset de fábrica` (`resetDevice`), que pede confirmação antes de enviar e não esquece o
pareamento. Não há botão para o `F2 05` (suporte ao `+` nos contatos): não existe método nativo para ele.

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
   - As gravações da fase 2 (aba Ajustes) ainda **não** vão para `fixtures/real`: veja a Preparação do
     [checklist da fase 2](#checklist-da-fase-2-com-o-condor-reebok).

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
| C7 | Cartão Hora → `Set time` (com a hora do celular alguns minutos à frente, como no A5). Depois trocar o formato 12/24 h no celular. | "Hora enviada" e o relógio mostra a mesma hora. O formato 12/24 h do relógio não muda com o do celular: ele é o `set12HourFormat` da aba Ajustes (fase 2, F1). |
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
| C5, C8 | Esperado igual ao Android. Visto só a parte sem toque: na segunda sessão de 2026-11-01 (23:20, app aberto), o export tem um `2a19` em cada virada de minuto e 14 `fee1` andando, e o usuário relatou "está atualizando automaticamente"; os `onBatteryStatus` e `onPedometer` em si não foram registrados (sem log) (`docs/ios-pendente.md`, [A segunda sessão](../docs/ios-pendente.md#a-segunda-sessão-no-iphone-2026-11-01-2320-não-versionada)). A leitura da bateria (`Ler`) saiu na gravação das 17:04; o carregador não foi testado no iPhone. Falta ver com o app em segundo plano e com a tela bloqueada. |
| C11 | O `F8` sai igual; o relógio continua em Ajustes → Bluetooth (o log traz a dica `IosCoreHost/removeClassicBond … forget the watch in Settings > Bluetooth`): esqueça à mão. |
| C12 | `Export` e `Compartilhar arquivo` em vez do `adb pull` (cabeçalho com `platform` `ios`). |

Registre os resultados nas caixas da seção 7 do [`docs/pendencias.md`](../docs/pendencias.md#7-condor-reebok-crp), no
[`docs/ios-pendente.md`](../docs/ios-pendente.md#pendências) (iPhone) e, para o protocolo, na seção "Condor Reebok
(CRP)" do `docs/pendencias.md` do Repo 1.

## Checklist da fase 2 com o Condor Reebok

Os ajustes, as mensagens e as interações da fase 2 (aba Ajustes) nunca falaram com o relógio por este app: este roteiro
é a primeira validação, no Android e no iPhone (2026-11-03). Os bytes de alarmes, ciclo, gesto, agenda, relógio mundial,
filtro de notificações e interações só são conhecidos pela SDK, e o resultado pode mudar codecs no Repo 1. Todos os
valores da aba são fictícios (os telefones dos contatos usam o DDD 00, que não existe).

### Preparação

1. **Os dois aparelhos** com o app de exemplo atual (com o snapshot final do `:bridge`; na aba Ajustes, o tempo de tela
   tem `20 s` e `25 s`, o gesto tem `Fora da hora atual` e o não perturbe tem `Agora até +1 h`). Na aba Log, o nível
   `DEBUG` e "Hex dos frames" ligado.
2. **O P85** carregado, pareado neste app e conectado (`Conectado (2)`), com o vínculo clássico ativo: no Android, o
   diálogo do C3; no iPhone, o relógio pareado em Ajustes → Bluetooth (M2, M5 e I4 dependem dele). Um telefone por vez:
   antes de passar ao iPhone, `Disconnect` no Android e o Bluetooth dele desligado.
3. **Para o M2 no iPhone**, alguém que mande uma mensagem de WhatsApp e um SMS para o iPhone na hora do teste. Para o
   I4, um player de música tocando no telefone. Para o G1, o fitGPS ou o Life Ultra GPS.
4. **Uma folha de anotações** com uma linha por item (F1 a G4) e uma coluna por aparelho: o resultado, o que o relógio
   mostrou e o `atMs` do frame no export (`fase2-ajustes-android@<atMs>`), como pede o `docs/pendencias.md` do Repo 1.

**Um export por cenário.** Para cada cenário (`fase2-ajustes`, `fase2-mensagens`, `fase2-interacoes`), em cada
aparelho: `Clear` na aba Log, os itens do cenário na ordem, `Export`. Sempre `Export` antes de qualquer `Clear` (o
`Clear` apaga o anel e a gravação). Para repetir um item, não dê `Clear`: repita e exporte de novo. Os exports são
cumulativos (cada um traz tudo desde o último `Clear`), então guarde **só o `frames-*.jsonl` mais recente** de cada
cenário, renomeado para `fase2-<cenário>-android.jsonl` ou `fase2-<cenário>-iphone.jsonl`. **Nunca** guarde um
`logs-*.jsonl` num repositório (tem o MAC do relógio); ele só serve para olhar no computador.

**Onde guardar.** Numa pasta da validação no computador, fora dos dois repositórios. **Não** copie para
`technos-watch-protocol/fixtures/real/` ainda: o replay estrito do Repo 1 recusa os pedidos da fase 2, e o `check` de lá
quebraria. As gravações entram junto com a exclusão por nome e o `CrpPhase2FixtureTest` (D17; ADR 39 e
`docs/fixtures.md`, seção 4, do Repo 1; fatia S9).

**Conferência de privacidade** de cada `frames-*.jsonl` guardado, antes de entregá-lo:

- nenhum MAC nem nome de aparelho: `grep -Eic '([0-9a-f]{2}:){5}[0-9a-f]{2}' fase2-*.jsonl` dá 0 em todos;
- os TX `12` (perfil), `75` (ciclo), `43` e `42` (clima) com o payload zerado depois do comando, o `B5` só com o sub
  (`00`) e o `F2 02` (contato) só com `02` e o id.

**Ordem da sessão.**

1. Android: `fase2-ajustes` (F1 a F14), `fase2-mensagens` (M1 a M7) e `fase2-interacoes` (I1 a I4), um export cada;
   depois os gerais (G1 a G4, sem export).
2. Android: `Disconnect` (aba Conexão) e o Bluetooth do Android desligado.
3. iPhone: os mesmos cenários, com as diferenças de [No iPhone (fase 2)](#no-iphone-fase-2).
4. Por último, uma vez só, no último aparelho (nesta ordem, o iPhone): o [Reset de fábrica (I5)](#reset-de-fábrica-i5),
   dentro do cenário `fase2-interacoes` desse aparelho, antes do `Export` dele.

### Cenário `fase2-ajustes`

| # | Botão (aba Ajustes) | Esperado e o que anotar |
|---|---|---|
| F1 | Formato de hora → `12 h`, depois `24 h` | O mostrador passa para AM/PM e volta. No log, o TX `17 00` com `12 h` e `17 01` com `24 h`. Anote se o `17 00` deu mesmo 12 h. |
| F2 | Unidade de temperatura → `°F`, depois `°C` | As duas Promises resolvem; no log, o RX `8C 01` depois do `°F`, o `8C 00` depois do `°C`, e nenhum `TIMEOUT`. A tela de clima fica para o M7 (o clima fictício só sai no M6); um reenvio de clima aqui (`8C`, `43`, `B5`, `42`) é o de um teste anterior nesta execução do app. |
| F3 | Unidade de distância → `mi`, depois `km` | A distância do relógio aparece em milhas e volta. No log, `1A 01` e `1A 00`. |
| F4 | Tempo de tela → `5 s`, `10 s`, `20 s`, `25 s`, `30 s`, um de cada vez | Depois de cada botão, acenda a tela do relógio (toque ou pulso) e cronometre até ela apagar. Anote o tempo medido de cada um e se algum valor foi ignorado (o tempo não mudou): fecha a faixa do `7D`. |
| F5 | Economia de bateria → `Ligar`, depois `Desligar` | O modo de economia aparece no relógio e o log mostra o eco `A4 01 xx`: anote o segundo byte (o INFO `CrpDriver/batterySaving` o mostra). Ao desligar, `A4 00 01`. Nenhuma Promise rejeitada. |
| F6 | SOS → `Desligar`, depois `Ligar` | O menu de SOS do relógio reflete o estado. Se o relógio mandar um `A1` ao usar o SOS (RX `A1` no log), anote. |
| F7 | Gesto → `07:30-23:00`; `Fora da hora atual`; `Desligado` | Com `07:30-23:00` (de dia, dentro da janela), levantar o pulso acende a tela. Com `Fora da hora atual` (de daqui a 2 h a daqui a 3 h), não acende. Desligado, não acende. Anote os três (o `18` e o `72` nunca foram vistos no ar). |
| F8 | Ciclo menstrual → `Ciclo fictício`, depois `Silenciar` | O app de saúde feminina do relógio mostra ciclo de 28 dias, 5 de menstruação, início em 9 de março e lembrete às 10:00. Confira dia e mês: o mês vai de 0 a 11 no fio, e um erro aparece como fevereiro ou abril. `Silenciar` desliga os lembretes. |
| F9 | Frequência cardíaca automática → `5 min`, depois `Desligado` | No log, `1F 01` e `1F 00`. Anote se o menu do relógio mostra o ajuste e se as medições espontâneas param. |
| F10 | Estresse automático → `Ligar`, depois `Desligar` | O log mostra a resposta `B9 11 01` com o mesmo estado; o menu do relógio, se houver, reflete. |
| F11 | Não perturbe → `Agora até +1 h`; `22:00-07:30`; `Desligado` | Com `Agora até +1 h`, o ícone de não perturbe aparece no relógio na hora. Com `22:00-07:30` (de dia, fora da janela), some. Desligado, some. |
| F12 | Lembrete de água → `Agora + 2 min`, esperar, `Desligado`; repetir com `Agora + 2 min, count 0` | Em 2 min o relógio vibra com o lembrete de água; desligado, não vibra mais. Anote o que acontece com a quantidade 0 (o sync do app Condor sem ajuste salvo manda 0): vibra, não vibra ou some o lembrete. |
| F13 | Sedentarismo → `Ligar`, depois `Desligar` | O log mostra o RX `2D` com o mesmo estado, e a Promise resolve. O lembrete só aparece depois do período padrão do firmware (não precisa esperar). |
| F14 | Perfil → `165 cm, 60 kg, 1996-05-10`; Metas → `8000 passos, 350 kcal, 45 min` | As duas Promises resolvem e a tela de metas do relógio mostra 8000 passos. O perfil não tem tela de confirmação; no export, o `12` aparece com o payload zerado. |

### Cenário `fase2-mensagens`

| # | Botão (aba Ajustes) | Esperado e o que anotar |
|---|---|---|
| M1 | Notificações → `Tudo` (o primeiro botão do cenário) | Anote se o P85 respondeu ao `B9 14 00` (RX `B9 14` no log), com quais códigos e o byte [1] da resposta; o `B9 04` sai depois. Sem resposta: um WARN no log, nenhum `B9 04`, e a Promise resolve. |
| M2 | Notificações → `Sem WhatsApp`; no fim, `Tudo` de novo | Android: só o log (o `B9 04` com a flag do WhatsApp desligada); o encaminhamento não é da fase 2 (DP-44). iPhone: peça um WhatsApp e um SMS; o WhatsApp não aparece no relógio e o SMS aparece. **Se o M1 ficou sem resposta**, o `B9 04` não sai nesta conexão (a falta da lista vale a conexão inteira, DP-87): anote, faça `Disconnect` e `Reconnect last` (aba Conexão), repita o M1 e só então o M2; sem resposta outra vez, registre o M2 como não testável. |
| M3 | Alarmes → `3 alarmes`, esperar 2 min, `Limpar` | A lista de alarmes do relógio mostra segunda a sexta 06:45, todo dia 07:00 e um único daqui a 2 min, que toca na hora. `Limpar` esvazia a lista. Anote como o relógio mostra os dias. |
| M4 | Relógio mundial → `2 cidades`, `1 cidade`, `Nenhuma` | O app de relógio mundial mostra Tóquio e Buenos Aires, depois só Tóquio, depois nenhuma (decide se o `BB 00 03` apaga). Confira a hora de cada cidade (Tóquio UTC+9, Buenos Aires UTC−3). Com a lista vazia e sem cidades antigas, só uma consulta (`BB 00 00`) sai. |
| M5 | Contatos → `2 contatos`; ligar de um deles pelo relógio; `Limpar` | A agenda do relógio mostra "Ana Teste" e "José Exemplo" com o número inteiro (o da Ana tem `+`: anote se ele aparece). Ligar de um deles pelo relógio disca pelo telefone (HFP; o número não existe, desligue logo). `Limpar` esvazia. Anote se o `F2 00` respondeu e com que tamanho de nome; se o `F2 EF` gerou um `F2 FE`, com que id e quantos ms depois do `F2 EF` (pelos `atMs` do export; depois de 1 s ele seria tomado pelo ack do contato 0, DP-53); e se veio um `F2 FE` por contato. Não há botão para o `F2 05` (sem método nativo; [`docs/pendencias.md`](../docs/pendencias.md#8-fase-2-do-condor-reebok-o-que-fica-fora-e-o-que-falta-validar)). |
| M6 | Clima → `25 °C, sol, Teste`; depois `Lista vazia` | A tela de clima mostra 25 °C, sol e a previsão de 7 dias (um dia com −3 °C). Anote se o nome da cidade ("Teste") e o nascer e o pôr do sol (06:00 e 18:00) aparecem: isso diz se a tela usa o `43` ou o `B5`. `Lista vazia` resolve sem nenhum TX, e a tela continua com o clima anterior. |
| M7 | Unidade de temperatura (cartão do grupo Ajustes) → `°F`, depois `°C` | Com o clima do M6 já enviado, a tela de clima passa para °F (25 °C = 77 °F) e volta. No log, depois de cada `8C` de confirmação, o INFO `CoreBridge/syncWeather` "Resending the last weather…" e o reenvio `8C`, `43`, `B5`, `42`, sem `TIMEOUT`. |

### Cenário `fase2-interacoes`

| # | Ação (aba Ajustes) | Esperado e o que anotar |
|---|---|---|
| I1 | Vibrar | O relógio vibra. Anote a duração e se veio algum RX `61`. |
| I2 | `Abrir câmera`; disparar no relógio; sair pela tela do relógio; abrir a câmera pelo menu do relógio e disparar; `Abrir câmera` e `Fechar câmera` | A tela de câmera aparece no relógio e o cartão "Eventos do relógio" mostra `onOpenCameraMode`. Anote se o relógio ecoou o `66` ao abrir, e com que payload (o DEBUG `CrpDriver/camera` mostra o eco descartado, sem foto). O disparo dá `onTakeAPicture`. A saída pelo relógio gera o RX `53 0E FF` (anote o byte [1] se for outro); o disparo pelo menu do relógio, depois disso, dá `onDeviceRequestedCameraMode`. `Fechar câmera` tira a tela do relógio. |
| I3 | Encontrar celular pelo menu do relógio; depois parar no relógio | O cartão mostra `onFindPhone` com `{"status":"1"}`, o aviso "Procurando o telefone", e o telefone vibra (só neste app); ao parar, `{"status":"0"}`. Anote o tamanho do RX `62`, o byte de parar e se o relógio para sozinho depois de um tempo (cronometre). |
| I4 | Música: com um player tocando no telefone e o vínculo clássico ativo, os botões de música do P85 (play/pause, próxima, anterior, volume) | Anote se o player responde a cada botão e se aparece algum RX `67`: filtre o log por `PHONE_OPERATION` (a linha DEBUG `CrpDriver/receive` "unsolicited 67 PHONE_OPERATION … ignored"). Player respondendo sem nenhum `67`: vale o AVRCP do vínculo clássico (D19). Com `67`, anote o payload de cada botão (o controle por BLE vira fatia própria, DP-64). |
| I5 | `Reset de fábrica` → confirmar | **Uma vez só, no último aparelho, depois de todo o resto nos dois.** Passo a passo em [Reset de fábrica (I5)](#reset-de-fábrica-i5). |

### Reset de fábrica (I5)

Por último, porque apaga o relógio: depois dele os itens anteriores não valem mais, e o vínculo do sistema no outro
aparelho fica velho. Ainda dentro do cenário `fase2-interacoes` do último aparelho, sem `Clear`:

1. `Reset de fábrica` → confirmar no diálogo.
2. Anote o resultado no cartão Reset: ok, ou o código do erro. `DISCONNECTED` é esperado se o relógio derrubar o link
   nos 200 ms depois do `51 02` (DP-91): o reset foi escrito mesmo assim.
3. Olhe o relógio: reinicia? volta à tela de fábrica (idioma, hora)? apaga passos, alarmes, contatos e ajustes?
4. Olhe a aba Conexão por 1 min sem tocar em nada: vai a `Desconectado (0)`? Volta sozinho a `Conectado (2)` (com
   `HANDSHAKING · VERSION`)? Fica tentando? Para com `PAIRING_REMOVED` no "Último erro" (iPhone)?
5. Vínculo do sistema: no Android, Ajustes → Bluetooth (o P85 continua pareado?); no iPhone, Ajustes → Bluetooth (o P85
   continua? "Conectado"?). Se der, faça uma ligação para o telefone e anote se ela ainda toca no relógio.
6. Se não reconectou sozinho: no iPhone com `PAIRING_REMOVED`, esqueça o relógio em Ajustes → Bluetooth; nos dois,
   `Forget` (aba Conexão), `Scan` e toque no relógio. Anote se o pareamento novo funcionou de primeira e se o relógio
   pediu confirmação.
7. `Export`. No export, anote os ms entre o TX `51 02` e a queda do link (o `atMs` do `51 02` e o do último pacote antes
   da linha `onConnectStateChanged` da queda no log) e se a queda veio dentro dos 200 ms. O pareamento salvo no app
   continua ("Último pareado") até o `Forget` do passo 6.

**Depois do reset**, no outro aparelho (o Android, nesta ordem): o vínculo do sistema com o P85 ficou velho. Antes de
usar o relógio de novo nele, esqueça o P85 em Ajustes → Bluetooth, `Forget` na aba Conexão e pareie de novo (o diálogo
do vínculo clássico do C3 volta).

### Gerais (sem export)

| # | O que fazer | Esperado e o que anotar |
|---|---|---|
| G1 | Família sem suporte: com o fitGPS ou o Life Ultra GPS conectado, qualquer botão da aba | `NOT_SUPPORTED` no cartão e nenhum TX novo no log, menos Clima → `Lista vazia`, que resolve sem TX com qualquer relógio. |
| G2 | Desconectado: com o relógio desligado ou longe (`Desconectado (0)`), um ajuste e `Fechar câmera` | O ajuste mostra `NOT_READY`, sem aviso de "unhandled promise rejection" no Metro (build Debug); `Fechar câmera` resolve sem erro. |
| G3 | Fila: aba Dados → `Sync` e, logo, aba Ajustes → `Vibrar`. Noutro `Sync`, `Abrir câmera` e logo `Fechar câmera` | A vibração só acontece depois do fim do sync. Na câmera: depois do sync, nenhum `onOpenCameraMode` no cartão, e um disparo pelo menu de câmera do relógio dá `onDeviceRequestedCameraMode`, não `onTakeAPicture`. |
| G4 | Tempo total: `Sync` seguido de todos os botões do grupo Ajustes, um atrás do outro | Anote o tempo total (estimativa do sync completo de ajustes do app Condor: 5 a 8 s; do parcial, que só manda frequência cardíaca, metas, estresse, SOS, ciclo e perfil: 1,5 a 2,5 s) e confira que não houve `TIMEOUT` inesperado. |

### No iPhone (fase 2)

Os mesmos cenários e itens, com estas diferenças:

| Item | No iPhone |
|---|---|
| Antes | `Disconnect` no Android e o Bluetooth dele desligado. O P85 pareado em Ajustes → Bluetooth do iPhone (se o Condor iOS já pareou este relógio neste iPhone, esqueça-o lá antes, senão pode vir `PAIRING_REMOVED`) e neste app (`Scan` e toque no relógio). |
| Export | `Export` e `Compartilhar arquivo` em vez do `adb pull`; o cabeçalho traz `platform` `ios`. Mesmos nomes, com `-iphone`. |
| M2 | O teste de verdade do filtro: com o relógio vinculado em Ajustes → Bluetooth (ANCS), o WhatsApp some do relógio e o SMS continua. |
| M5 | A ligação pelo relógio usa o HFP do vínculo feito em Ajustes → Bluetooth. |
| I3 | Primeiro com o app em primeiro plano. Se der, repita com o app em segundo plano e com a tela bloqueada, e anote se o telefone vibrou: em segundo plano, o evento depende do iOS acordar o app pelo Bluetooth (DP-57). |
| I4 | Opcional (prioridade baixa, decisão de 2026-11-02; o resultado do Android está no DP-64): o mesmo teste, com o player do iPhone. |
| I5 | Neste aparelho, por último (a ordem da sessão). |

Registre os resultados na seção 8 do
[`docs/pendencias.md`](../docs/pendencias.md#8-fase-2-do-condor-reebok-o-que-fica-fora-e-o-que-falta-validar), no
[`docs/ios-pendente.md`](../docs/ios-pendente.md#pendências) (iPhone) e, para o protocolo, na subseção "Fase 2:
validação por símbolo" do `docs/pendencias.md` do Repo 1 (uma caixa por símbolo, com os itens daqui); o que mudar uma
entrada de [`docs/desvios-de-producao.md`](../docs/desvios-de-producao.md), lá.

## Verificações sem relógio

```sh
cd example
npx tsc --noEmit          # app + ../src
npm test                  # Jest: wrapper, métodos da fase 2, utils, useCoreEvents, helpers, renderização do App
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
src/hooks/useFindPhoneVibration.ts # vibra o telefone no onFindPhone "1" (só no exemplo)
src/screens/                 # ConnectionScreen, DataScreen, SettingsScreen (Ajustes), LogScreen
src/components/              # botões, cartões, badge de estado, barra de abas
src/helpers/                 # formatação, anel de log e jsonl, comandos adb, catálogo fictício da aba Ajustes
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
