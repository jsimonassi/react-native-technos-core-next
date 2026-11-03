# Desvios de produção

Tudo o que o Core Next (`CoreBridge` e `:protocol` do Repo 1, mais os hosts deste repositório) faz de um jeito diferente
da produção fica anotado aqui, para revisão futura. O pedido é do usuário (2026-11-01, noite): "Tudo que desviar do
comportamento original entra como pendência pra revisão futura." Isso vale para os desvios já decididos nas fases 1 e
2 (esquecer sem reset de fábrica, bugs de produção não copiados, stubs de compatibilidade, fila serial, sem FGS
persistente, sem CDM) e para os que as fases 3 e 4 ainda vão criar ou desfazer.

**Produção** é:

- o Core React Native atual, `TechnosWareCore` na tag `v4.3.57`, a versão que o app Condor fixa (só leitura:
  `git -C ../TechnosWareCore show v4.3.57:<caminho>`);
- o app Condor de produção, `GTE-CondorSmart` (branch `release/2.5.0`, só leitura);
- as SDKs do fornecedor só onde o Core delega a elas: a `crpblelib` 2.0.3 descompilada (Android) e o binário
  `CRPSmartBand` do pod `CrpTechnosIosSdk` (iOS).

O foco é o Condor Reebok (família CRP, nome BLE `P85`, firmware `MOY-VS02-2.0.0`); onde um desvio também muda o
fitGPS (SMA) ou o Life Ultra GPS (iDO) do app Mormaii, a entrada diz. Não ficam aqui: o que falta validar com o
relógio sem diferença de produção (`docs/pendencias.md` do Repo 1), as pendências do host e da integração
([`pendencias.md`](pendencias.md)) e o estado do iOS ([`ios-pendente.md`](ios-pendente.md)).

## Referências

- **D1 a D19**: as decisões da especificação aprovada da fase 2 (2026-11-01). Viram as ADRs da fase 2 no
  `docs/decisoes.md` do Repo 1; os bugs de produção não copiados (D8) e as diferenças entre plataformas também ficam
  na seção 11 do `docs/protocolo-crp.md` de lá. **Linha de corte (a) a (i)**: os itens que a especificação deixou fora
  da fase 2. **ADR n**: `docs/decisoes.md` do Repo 1.
- **Decisões do usuário de 2026-11-01 (noite)**, respostas às cinco perguntas da especificação: (1) o encaminhamento
  de notificações no Android entra até 2026-11-05 como fatia própria, depois da fase 2; (2) encontrar celular na
  opção A, só o evento JS; (3) a câmera disparada pelo relógio com o app em segundo plano no Android fica fora até
  2026-11-05; (4) ligações só pelo HFP, com a pendência do relógio Force (CRP só com BLE, DP-75); (5) o clima ganha o
  porte do `getCurrentGeolocation` na fase 4. Antes delas (ADR 33): esquecer e reset de fábrica são métodos separados,
  e o reset entra na fase 2 como `resetDevice`.
- **Citações de produção**. Sem prefixo, `Arquivo:linha` é do `TechnosWareCore` na tag `v4.3.57`, pelos nomes curtos
  da tabela abaixo. `condor:` é `GTE-CondorSmart/src/`. `sdk:` é a `crpblelib` 2.0.3 descompilada (`com/crrepa/`).
  `iOS-bin@` é um endereço do binário `CRPSmartBand` e `iOS-h:` uma linha do `CRPSmartBand-Swift.h`. `real@`,
  `pair-sync@` e `walk@` são fixtures do Repo 1 pelo `atMs` (`docs/protocolo-crp.md` de lá, seção 1).

| Nome curto | Caminho no `TechnosWareCore` |
|---|---|
| `CRPService.java` | `android/src/main/java/com/crp/bluetooth/CRPService.java` |
| `CRPBleConnectHelper.java` | `android/src/main/java/com/crp/bluetooth/connectionmanager/` |
| `CRPUserSettingsManager.java` | `android/src/main/java/com/crp/bluetooth/usersettings/` |
| `CRPQueueManager.kt` | `android/src/main/java/com/crp/bluetooth/promiseManager/` |
| `CRPPhoneManager.kt`, `CRPCameraManager.kt` | `android/src/main/java/com/crp/bluetooth/{phonemanager,camera}/` |
| `CRPFindPhoneManager.kt`, `CRPMusicManager.kt` | `android/src/main/java/com/crp/bluetooth/{findphone,music}/` |
| `CRPStepsAndRelatedListenerManager.java` | `android/src/main/java/com/crp/bluetooth/steps/` |
| `TechnosSbNotification.kt` | `android/src/main/java/com/reactlibrary/notificationmanager/` |
| `TechnosNotificationMappers.kt` | `android/src/main/java/com/reactlibrary/mappers/` |
| `CrpTechnosToSdkMappers.java` | `android/src/main/java/com/crp/bluetooth/mappers/` |
| `NotificationListener.java` | `android/src/main/java/com/reactlibrary/notificationmanager/` |
| `TechnosAvailableNotificationApps.kt` | `android/src/main/java/com/reactlibrary/notificationmanager/availableApps/` |
| `UserNotificationConfigRepository.kt` | `android/src/main/java/com/reactlibrary/notificationmanager/userConfig/` |
| `MusicControlService.java` | `android/src/main/java/com/reactlibrary/music/controlservice/` |
| `TechnosFindPhoneManager.kt` | `android/src/main/java/com/reactlibrary/findPhone/` |
| `CallManager.java`, `CameraControl.java` | `android/src/main/java/com/reactlibrary/{callmanager,cameraControl}/` |
| `DateHelpers.kt`, `SDKUtils.java` | `android/src/main/java/com/reactlibrary/{helpers,utils}/` |
| `DeviceFeatures.kt`, `AvailableDevices.java` | `android/src/main/java/com/reactlibrary/devices/` |
| `WeatherAPIV3.java` | `android/src/main/java/com/reactlibrary/weather/` |
| `TechnosForegroundService.java` | `android/src/main/java/com/reactlibrary/mainServiceManager/` |
| `TechnosForegroundServiceManager.kt` | `android/src/main/java/com/reactlibrary/mainServiceManager/` |
| `NativeCoreModule.kt` | `android/src/main/java/br/com/grupotechnos/libs/core/` |
| `SMAService.java`, `IDOService.java`, `UTEService.java` | `android/src/main/java/com/{sma,ido,ute}/bluetooth/` |
| `AndroidManifest.xml` | `android/src/main/AndroidManifest.xml` |
| `CRPService.m` | `ios/crpBluetooth/CRPService.m` |
| `CRPUserSettings.m` | `ios/crpBluetooth/UserSettings/` |
| `CRPCameraManager.m`, `CRPPhoneManager.m` | `ios/crpBluetooth/{Camera,PhoneManager}/` |
| `CondorReebokNotificationTypes.m` | `ios/reactlibrary/NotificationManager/devices/` |
| `TechnosFindPhoneManager.m` | `ios/reactlibrary/FindPhone/` |
| `SMAService.m`, `IDOService.m` | `ios/{sma,ido}Bluetooth/` |
| `NativeCore.ts` | `src/NativeModules/specs/NativeCore.ts` |

## Como registrar um desvio

1. Use o próximo número livre, o maior `DP-nn` do documento + 1 (uma entrada resolvida sai do índice, mas o número dela
   continua usado), na seção da área. Números nunca são reaproveitados nem renumerados; uma entrada nova pode ficar fora
   da ordem numérica dentro da seção.
2. Preencha os sete campos: **Produção** (o que o Core ou o app Condor fazem, com `arquivo:linha` conferido na tag
   `v4.3.57`, no `GTE-CondorSmart` ou na SDK; o que não deu para conferir leva "a verificar"), **Core Next** (o que
   fazemos, com a ADR, a decisão D ou o arquivo), **Motivo**, **Impacto para o usuário**, **Como corrigir ou voltar**,
   **Revisar em** (fase ou evento) e **Status**.
3. Ponha a linha no índice e cite o desvio onde ele nasce (KDoc, ADR, `docs/api-js.md` ou a seção 11 do
   `docs/protocolo-crp.md` do Repo 1).
4. Quando o desvio deixar de existir (corrigido, ou voltou a ser como na produção), não apague a entrada: tire a linha
   do índice e acrescente ao fim dela "**Resolvido em** <data>: <como>".

## Status

- **aberto**: ainda sem decisão, ou a correção está prevista mas não tem dono nem data.
- **aceito pelo usuário até revisão**: o usuário decidiu ou aprovou (as respostas de 2026-11-01, uma ADR, a
  especificação aprovada da fase 2); fica assim até o "Revisar em".
- **pendente de validação no relógio**: a escolha depende do que o P85 faz e é conferida na validação da fase 2
  (2026-11-03, Android e iPhone) ou na seguinte; o resultado vai para a entrada e para o `docs/pendencias.md` do Repo 1.

## Índice

| DP | Desvio | Status |
|---|---|---|
| | **Pareamento e conexão** | |
| DP-01 | Desconectar não reseta o relógio; esquecer e reset são métodos separados | aceito pelo usuário até revisão |
| DP-02 | `resetDevice` como método próprio, com Promise, nas três famílias | pendente de validação no relógio |
| DP-03 | Vínculo clássico no Android sem o laço de diálogos | aceito pelo usuário até revisão |
| DP-04 | `deviceId` no iOS é o UUID do periférico, não o MAC | aberto |
| DP-05 | Fila serial: comandos esperam o anterior e o fim do sync | aceito pelo usuário até revisão |
| DP-91 | `resetDevice` na fila serial e `DISCONNECTED` se o link cair logo | pendente de validação no relógio |
| DP-92 | Scan de 7 s com um `onScannedDevice` por endereço | aberto |
| | **Dados de passos, sono e bateria (fase 1)** | |
| DP-06 | Distância e calorias nos campos certos no histórico do Android | aberto |
| DP-07 | Sem pedir distância e calorias por meia hora (`5D`/`5C`) | aceito pelo usuário até revisão |
| DP-08 | Sonda do `33 01` (totais de ontem) | aceito pelo usuário até revisão |
| DP-09 | Passos ao vivo durante a atividade | aceito pelo usuário até revisão |
| DP-10 | `B6 01` aceito como resposta do sono | aceito pelo usuário até revisão |
| DP-11 | Data do sono vira às 20h com `≥ 20`, não `> 20` | aceito pelo usuário até revisão |
| DP-12 | Sem o REM que a SDK fabrica | aceito pelo usuário até revisão |
| DP-13 | `0x32` sem resposta não trava a fila | aceito pelo usuário até revisão |
| DP-14 | Aviso espontâneo de bateria a cada minuto | aceito pelo usuário até revisão |
| DP-15 | Sem o `markYesterdayDataAsSynced` | aceito pelo usuário até revisão |
| DP-16 | Sem o `safeSum` que perde o último item | aceito pelo usuário até revisão |
| | **Contrato JS e Promises** | |
| DP-17 | Promise em vez de `void` em cinco métodos | aceito pelo usuário até revisão |
| DP-18 | Códigos de erro próprios em vez de `"-1"` | aceito pelo usuário até revisão |
| DP-19 | D8: sem `NullPointerException` com o relógio desconectado | aceito pelo usuário até revisão |
| DP-20 | D8: `NOT_READY` em vez de resolver sem conexão | aceito pelo usuário até revisão |
| DP-21 | D8: resolve depois da escrita, não antes | aceito pelo usuário até revisão |
| DP-22 | D8: toda Promise termina | aceito pelo usuário até revisão |
| DP-23 | D8: sem listeners globais trocados a cada chamada | aceito pelo usuário até revisão |
| DP-77 | Tipos de entrada da fase 2: `reminder`, `notifyType` numérico e exports a mais | aberto |
| DP-78 | `observed()` também nos métodos que já eram Promise | aceito pelo usuário até revisão |
| DP-79 | `shouldShowNotificationModal` ignorado | aceito pelo usuário até revisão |
| DP-80 | SMA e iDO recusam todo ajuste e toda ação da fase 2 com `NOT_SUPPORTED` | aceito pelo usuário até revisão |
| DP-93 | Métodos da fase 1 que eram `void` devolvem Promise sem `observed()` | aberto |
| DP-96 | Entrada malformada rejeita `INVALID_ARGUMENT` antes da sessão, inclusive nos campos que o CRP ignora | aberto |
| DP-97 | Campos ausentes valem um padrão, e booleanos aceitam número, em vez de exceção nativa | aberto |
| DP-99 | Argumento `null` no lugar de mapa, lista ou texto rejeita sem `code` nem `onError` (Android) | aberto |
| DP-100 | Argumento `null` no lugar de mapa, lista ou texto rejeita `INVALID_ARGUMENT` sem `onError` no shim (iOS) | aberto |
| DP-81 | Frames com dado pessoal redigidos no log e nos exports | aceito pelo usuário até revisão |
| | **Ajustes** | |
| DP-24 | D8: idade sem o mês deslocado (Android) | aceito pelo usuário até revisão |
| DP-25 | D8: data do alarme único certa na virada do mês (iOS) | aceito pelo usuário até revisão |
| DP-26 | D8: os 7 dias do alarme como "todo dia" também no iOS | pendente de validação no relógio |
| DP-27 | D8: intervalo de frequência cardíaca abaixo de 5 min | aceito pelo usuário até revisão |
| DP-28 | D8: valores acima de 255 saturam em vez de truncar | aceito pelo usuário até revisão |
| DP-29 | Números fracionários arredondados, não truncados | aceito pelo usuário até revisão |
| DP-30 | Metas sem a tag 03 também no iOS | pendente de validação no relógio |
| DP-31 | `setTemperatureUnit` espera o `8C` | aceito pelo usuário até revisão |
| DP-32 | Economia de bateria espera o eco `A4` | pendente de validação no relógio |
| DP-33 | Estresse automático confirmado também no iOS, em 4 s | aceito pelo usuário até revisão |
| DP-34 | D8: sem a flag global do estresse | aceito pelo usuário até revisão |
| DP-35 | D8: um `B9 11 01` não pedido não resolve a Promise | aceito pelo usuário até revisão |
| DP-36 | Gesto sem a conferência `28`/`82` (Android) | pendente de validação no relógio |
| DP-37 | Unidade de distância desconhecida rejeita | aceito pelo usuário até revisão |
| DP-38 | Lembretes do ciclo menstrual = `reminder`, ou `enabled` sem ele | aceito pelo usuário até revisão |
| DP-39 | Não perturbe respeita o `alwaysOn` | pendente de validação no relógio |
| DP-40 | D8: coordenadas do relógio mundial certas | aceito pelo usuário até revisão |
| DP-41 | D8: lista vazia limpa o relógio mundial (Android) | pendente de validação no relógio |
| DP-42 | Relógio mundial no iOS: apagar por `BB 00 03`, `jetLag` e conferência | pendente de validação no relógio |
| DP-43 | D8: cidade com nome vazio rejeita em vez de ser pulada | aceito pelo usuário até revisão |
| DP-83 | Unidade de temperatura da conexão vem de qualquer `8C` válido | aberto |
| DP-84 | Ciclo menstrual: dia e mês como vieram, sem a normalização do `Calendar` (Android) | aberto |
| DP-85 | Alarme único depois de 2030 recusa com `PROTOCOL`; hora e minuto saturam | aceito pelo usuário até revisão |
| DP-86 | Relógio mundial e clima: corte em caractere inteiro e temperatura saturada | aceito pelo usuário até revisão |
| DP-95 | Gênero e unidade de temperatura sem diferenciar maiúsculas; string desconhecida rejeita | aberto |
| | **Mensagens** | |
| DP-44 | Sem encaminhamento de notificações no Android | aceito pelo usuário até revisão |
| DP-45 | `checkIsNotificationServiceEnabled` resolve `true` no Android | aceito pelo usuário até revisão |
| DP-46 | Filtro de notificações vai ao relógio também no Android | pendente de validação no relógio |
| DP-47 | Filtro no iOS: chaves normalizadas e silêncio que não rejeita | pendente de validação no relógio |
| DP-48 | D8: 'Youtube Music' e 'Email' ligam no iOS | aceito pelo usuário até revisão |
| DP-49 | D8: CALENDAR ganha código no iOS | aceito pelo usuário até revisão |
| DP-50 | Ligações só pelo HFP, sem a notificação de ligação pelo `0x41` | aceito pelo usuário até revisão |
| DP-51 | Contatos: o '+', a largura do nome, o avatar e o emoji | pendente de validação no relógio |
| DP-52 | D8: ids de contato sem buracos | aceito pelo usuário até revisão |
| DP-53 | D8: confirmação de cada contato pelo id | pendente de validação no relógio |
| DP-54 | D8: clima sem o truque `unit = 2` e sem reenvio a cada `8C` | aceito pelo usuário até revisão |
| DP-55 | D8: nascer e pôr do sol sem o parse estrito | aceito pelo usuário até revisão |
| DP-56 | Clima no iOS: `B5`, 7 dias, ícones do Android e cache mantido | pendente de validação no relógio |
| DP-87 | Filtro: a lista do relógio (e a falta dela) vale a conexão inteira | pendente de validação no relógio |
| DP-88 | Contatos: limite do `F2 00`, perfil uma vez por conexão e só o '+' inicial | pendente de validação no relógio |
| DP-89 | Codec do `0x41` sem a troca de emoji e sem perder o texto depois do segundo ':' | aberto |
| DP-98 | Clima guardado mesmo com a Promise rejeitada, e reenviado por um pedido interno | aberto |
| | **Interações** | |
| DP-57 | Encontrar celular só com o evento JS (opção A) | aceito pelo usuário até revisão |
| DP-58 | Regra do `62` do Android também no iOS | pendente de validação no relógio |
| DP-59 | `onOpenCameraMode` depois da escrita, nas duas plataformas | aceito pelo usuário até revisão |
| DP-60 | Disparo com a câmera fechada não promove o modo (iOS) | aceito pelo usuário até revisão |
| DP-61 | Saída da câmera pelo relógio só com `53 0E FF` (Android) | pendente de validação no relógio |
| DP-62 | Modo câmera zerado ao desconectar | aceito pelo usuário até revisão |
| DP-63 | Sem câmera disparada pelo relógio com o app em segundo plano (Android) | aceito pelo usuário até revisão |
| DP-64 | Sem controle de música por BLE no Android | aceito pelo usuário até revisão |
| DP-82 | Evento do relógio antes do `READY` só vai para o log | aceito pelo usuário até revisão |
| DP-90 | Eco do `66` nos 200 ms do `openCameraMode` não vira foto | pendente de validação no relógio |
| DP-101 | Eventos da câmera no Android com `{}` e sem fila enquanto o JS não existe | aceito pelo usuário até revisão |
| | **Plataforma e segundo plano** | |
| DP-65 | Sem serviço em primeiro plano persistente no Android | aceito pelo usuário até revisão |
| DP-66 | Ajustes depois do sync sem o serviço em primeiro plano | aberto |
| DP-67 | Sem pareamento pelo CDM | aceito pelo usuário até revisão |
| | **Previstos para as fases 3 e 4** | |
| DP-68 | Clima não chega ao relógio sem o `getCurrentGeolocation` | aceito pelo usuário até revisão |
| DP-69 | Permissões que vinham do manifest do Core antigo | aberto |
| DP-70 | Stubs de compatibilidade que resolvem sem tráfego | aceito pelo usuário até revisão |
| DP-71 | Stubs de compatibilidade que rejeitam `NOT_SUPPORTED` | aceito pelo usuário até revisão |
| DP-72 | Perfil do usuário só em memória | aceito pelo usuário até revisão |
| DP-73 | Exports do Core que o app Condor usa e não existem aqui | aberto |
| DP-74 | Desvios previstos da fatia de encaminhamento (SMS e acentos) | aberto |
| DP-94 | Sync sem frequência cardíaca, estresse e treinos (até a fase 3) | aceito pelo usuário até revisão |
| | **Outros modelos CRP** | |
| DP-75 | Relógio Force: CRP só com BLE, sem Bluetooth clássico | aberto |
| DP-76 | Recursos por modelo (`DeviceFeatures`) não conferidos | aberto |

## 1. Pareamento e conexão

### DP-01 — Desconectar não reseta o relógio; esquecer e reset são métodos separados

- **Produção**: o app Condor chama `disconnectCurrentDevice` em todo botão que tira o relógio (a lista está na
  ADR 33). No Android, ele chama `disconnect(true)` (`CRPService.java:269-273`): reset de fábrica `51 02`
  (`CRPBleConnectHelper.java:423-425, 443-448`) e, 1 s depois, a desconexão com a remoção do vínculo clássico
  (`:452-473`), além de apagar o perfil em cache e o banco local. No iOS, chama o `reset` da SDK (o `51 02`:
  `iOS-bin@0xd6038` manda o array estático de `iOS-bin@0x1c5ab0`, com os bytes `51 02` em `0x1c5ad0`) e depois o
  `remove:` (`CRPService.m:208-232`), e apaga o banco local. A ADR 33 só citava o Android: o iOS de produção também
  reseta.
- **Core Next**: `disconnectCurrentDevice` só desconecta. `forgetDevice` manda o `F8`, o host remove o vínculo
  clássico (Android; no iOS só loga a dica de esquecer nos Ajustes) e o pareamento salvo e o histórico local são
  apagados. O reset só sai pelo `resetDevice` (DP-02). ADRs 30 e 33.
- **Motivo**: decisão do usuário de 2026-11-01 (ADR 33): esquecer nunca reseta.
- **Impacto para o usuário**: com o Core trocado, desconectar no app Condor não volta o relógio às configurações de
  fábrica; dados e ajustes ficam no relógio, e o próximo pareamento o encontra como estava.
- **Como corrigir ou voltar**: na fase 4, o adaptador do app Condor escolhe o que cada botão chama (por exemplo, o
  reset da tela Dispositivo chama `resetDevice` e depois `forgetDevice`; o desconectar, só `forgetDevice`). Voltar à
  produção seria o `forgetDevice` do CRP mandar o `51 02` 1 s antes do `F8` (ADR 33, "Como reverter").
- **Revisar em**: fase 4 (adaptador do app Condor).
- **Status**: aceito pelo usuário até revisão.

### DP-02 — `resetDevice` como método próprio, com Promise, nas três famílias

- **Produção**: `resetDevice: () => void` (`NativeCore.ts:119`). CRP Android: só o `51 02` pelo
  `bleConnection.reset()`, sem desconectar nem esperar (`CRPService.java:1168-1170`;
  `CRPBleConnectHelper.java:443-448`). CRP iOS: método vazio (`CRPService.m:1612`). SMA: vazio nas duas plataformas
  (`SMAService.java:1596-1597`, `SMAService.m:1492`). iDO: o Android chama `disconnectCurrentDevice`
  (`IDOService.java:1701-1703`) e o iOS manda o comando de restaurar a fábrica e desconecta (`IDOService.m:2472-2477`).
  Nenhum dos dois apps chama `resetDevice` hoje (busca em `GTE-CondorSmart/src` e `GTE-Mormaii/src`).
- **Core Next**: `resetDevice(): Promise<void>`, com o nome do Core. No CRP manda `51 02` e não espera resposta (o
  relógio não responde, `sdk:f/x.java:21-25`); SMA e iDO rejeitam `NOT_SUPPORTED` (decisões do usuário; ADR 33).
- **Motivo**: decisão do usuário (ADR 33): o reset é um método separado do esquecer.
- **Impacto para o usuário**: no iPhone, o reset do Condor passa a resetar o relógio (antes não fazia nada). No app
  Mormaii, um `resetDevice` (hoje não chamado) rejeitaria com `onError`, onde a produção não fazia nada (fitGPS) ou
  desconectava e restaurava (Life Ultra GPS).
- **Como corrigir ou voltar**: implementar o reset no SMA e no iDO se o app Mormaii precisar; o que o link faz depois
  do `51 02` (se o relógio cai, se a sessão tenta reconectar) entra na entrada depois da validação.
- **Revisar em**: validação da fase 2 (link depois do reset) e fase 4.
- **Status**: pendente de validação no relógio.

### DP-03 — Vínculo clássico no Android sem o laço de diálogos

- **Produção**: no `READY` do BLE, sem vínculo, o Core pede o `createBond` à SDK (`CRPBleConnectHelper.java:513-518,
  664-668`). O prazo de 12 s do estado "conectando" (`:55, 187-188, 610-623`) não é cancelado durante o diálogo e
  derruba a conexão, e um `BOND_NONE` (recusa ou falha) também (`:788-795`): o GATT reconecta e o diálogo volta, em
  laço.
- **Core Next**: o `ClassicBonder` do host Android dá 45 s por tentativa e faz uma nova tentativa automática 1,5 s
  depois de uma falha; depois da segunda, `onError` `CLASSIC_BOND_FAILED` e nenhum pedido novo até o próximo
  `pairDevice`. A sessão BLE continua pronta (ADR 30;
  [`transporte-android.md`](transporte-android.md#vínculo-clássico-bredr)).
- **Motivo**: ADR 30 (bug de produção não copiado); fase 1 validada pelo usuário no Android em 2026-11-01.
- **Impacto para o usuário**: quem recusa o diálogo fica com o relógio conectado sem chamadas nem música até parear
  de novo pelo app ou nos Ajustes do Android, em vez de ver o diálogo voltar.
- **Como corrigir ou voltar**: se o produto quiser insistir, mais tentativas no `ClassicBondTracker` ou um pedido novo
  no próximo `READY`. Voltar ao laço não é recomendado.
- **Revisar em**: fase 4 (primeiro pareamento no app Condor).
- **Status**: aceito pelo usuário até revisão.

### DP-04 — `deviceId` no iOS é o UUID do periférico, não o MAC

- **Produção**: o CRP iOS emite no scan o MAC que vem no anúncio (`CRPService.m:721-731`, `arr[i].mac`) e pareia por
  ele (`:652-680`); o app compara MAC sem `:` (fase 0, CON-37).
- **Core Next**: o UUID do periférico do CoreBluetooth, como nos outros relógios
  ([`ios-pendente.md`](ios-pendente.md#condor-reebok-crp)).
- **Motivo**: o CoreBluetooth não expõe o MAC; a SDK iOS o lê de `FEC9`/`FEE4` (Repo 1, `docs/pendencias.md`, fase 4).
- **Impacto para o usuário**: na troca, o app Condor no iPhone não reconhece pelo `deviceId` o relógio salvo antes, e
  o que ele guarda ou manda com esse identificador muda (o uso no backend: a verificar no app Condor).
- **Como corrigir ou voltar**: ler o MAC como a SDK iOS e emiti-lo no lugar do UUID, ou o adaptador do app aceitar o
  UUID e migrar o salvo.
- **Revisar em**: fase 4.
- **Status**: aberto.

### DP-05 — Fila serial: comandos esperam o anterior e o fim do sync (o `vibrateDevice` atrasa)

- **Produção**: a SDK encadeia os pedidos numa fila de escrita com um atraso por comando, sem esperar a resposta do
  anterior (ADR 25; `sdk:m/f.java:94-130`), e tem uma via de prioridade (`sdk:m/f.java:167-169`). O `vibrateDevice`
  vai direto para essa fila (`CRPService.java:581-583`; `CRPService.m:1017-1019`). Quanto ele atrasa durante um sync
  de produção não foi medido (a verificar).
- **Core Next**: um pedido por vez, esperando cada resposta (ADR 25); comandos aceitos em `SYNCING` entram na fila e
  rodam depois do sync (D5), sem prioridade para comandos curtos na fase 2.
- **Motivo**: ADR 25 (sem ambiguidade de casamento e sem a trava do `0x32`) e D5.
- **Impacto para o usuário**: o sync fica mais lento que o da SDK (5,6 s no P85, Repo 1 `docs/pendencias.md`). Um
  "Encontrar relógio" durante um sync só vibra depois dele, e o aviso de 3 s do Condor já fechou
  (`condor:screensV2/home/DeviceLocation/Components/SelectedDeviceInfo/index.tsx:66, 79-83`). Do mesmo jeito, a tela
  de câmera aberta durante um sync só abre a câmera do relógio depois dele; até lá o modo câmera do app está desligado,
  e um disparo pelo menu do relógio vira `onDeviceRequestedCameraMode`, que nenhuma tela do Condor Reebok escuta. Se o
  usuário sai da tela antes do fim do sync, o abrir e o fechar saem em seguida e o modo fica desligado (DP-59).
- **Como corrigir ou voltar**: prioridade para comandos curtos sem resposta (o `61` da vibração) entre as páginas do
  sync.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-91 — `resetDevice` na fila serial e `DISCONNECTED` se o link cair logo

- **Produção**: no Android, o `reset()` da SDK põe o `51 02` na via de prioridade da fila dela
  (`sdk:h/a.java:1269-1271` → `sdk:m/f.java:167-169`, mensagem de tipo 8 com prioridade; `sdk:p/b.java:35-36,
  58-59`: a lista de prioridade sai antes da comum), então ele passa na frente do que já estava na fila (as páginas de
  um sync, por exemplo). O Core não espera nada e nunca falha (`resetDevice: () => void`, `NativeCore.ts:119`;
  `CRPService.java:1168-1170` → `CRPBleConnectHelper.java:443-448`, que só sai sem `bleConnection`). No iOS o
  `resetDevice` é vazio (`CRPService.m:1612`), e o `reset` da SDK (`51 02`, sem callback, `iOS-h:2824`) só sai pelo
  `disconnectCurrentDevice` (DP-01). Os bytes são os mesmos nas duas SDKs (`sdk:f/x.java:21-25`;
  `iOS-bin@0xd6038` → `data@0x1c5ab0` = `51 02`).
- **Core Next**: `WatchAction.FactoryReset` entra na fila serial da sessão como qualquer comando: espera o comando em
  andamento e, em `SYNCING`, o fim do sync (D5, ADR 25). Resolve depois da escrita e do atraso da fila de 200 ms
  (D4(a); `CrpInteractions`, Repo 1). Se o relógio derrubar o link nesses 200 ms (por exemplo, reiniciando por causa do
  reset), a sessão falha o pedido com `DISCONNECTED`, embora o `51 02` tenha sido escrito
  (`CrpInteractionsSessionTest.linkDropInsideTheResetDelayRejectsWithDisconnected`, Repo 1). Depois de uma queda com
  o link pronto, a sessão tenta reconectar sozinha, como em qualquer queda.
- **Motivo**: ADR 25 e D5 (um pedido por vez, sem prioridade na fase 2); D4(a) (escrita sem resposta termina depois da
  escrita e do atraso).
- **Impacto para o usuário**: hoje nenhum app chama o `resetDevice` (DP-02). Quando a fase 4 o ligar a um botão, um
  reset pedido durante um sync só sai depois dele; e, se o P85 cair logo depois do `51 02`, a Promise rejeita com
  `DISCONNECTED` e o app pode mostrar erro de um reset que deu certo.
- **Como corrigir ou voltar**: se a validação mostrar a queda dentro dos 200 ms, tratar como sucesso o `DISCONNECTED`
  que chega depois da escrita do `51 02` (no `CrpInteractions` ou no adaptador do app da fase 4); se o produto
  precisar, uma prioridade para o reset na fila da sessão (como a sugerida no DP-05).
- **Revisar em**: validação da fase 2 (o que o P85 faz depois do `51 02`: se reinicia, se derruba o link, em quanto
  tempo, e se perde o vínculo BLE e o clássico) e fase 4.
- **Status**: pendente de validação no relógio.

### DP-92 — Scan de 7 s com um `onScannedDevice` por endereço

- **Produção**: o CRP Android escaneia por 20 s (`CRPBleConnectHelper.java:817-881`, o `20 * 1000` em `:880`) e emite
  `onScannedDevice` a cada `onScanning` da SDK, sem deduplicar no Core (`:852`; se a SDK repete o mesmo aparelho: a
  verificar). O CRP iOS escaneia por 10 s (`scan:10`, `CRPService.m:716`, com o timer de 10 s que chama o
  `interruptScan`, `:749-759`) e, a cada `progressHandler`, emite de novo todo aparelho conhecido da lista recebida
  (`:717-733`). O app Condor espera 20 s na tela de busca antes de decidir entre "encontrado" e "não encontrado"
  (`condor:screensV2/pairing/SearchingDevices/index.tsx:40-44`) e deduplica pelo `deviceId`
  (`condor:store/TopLevelContext/Pairing/usePairingData/index.ts:64-76`).
- **Core Next**: 7 s nas duas plataformas (`BleScanner.SCAN_DURATION_MS`, `BleScanner.kt:175`;
  `CentralTransport.scanDuration`, `CentralTransport.swift:55`), o tempo do Core SMA (`SMAService.java:625-635`), e um
  `onScannedDevice` por endereço por busca ([`api-js.md`](api-js.md#scan-void)).
- **Motivo**: decisão da fase 1, herdada do fitGPS (um tempo só para todos os perfis,
  [`transporte-android.md`](transporte-android.md#scan-blescanner)); a emissão única por endereço também é dessa fase
  e não foi revista para o CRP.
- **Impacto para o usuário**: um P85 que só aparece depois de 7 s não entra na lista dos 20 s da tela de busca do Condor
  (sem nenhum aparelho, a tela mostra "não encontrado"), nem no pareamento pelo QR code, que escaneia e espera o relógio
  (`condor:screensV2/pairing/ConnectingDevice/index.tsx:63-64`). Com dois relógios achados quase juntos, o handler do
  Condor monta a lista a partir da do último render (`setDeviceList([...deviceList, e])`) e pode perder um; sem a
  repetição da produção, ele não volta nesta busca.
- **Como corrigir ou voltar**: um tempo de scan por perfil (20 s no Android e 10 s no iOS para o CRP), como dado do
  perfil no Repo 1, e reemitir o aparelho a cada anúncio (ou a cada N s) no host; ou o adaptador do app Condor da fase 4
  chamar `scan()` de novo até os 20 s.
- **Revisar em**: fase 4 (troca do pacote no app Condor) ou antes, se a validação mostrar o P85 demorando a aparecer.
- **Status**: aberto.

## 2. Dados de passos, sono e bateria (fase 1)

### DP-06 — Distância e calorias nos campos certos no histórico do Android

- **Produção**: o `onHistoryPedometer` do Android põe as calorias em `distance` e a distância em `calorie`
  (`CRPService.java:391-392`); o iOS está certo.
- **Core Next**: metros em `distance` e kcal em `calorie` nas duas plataformas (`EventMapper` do Repo 1).
- **Motivo**: bug de produção não copiado (Repo 1, `docs/pendencias.md`, "Bugs do Condor de produção").
- **Impacto para o usuário**: no Android, o app Condor passa a receber os dois valores nos campos certos; o que ele já
  mandou ao backend pelo Android pode estar trocado.
- **Como corrigir ou voltar**: nada no Core; o app ou o backend decide se corrige o histórico antigo.
- **Revisar em**: fase 4 (o que o backend espera receber).
- **Status**: aberto.

### DP-07 — Sem pedir distância e calorias por meia hora (`5D`/`5C`)

- **Produção**: o Core pede as categorias de distância e calorias de hoje e de ontem (`CRPService.java:205-215`), e o
  P85 não responde (`pair-sync@56403`, `@56631`, `@58957`, `@59184`).
- **Core Next**: não pede; a distância e as calorias do dia vêm da `FEE1` (hoje) e do `33 01` (ontem) (ADR 28).
- **Motivo**: ADR 28 (só gastariam timeouts).
- **Impacto para o usuário**: nenhum com o P85; um firmware que respondesse ficaria sem distância e calorias por meia
  hora.
- **Como corrigir ou voltar**: voltar a pedir quando um firmware responder (catálogo e codec já existem).
- **Revisar em**: quando entrar outro firmware ou modelo CRP.
- **Status**: aceito pelo usuário até revisão.

### DP-08 — Sonda do `33 01` (totais de ontem)

- **Produção**: o app de produção nunca manda `0x33` (não está entre as consultas do `CRPService.java`).
- **Core Next**: sonda `33 01` uma vez por conexão; o P85 responde no formato legado (`real@225338`), e o driver usa
  os totais de ontem e o sono legado (`33 03`/`33 04`) (ADRs 28 e 29).
- **Motivo**: ADR 28.
- **Impacto para o usuário**: os totais de ontem (passos, metros, kcal) vêm do relógio; um pedido a mais por conexão.
- **Como corrigir ou voltar**: desligar a sonda no `CrpDriver`.
- **Revisar em**: fase 3.
- **Status**: aceito pelo usuário até revisão.

### DP-09 — Passos ao vivo durante a atividade

- **Produção**: o Core Android só aceita a primeira notificação de `FEE1` depois de cada sync (`canSaveLiveSteps`,
  `CRPService.java:1422-1447`); na captura, o Condor mostrou zeros durante a caminhada (`walk@106148` a `@136148`).
- **Core Next**: cada `FEE1` atualiza o dia, com no máximo um `onPedometer` a cada 2 s (ADR 28).
- **Motivo**: ADR 28.
- **Impacto para o usuário**: o app Condor recebe `onPedometer` durante a caminhada; o que a tela mostra depende de
  como o app trata o evento (a verificar no app Condor).
- **Como corrigir ou voltar**: limitar a um `onPedometer` por sync no `CoreBridge` (não recomendado).
- **Revisar em**: fase 3 (atividades).
- **Status**: aceito pelo usuário até revisão.

### DP-10 — `B6 01` aceito como resposta do sono

- **Produção**: o `onHistorySleepChange` do Android é vazio (`CRPService.java:1729-1730`); um firmware que só
  respondesse `B6 01` nunca teria sono salvo.
- **Core Next**: aceita `B6 01 0x` como resposta do `32`/`33 0x` (ADR 29).
- **Motivo**: ADR 29.
- **Impacto para o usuário**: nenhum com o P85, que responde no formato legado.
- **Como corrigir ou voltar**: tirar o caso `B6` do driver.
- **Revisar em**: quando entrar outro firmware ou modelo CRP.
- **Status**: aceito pelo usuário até revisão.

### DP-11 — Data do sono vira às 20h com `≥ 20`, não `> 20`

- **Produção**: o `onSleepChange` do Android soma um dia com hora `> 20` (`CRPService.java:1721-1722`); a SDK usa
  `≥ 20` (`sdk:j/o0.java:169-173`).
- **Core Next**: a regra da SDK (ADR 29).
- **Motivo**: ADR 29.
- **Impacto para o usuário**: um sono lido entre 20:00 e 20:59 cai no dia seguinte (na produção, no mesmo dia).
- **Como corrigir ou voltar**: trocar a comparação em `CrpSleepAssembler.sleepDate`.
- **Revisar em**: fase 3, com uma noite real.
- **Status**: aceito pelo usuário até revisão.

### DP-12 — Sem o REM que a SDK fabrica

- **Produção**: o Core grava a sessão que a SDK monta, com o REM que ela fabrica quando o relógio não manda REM
  (`sdk:j/k0.java`, ADR 29), e o total leve + profundo + REM (`CRPService.java:2018-2041`).
- **Core Next**: monta a sessão como a SDK, sem fabricar o REM; o total é o mesmo (ADR 29).
- **Motivo**: ADR 29.
- **Impacto para o usuário**: um relógio que não mande REM mostra mais sono leve que no app de produção.
- **Como corrigir ou voltar**: reproduzir o `sdk:j/k0.java` no `CrpSleepAssembler`.
- **Revisar em**: fase 3, com uma noite real.
- **Status**: aceito pelo usuário até revisão.

### DP-13 — `0x32` sem resposta não trava a fila

- **Produção**: sem resposta ao `0x32`, a fila da SDK fica parada até o watchdog, que só é avaliado quando outro
  comando entra (`sdk:o/b.java:18-38`; `sdk:p/c.java:33-43`; ADR 29).
- **Core Next**: o `0x32` sem resposta termina em 4 s e o sync segue sem o sono de hoje (ADR 29).
- **Motivo**: ADR 29.
- **Impacto para o usuário**: nenhum com o P85, que responde com o eco vazio; um firmware calado não trava o sync.
- **Como corrigir ou voltar**: não há o que voltar (seria travar o sync).
- **Revisar em**: fase 3.
- **Status**: aceito pelo usuário até revisão.

### DP-14 — Aviso espontâneo de bateria a cada minuto

- **Produção**: o Core não assina a `2A19` (a SDK só a assina em `subscribeDeviceBattery`, `sdk:h/a.java:423`, que
  o Core nunca chama); a bateria só chega na leitura pedida.
- **Core Next**: assina a `2A19` e emite `onBatteryStatus` sem pedido a cada cerca de 60 s (ADRs 26 e 31).
- **Motivo**: ADRs 26 e 31.
- **Impacto para o usuário**: o app Condor recebe a bateria a cada minuto sem pedir.
- **Como corrigir ou voltar**: tirar a `2a19` da `sideNotify` do perfil.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-15 — Sem o `markYesterdayDataAsSynced`

- **Produção**: o Core marca "ontem sincronizado" no primeiro sinal de ontem de qualquer tipo
  (`CRPService.java:1279-1281`).
- **Core Next**: não tem essa marca; o que sai para o app é todo dia não confirmado pelo `deletedSavedData` (ADR 15).
- **Motivo**: bug de produção não copiado (Repo 1, `docs/pendencias.md`).
- **Impacto para o usuário**: ontem só some das consultas quando o app confirma, não no primeiro dado que chega.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-16 — Sem o `safeSum` que perde o último item

- **Produção**: o `safeSum` devolve 0 para o último item de uma lista de tamanho ímpar
  (`CRPStepsAndRelatedListenerManager.java:117-121`).
- **Core Next**: soma todas as meias horas (ADR 28, `CrpStepsMapper`).
- **Motivo**: bug de produção não copiado (Repo 1, `docs/pendencias.md`).
- **Impacto para o usuário**: nenhum visto com o P85 (as páginas `59` têm 24 itens).
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: quando entrar outro firmware ou modelo CRP.
- **Status**: aceito pelo usuário até revisão.

## 3. Contrato JS e Promises

### DP-17 — Promise em vez de `void` em cinco métodos

- **Produção**: `vibrateDevice`, `openCameraMode`, `closeCameraMode`, `syncWeather` e `resetDevice` são `void`
  (`NativeCore.ts:18, 25, 27, 66, 119`) e falham em silêncio.
- **Core Next**: todos devolvem `Promise<void>`, com rejeição e `onError`; o wrapper passa cada Promise por
  `observed()` para as chamadas diretas sem `await` não gerarem aviso (D6).
- **Motivo**: regra do Repo 2 (Promise com rejeição, [`api-js.md`](api-js.md#regras-gerais)) e D6.
- **Impacto para o usuário**: nenhum em release. Em debug, onde o app Condor chama por um wrapper async sem `await`
  (os `onHide` das telas, `condor:screensV2/pairing/DeviceConnectedSuccessfully/index.tsx:78-85`, D6), uma rejeição
  gera "Possible unhandled promise rejection".
- **Como corrigir ou voltar**: o adaptador da fase 4 põe `.catch` nesses pontos.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-18 — Códigos de erro próprios em vez de `"-1"`

- **Produção**: as rejeições do CRP usam `"-1"` (às vezes `"1"`) com mensagem livre: "crpBleConnection is null"
  (`CRPService.java:893-897`), "Not implemented for this device" (`:1149-1151`), "Timeout error."
  (`CRPQueueManager.kt:28`), "Watch info not is equal requested info" (`CRPUserSettingsManager.java:89`).
- **Core Next**: `NOT_SUPPORTED` (novo, D2), `NOT_READY`, `INVALID_ARGUMENT`, `TIMEOUT`, `PROTOCOL` e os demais de
  `errorCodes` ([`api-js.md`](api-js.md#errorcodes)), sempre com `onError` antes do reject.
- **Motivo**: contrato do Repo 2 e D2.
- **Impacto para o usuário**: nenhum direto; código do app que compare o `"-1"` ou a mensagem muda, e o Crashlytics do
  Condor agrupa os erros por outra mensagem.
- **Como corrigir ou voltar**: o adaptador da fase 4 traduz, se algum ponto do app depender da mensagem.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-19 — D8: sem `NullPointerException` com o relógio desconectado

- **Produção**: no Android, estes métodos usam a `bleConnection` sem conferir se é nula (ela é zerada no `closeGatt`,
  `CRPBleConnectHelper.java:335-340`): `setUserInfo` (`CRPService.java:1051-1053`), `setSosHelp` (`:1322-1324`),
  `setMenstrual` (`:1076-1078`), `setHeartRateAutomaticCheck` (`:871-880`), `setAlarm` (`:947-962`),
  `setStressAutomaticCheck` (`:883-885`), `closeCameraMode` (`CRPCameraManager.kt:20-23`) e `vibrateDevice`
  (`CRPService.java:581-583`). Desconectado, lançam `NullPointerException` na thread dos módulos nativos.
- **Core Next**: fora de `READY`/`SYNCING`, `NOT_READY` antes de qualquer escrita; o `closeCameraMode` sem conexão zera
  o estado da câmera e resolve sem escrever (D5).
- **Motivo**: D8 (bug de produção não copiado).
- **Impacto para o usuário**: chamar esses métodos com o relógio desconectado não derruba mais o app; o app recebe a
  rejeição.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-20 — D8: `NOT_READY` em vez de resolver sem conexão

- **Produção**: com a `bleConnection` nula, `setScreenTime` e `setNotDisturb` resolvem sem escrever
  (`CRPService.java:1154-1158, 1081-1085`): o ajuste se perde em silêncio.
- **Core Next**: `NOT_READY` (D5).
- **Motivo**: D8.
- **Impacto para o usuário**: o app sabe que não gravou; no sync de ajustes, cada rejeição vira um evento no
  Crashlytics do Condor (`condor:` `useUserSettingsSyncHandler.ts:101-113`).
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-21 — D8: resolve depois da escrita, não antes

- **Produção**: os ajustes CRP põem o comando na fila da SDK e resolvem na hora (por exemplo,
  `CRPService.java:871-880, 947-962`; `CRPUserSettingsManager.java:50-69, 228-250`; no iOS, `CRPService.m:834-850` e
  `CRPUserSettings.m:211-218`), mesmo quando a SDK não manda nada (DP-27).
- **Core Next**: resolve depois da escrita e do atraso da fila (200 ms; 500 ms no `0x12`), ou depois da confirmação
  onde o relógio confirma (D4).
- **Motivo**: D8 e D4.
- **Impacto para o usuário**: cada ajuste leva cerca de 200 ms a mais (o sync completo de ajustes fica com 5 a 8 s);
  uma escrita que falha vira rejeição.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-22 — D8: toda Promise termina

- **Produção**: há caminhos que nunca terminam: `mainService?.currentSdk?.X(...)` sem SDK não chama nada e não
  liquida a Promise (`NativeCoreModule.kt:327, 385, 932, 1096`); `setWalkReminder` espera o `2D` sem prazo
  (`CRPUserSettingsManager.java:79-94`); o gesto espera `28` e `82` sem prazo (`:331-342`); `manageMusicOption` com a
  activity nula retorna sem resolver (`CRPService.java:1116-1117`); `setFindTelephoneControl` nunca resolve
  (`:1128-1131`). No iOS, o `manageNotifications` e o `setAddressBook` dependem do callback da SDK
  (`CRPService.m:621`; `CRPPhoneManager.m:40-44`); se a SDK iOS sempre chama o callback com prazo: a verificar.
- **Core Next**: toda Promise termina com prazo: `NOT_READY` imediato fora de `READY`/`SYNCING`, 4 s por resposta e
  respostas opcionais que nunca rejeitam (D4, D5).
- **Motivo**: D8 e D5. O Condor espera cada tarefa do sync de ajustes sem prazo
  (`condor:` `useUserSettingsSyncHandler.ts:101-113`).
- **Impacto para o usuário**: o sync de ajustes e o primeiro pareamento do Condor não travam mais numa tarefa.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-23 — D8: sem listeners globais trocados a cada chamada

- **Produção**: o relógio mundial e os contatos trocam o listener único da SDK a cada chamada
  (`CRPUserSettingsManager.java:255`; `CRPPhoneManager.kt:36-64`); duas chamadas sobrepostas misturam as respostas.
- **Core Next**: cada pedido registra a própria espera no `CrpDriver`, um pedido por vez (ADR 25, D8).
- **Motivo**: D8.
- **Impacto para o usuário**: duas chamadas seguidas (a do `DeviceConnectedSuccessfully` sem `await` e a do sync) não
  se atrapalham.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-77 — Tipos de entrada da fase 2: `reminder`, `notifyType` numérico e exports a mais

- **Produção**: `src/NativeModules/type/watchSettings.ts`: o `TechnosMenstrualDataUpdate` não tem `reminder`
  (`:104-122`; o app Condor o acrescenta pelo `CrpMenstrualPayload`,
  `condor:types/app/entities/MenstrualCycle.ts:67-71`); o `TechnosWalkReminderUpdate.notifyType` é o enum `NotifyType`
  (`ALERT = 1`, `SILENT = 2`, `:27-49`); o objeto de dias do `repeat` é repetido dentro de cada tipo. O
  `TechnosContactItem` mora em `type/device.ts` e não é exportado por `type/index.ts`; o `TechnosFindPhoneStatus`, em
  `type/eventData/deviceInfo.ts:28-30`.
- **Core Next**: `src/types/watchSettings.ts` copia os nomes e os campos (D6), com três diferenças: `reminder?: boolean`
  no ciclo (o que o `SettingsMapper` lê, `reminder ?? enabled`, DP-38), `notifyType?: number` e o nome novo
  `TechnosRepeatWeekdays` para o objeto de dias. A raiz também exporta o `TechnosContactItem` e o
  `TechnosFindPhoneStatus` (apelido do `FindPhoneEvent`, `src/types/compat.ts`).
- **Motivo**: `src/types` só exporta tipos (`export type *`), que não carregam o valor de um enum; o campo `reminder`
  documenta o que o app Condor já manda.
- **Impacto para o usuário**: nenhum. No código, quem usa `NotifyType.ALERT` do Core não acha o enum aqui (o app Condor
  não usa: busca em `GTE-CondorSmart/src`), e qualquer número passa no tipo do `notifyType`.
- **Como corrigir ou voltar**: exportar um `NotifyType` como valor, fora de `src/types`, e voltar o tipo do campo, se
  algum app precisar.
- **Revisar em**: fase 4 (troca dos imports no app Condor).
- **Status**: aberto.

### DP-78 — `observed()` também nos métodos que já eram Promise

- **Produção**: os ajustes do Core já eram `Promise<void>` (por exemplo `setUserInfo` e `setGoalsV2`,
  `NativeCore.ts:104, 113`), e o wrapper `async` deles repassa a rejeição (`src/NativeModules/index.ts:681-683,
  725-727`): uma chamada direta sem `await` que rejeita gera "Possible unhandled promise rejection" no debug. O app
  Condor chama assim o `setUserInfo` (`condor:services/Smartwatch.ts:57-59`) e exporta outros por referência direta
  (`:78, 204-208, 281, 287`).
- **Core Next**: os 23 métodos da fase 2 e o `resetDevice` devolvem `observed(promise)` (`src/utils/promise.ts`,
  `src/index.ts`): a mesma Promise com um `.catch` vazio, que continua rejeitando para quem faz `await`; a falha sai
  também em `onError` (D6). O DP-17 trata dos cinco que eram `void`.
- **Motivo**: D6 (sem aviso nas chamadas diretas sem `await`, mantendo a Promise com rejeição).
- **Impacto para o usuário**: nenhum em release (o RN não mostra o aviso). Em debug, uma chamada direta sem `await` que
  falha deixa de mostrar o aviso; como o app Condor não assina `onError`, essa falha fica invisível no app. Quem faz
  `await` vê tudo, como antes.
- **Como corrigir ou voltar**: tirar o `observed` do wrapper (o teste "sem await não gera rejeição sem tratamento" do
  `example/__tests__/watchSettings.test.ts` passa a falhar e sai junto) ou o app assinar `onError` para registrar as
  falhas.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-79 — `shouldShowNotificationModal` ignorado

- **Produção**: no Android, o `manageNotifications` com `shouldShowNotificationModal` `true` abre o diálogo de acesso às
  notificações, só num pacote cujo nome contém "basic", com o serviço de notificações desligado e uma activity aberta
  (`CRPService.java:903-921`). O iOS recebe o argumento e não o usa (`CRPService.m:543`). O app Condor sempre manda
  `false` (`condor:services/Smartwatch.ts:96-98`).
- **Core Next**: o wrapper mantém o padrão `true` do Core e repassa o argumento; o `CoreBridge` o ignora, com DEBUG no
  log.
- **Motivo**: sem `NotificationListenerService` no host na fase 2 (DP-44), não há acesso a pedir.
- **Impacto para o usuário**: nenhum no app Condor. Um app de pacote "basic" que dependa do diálogo não o vê.
- **Como corrigir ou voltar**: quando a fatia do encaminhamento de notificações no Android entrar, decidir se o host
  abre a tela de acesso com `true`.
- **Revisar em**: fatia do encaminhamento de notificações no Android.
- **Status**: aceito pelo usuário até revisão.

### DP-80 — SMA e iDO recusam todo ajuste e toda ação da fase 2 com `NOT_SUPPORTED`

- **Produção**: no Android, o SMA aplica parte dos 23 métodos (`set12HourFormat`, `SMAService.java:1186-1189`;
  `setAlarm`, `:1118`; `syncWeather`, `:1228`; `openCameraMode`, `:717-720`), rejeita outros com `"-1"`
  (`setUserInfo`, `:1436-1438`; `setGoalsV2`, `:1548-1550`; `setNotDisturb`, `:1452-1454`; `setAddressBook`,
  `:1630-1632`) e deixa o `vibrateDevice` vazio (`:674-676`). O iDO aplica a maioria pela SDK, com confirmação
  (perfil, `UserSettingsManager.java:668-683`; metas, `:1000` em diante; `setAlarm`, `IDOService.java:1601`;
  `syncWeather`, `:670`; `openCameraMode`, `:345`; `vibrateDevice`, `:1713`). O que cada um dos 23 métodos faz no SMA
  e no iDO, um a um, e no iOS: a verificar.
- **Core Next**: o `DeviceDriver.applySetting`/`perform` recusa por padrão com `NOT_SUPPORTED`, antes de escrever
  qualquer byte, e o `SmaDriver` e o `IdoDriver` não sobrescrevem: os 20 ajustes e as 4 ações (inclusive o
  `resetDevice`, DP-02) rejeitam no fitGPS e no Life Ultra GPS, com `onError` (D2; ADR 35 do Repo 1). A recusa sai na
  vez do comando na fila, depois de um sync em andamento (DP-05), e não na chamada. As exceções do controlador valem
  para qualquer relógio: `syncWeather([])` resolve na hora sem falar com a sessão (D10), e `closeCameraMode` sem conexão
  resolve sem escrever (D5).
- **Motivo**: a fase 2 é do Condor Reebok; D2 separa "não existe nesta família" de erro de protocolo.
- **Impacto para o usuário**: nenhum no app Condor. O app Mormaii, se rodasse sobre o Core Next, perderia os ajustes e
  as ações que a produção aplica no fitGPS e no Life Ultra GPS (formato de hora, alarmes, clima, câmera e, no Life
  Ultra GPS, perfil, metas e o resto).
- **Como corrigir ou voltar**: sobrescrever `applySetting`/`perform` no `SmaDriver` e no `IdoDriver` com os codecs de
  cada família (as SDKs e os Cores de produção são a referência), um ajuste por vez.
- **Revisar em**: quando o app Mormaii for migrar para o Core Next.
- **Status**: aceito pelo usuário até revisão.

### DP-81 — Frames com dado pessoal redigidos no log e nos exports

- **Produção**: o Core Android grava no log compartilhável dados já decodificados da SDK (por exemplo, os passos,
  `CRPService.java:1439, 1465, 1481`) e o exporta pelo `shareLogs` (`CRPService.java:1192-1193`); não há export de
  frames crus. Se os ajustes com dado pessoal (perfil, ciclo, contatos, clima) entram nesse log: a verificar.
- **Core Next**: todo pacote vai para o `WatchLogger.frame` (o `frames-*.jsonl` do export do app de exemplo e o `hex`
  do `onLog`), mas os TX com dado pessoal do CRP vão redigidos, do mesmo tamanho, com só o prefixo que identifica o
  comando: `12`, `75`, `42` e `43` sem nenhum byte do payload, `41` sem nenhum (menos o `41 FF`), `B5` com o sub e
  `F2 02` com o `02` e o id. O relógio recebe os bytes reais (D14; ADR 36 do Repo 1).
- **Motivo**: D14: os exports viram fixtures versionadas e o `onLog` pode ser exportado pelo app Condor da fase 4.
- **Impacto para o usuário**: nenhum no relógio. Altura, peso, idade, ciclo, contatos e a cidade do clima nunca
  aparecem num log exportado; um erro de codec nesses comandos não aparece no export (só nos testes dourados do Repo 1
  e no relógio).
- **Como corrigir ou voltar**: tirar o `recordAs` do `CrpDriver.send` no Repo 1 (com o risco de privacidade de volta).
- **Revisar em**: fase 4, quando o app Condor decidir o que exporta do `onLog`.
- **Status**: aceito pelo usuário até revisão.

### DP-93 — Métodos da fase 1 que eram `void` devolvem Promise sem `observed()`

- **Produção**: `pairDevice`, `disconnectCurrentDevice`, `getHistoryPedometer`, `getFirmwareInfo`, `getBatteryStatus`,
  `syncDataHistory` e `getHistorySleep` são `() => void` (`NativeCore.ts:15, 17, 39, 49, 62, 74, 79`): não há o que
  rejeitar, e a falha só aparece (ou não) pelos eventos. O app Condor chama todos sem `await`, por wrappers síncronos
  (`condor:services/Smartwatch.ts:62, 66, 70, 74, 168, 197, 201`).
- **Core Next**: todos devolvem `Promise<void>` que pode rejeitar (por exemplo `NOT_READY`, `TIMEOUT`, `DISCONNECTED`,
  e o `NO_DATA` do `getHistorySleep` sem noite, [`api-js.md`](api-js.md#gethistorysleep-promisevoid)), e o wrapper as
  repassa sem `observed()` (`src/index.ts`, ao contrário dos métodos da fase 2 e do `resetDevice`, DP-17 e DP-78).
- **Motivo**: o contrato da fase 1 foi escrito para o app Mormaii, que trata as Promises (regra 3 do
  [`api-js.md`](api-js.md#regras-gerais) e item 2 da Migração do app Mormaii); o `observed()` só entrou na fase 2 (D6),
  para os métodos que o app Condor chama sem `await`.
- **Impacto para o usuário**: nenhum em release (o RN não mostra o aviso). Em debug, cada rejeição desses métodos no app
  Condor gera "Possible unhandled promise rejection": por exemplo, o `getHistorySleep` do sync
  (`condor:services/History/SleepHistory/index.ts:10`, pelo `useSyncStepsRunner.ts:88-91`) sem uma noite gravada
  (`NO_DATA`) e o `getBatteryStatus` com o relógio desconectado (`NOT_READY`).
- **Como corrigir ou voltar**: passar esses métodos por `observed()` no `src/index.ts` (o app Mormaii continua vendo a
  rejeição com `await`; a falha também sai em `onError`), ou o adaptador do app Condor da fase 4 pôr `.catch` nas
  chamadas do `Smartwatch.ts`. A escolha é do usuário.
- **Revisar em**: fase 4 (troca do pacote no app Condor).
- **Status**: aberto.

### DP-96 — Entrada malformada rejeita `INVALID_ARGUMENT` antes da sessão, inclusive nos campos que o CRP ignora

- **Produção**: os Cores leem os dicionários sem conferir quase nada. No Android, `getInt`/`getBoolean`/`getString`
  lançam exceção com a chave ausente ou nula; algumas viram rejeição: o `setAlarm` com o `Error` da exceção (código
  `EUNSPECIFIED`, o padrão do RN para `promise.reject(e)`, `NativeCoreModule.kt:476-478`) e o `setWalkReminder` com
  `"-1"` (`CRPUserSettingsManager.java:91-93`); outras escapam na thread dos
  módulos nativos (por exemplo, o `interval` e o `reminderCount` da água, `:192-193`; se isso derruba o app: a
  verificar). As horas só são conferidas no gesto e no início da água, pela forma `^\d{2}:\d{2}$` e sem faixa
  (`:196-201, 468-479`): `"25:00"` vai à SDK; o não perturbe só separa pelo `:` (`:239-246`). A janela da frequência
  cardíaca (`CRPService.java:871-880`), a janela, o intervalo e os dias do estresse
  (`CRPUserSettingsManager.java:152-163`), tudo do sedentarismo menos o `onOff` (`:79-94`) e o fim e os dias da água
  nunca são lidos: qualquer valor passa. Hora e minuto do alarme vão com cast para byte (DP-85), as coordenadas com
  `getInt` (DP-40), a data do ciclo pelo `Calendar` leniente (DP-84), e números negativos chegam à SDK. No iOS,
  `intValue`/`boolValue` dão 0 ou `NO` para o ausente e para o que não é número (`CRPUserSettings.m:26-283`), sem faixa.
- **Core Next**: o `SettingsMapper` (e o `WeatherMapper`) do Repo 1 rejeita `INVALID_ARGUMENT` antes da sessão, com
  `onError` (`requestId` -1) antes do reject e uma mensagem sem valor de dado pessoal (ADR 38 do Repo 1):
  - campo obrigatório ausente ou nulo: `year`, `month`, `day`, `weight` e `height` do perfil; `steps`, `calories` e
    `exerciseTimeInMinutes` das metas; as durações, o mês e o dia do ciclo; o `interval` da água; o `name`, o
    `utcOffsetMinutes`, a `latitude` e a `longitude` de cada cidade; o `icon`, o `min` e o `max` de cada item do clima e
    a `temperature` do item 0;
  - faixa: mês 1-12 e dia 1-31 do perfil; mês 0-11, dia 1-31, hora 0-23 e minuto 0-59 do ciclo; hora 0-23 e minuto
    0-59 do alarme; fuso ±1440 min, latitude ±90 e longitude ±180 do relógio mundial; negativos no peso, na altura, nas
    metas, nas durações do ciclo e no intervalo do estresse (o tempo de tela e a água: DP-28);
  - `"HH:mm"` com dois dígitos cada, de 00:00 a 23:59, em **todos** os campos de hora, inclusive os que o CRP ignora (a
    janela da frequência cardíaca, do estresse e do sedentarismo, o fim da água) e as do não perturbe desligado;
  - tipo errado: texto onde vai número ou booleano, `repeat` que não é objeto (estresse, não perturbe, água,
    sedentarismo), item nulo ou que não é objeto numa lista, `temperatureUnit` do clima diferente de `"c"`/`"f"`.
  A unidade de distância (DP-37), o nome vazio da cidade (DP-43) e o gênero e a unidade de temperatura (DP-95) têm
  entrada própria. **Exceção (2026-11-02, revisão da fase 2)**: o `interval` e o `stepPerHour` do `setWalkReminder`
  nunca rejeitam. Número finito não negativo vale como está (arredondado), texto com um número assim (`"60"`) é lido, e
  qualquer outro valor (`"never"`, `""`, `NaN`, infinito, negativo, outro tipo) vale 0 com um DEBUG; o CRP não grava
  nenhum dos dois (`SettingsMapper.moveReminder`, Repo 1).
- **Motivo**: D7 ("entrada malformada → `INVALID_ARGUMENT`"): o domínio só recebe valores válidos, e a exceção nativa
  do Android vira uma rejeição com `onError`. Conferir também os campos que o CRP ignora é escolha da fatia S5a: os
  tipos do domínio os carregam, e um valor inválido ali indica um payload quebrado.
- **Impacto para o usuário**: com os formatos que o app Condor monta (os dos testes `SettingsMapperTest` e do catálogo
  do app de exemplo), nenhum. Um valor mal formado que a produção aceitava (por exemplo, uma janela do estresse `"8:00"`
  vinda do backend) passa a rejeitar o método inteiro e, no sync de ajustes, vira um evento no Crashlytics. O caso que
  o próprio app Condor produz, o intervalo do sedentarismo como texto, foi afrouxado (a exceção acima): o tipo do app é
  `IntervalInMinutes = number | string` porque o backend guarda o campo como texto
  (`condor:types/app/entities/UserSettings.ts:35-44`; `TechnosMovementReminder.interval: string` no
  `technos-api-frontend-bridge`), o mapper só faz cast (`condor:mappers/entities/movementReminder.ts:16`), um `""`
  sobrevive ao `??` do `setMovementReminderFromUserSettings`
  (`condor:store/MainStoreContext/MovementReminder/useMovementReminderData/index.ts:48-51`, chamado em todo sync
  completo e no primeiro pareamento), e o `calculateStepsByHour` dá `Infinity` com início e fim na mesma hora
  (`:70-78`).
  Com a regra estrita, o liga/desliga do sedentarismo não chegava ao relógio nesses casos.
- **Como corrigir ou voltar**: afrouxar a regra no `SettingsMapper` (Repo 1): não ler os campos que o CRP ignora,
  saturar em vez de rejeitar, ou aceitar `"H:mm"` (o `interval` e o `stepPerHour` do sedentarismo já são lidos assim,
  pelo `lenientCount`).
- **Revisar em**: fase 4 (troca do pacote no app Condor), com os valores que o backend de produção guarda.
- **Status**: aberto.

### DP-97 — Campos ausentes valem um padrão, e booleanos aceitam número, em vez de exceção nativa

- **Produção**: no Android, chave ausente lança exceção: `reminderHour`/`reminderMinute` do ciclo
  (`CRPUserSettingsManager.java:304-305`), `reminderCount` da água (`:193`), `enabled` nulo do não perturbe (`:232`). Um
  número onde o Android espera booleano também lança (`getBoolean`), menos no `enable` do alarme, que aceita `Double`
  (`NativeCoreModule.kt:449-457`); o filtro de notificações compara o texto com `"true"`
  (`TechnosNotificationMappers.kt:12`), então `1` é desligado. Um alarme sem `repeat` dá `NullPointerException` no
  mapeador (`CrpTechnosToSdkMappers.java:31-32`) e rejeita. No iOS, o ausente vale 0 ou `NO` e um número diferente de 0
  é `YES` (`boolValue`); o alarme sem `repeat` vira único (`CRPUserSettings.m:110-130`).
- **Core Next**: ausente ou nulo vale um padrão: `reminderHour`, `reminderMinute` e `lastMenstrualPeriodYear` do ciclo
  → 0 e `reminderCount` da água → 0 (como o iOS); `distance` e `movementTimeInHours` das metas → 0 (o CRP não os
  grava); `hour`/`minute` do alarme → 0 (os padrões do Android, `NativeCoreModule.kt:437-438`); `repeat` do alarme
  ausente → alarme único, com WARN (como o iOS); `interval` do estresse e do sedentarismo e `stepPerHour` → 0 (no
  sedentarismo, também qualquer valor que não seja um número, DP-96); `repeat`
  em objeto ausente → todos os dias (o CRP ignora); booleano ausente → desligado. Booleano como número diferente de 0
  é ligado em todos os dicionários, inclusive no filtro de notificações (`SettingsMapper` e `NotificationKeys`, Repo 1;
  D7).
- **Motivo**: D7 (booleano como `Boolean` ou número; nulo ou ausente = desligado) e paridade com o iOS onde o Android
  lançava exceção.
- **Impacto para o usuário**: nenhum com o que o app Condor manda (ele manda todas essas chaves e booleanos de verdade).
  No Android, um payload sem elas passa a funcionar como no iPhone, em vez de rejeitar ou lançar exceção.
- **Como corrigir ou voltar**: tornar a chave obrigatória no `SettingsMapper` (Repo 1).
- **Revisar em**: fase 4.
- **Status**: aberto.

### DP-99 — Argumento `null` no lugar de mapa, lista ou texto rejeita sem `code` nem `onError` (Android)

- **Produção**: o React Native 0.81.4 (o mesmo do app Condor e do app de exemplo) entrega `null`/`undefined` do JS como
  `null` do Java para parâmetro de mapa, lista ou texto (`JavaTurboModule.cpp:367-370`, em
  `ReactCommon/react/nativemodule/core/platform/android/ReactCommon/`); booleano e número fora do tipo ele mesmo recusa
  na chamada. Uma exceção num método com Promise vira rejeição com um `Error` (`:945-954`); num método `void`, é
  relançada na thread dos módulos nativos (`:836-842`) e derruba o app. No Core, o que acontece depende do método:
  - `setTemperatureUnit` e `setAlarm` têm parâmetro não nulo em Kotlin (`NativeCoreModule.kt:1151, 426`) e
    `setUserInfo`, `setAddressBook` lançam `NullPointerException` logo na leitura (`CRPUserSettingsManager.java:50-57`;
    `CRPPhoneManager.kt:16`): a mesma rejeição com `Error` do Core Next;
  - `setHeartRateAutomaticCheck` aceita `startHour`/`endHour` nulos (`NativeCoreModule.kt:323-334`) e o CRP nem os lê
    (`CRPService.java:871-880`): grava o intervalo e resolve;
  - `syncWeather(null)` é `void` e lança em `weatherList.size()` (`CRPService.java:689-691`): o app cai;
  - os outros dicionários e listas são `ReadableMap?`/`ReadableArray?` no módulo e o resultado com `null` varia por
    método (rejeição `"-1"` antes da leitura quando não há conexão, como no `setDistanceUnit` e no `setWorldClock`,
    `CRPService.java:1020-1024, 1302-1306`; nos demais, a verificar).
- **Core Next**: os 24 métodos da fase 2 do `NativeCoreNextModule.kt` têm parâmetros não nulos, como o spec e os da
  fase 1. Com `null`/`undefined` do JS, a checagem de parâmetro do Kotlin lança `NullPointerException` antes de chamar o
  `CoreBridge`, e o RN rejeita a Promise com um `Error` cuja mensagem é a da exceção: sem `code` de `errorCodes`, sem
  `onError` e sem log do Core Next. Isso vale também para `setHeartRateAutomaticCheck` com uma hora nula e para
  `syncWeather(null)`, que deixa de derrubar o app. No iOS: DP-100.
- **Motivo**: o módulo é uma casca (CLAUDE.md): transformar `null` em `INVALID_ARGUMENT` com `onError` é regra de
  método JS e mora no `CoreBridge`, cuja API (Repo 1) recebe tipos não nulos; o contrato TS também não aceita `null`.
- **Impacto para o usuário**: nenhum com o que o app Condor manda hoje (a chamada da frequência cardíaca confere `!=
  null` antes, `condor:store/MainStoreContext/HeartRateMonitoring/useHeartRateMonitoringData/index.ts:38`, e as
  outras montam objetos e listas). Um `undefined` vindo de um bug do JS vira uma rejeição sem `code` (o `catch` do app
  não reconhece um código e nenhum `onError` sai), em vez do comportamento de produção de cada método.
- **Como corrigir ou voltar**: aceitar nulo no `CoreBridge` (`Map<String, Any?>?`, `List<Any?>?`, `String?`) e rejeitar
  `INVALID_ARGUMENT` com `onError` no `SettingsMapper` (Repo 1, D7), com os parâmetros do módulo anuláveis e repassados
  sem regra; ou tratar no wrapper `src/index.ts`. Voltar ao resultado de produção do `setHeartRateAutomaticCheck` exige
  não validar a janela que o CRP ignora (DP-96).
- **Revisar em**: fase 4 (troca do pacote no app Condor).
- **Status**: aberto.

### DP-100 — Argumento `null` no lugar de mapa, lista ou texto rejeita `INVALID_ARGUMENT` sem `onError` no shim (iOS)

- **Produção**: o React Native 0.81.4 entrega `null`/`undefined` do JS como `nil` para parâmetro de texto, dicionário
  ou lista no iOS (`RCTTurboModule.mm:168-179`, em `ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/`, com
  a flag `enableModuleArgumentNSNullConversionIOS` desligada, o padrão de `ReactNativeFeatureFlagsDefaults.h:138-140`).
  O Core iOS é Objective-C e segue com o `nil`: o `setTemperatureUnit(null)` manda °C e resolve
  (`CRPService.m:1758-1776`), o `syncWeather(null)` não manda nada (`:977-981`, `setTempWeather` sai no `nil`) e o
  `setUserInfo(null)` lê zeros e manda o perfil (`CRPUserSettings.m:26-51`); os outros métodos, a verificar. Nenhum
  derruba o app.
- **Core Next**: o `CoreBridge` do Repo 1 recebe tipos não nulos, e um `nil` passado pelo shim vira um
  `kotlin.NullPointerException` não capturado, que encerra o processo (conferido no simulador em 2026-11-02, com o
  `setTemperatureUnitTemp:` chamado com `nil`). Para não derrubar o app, o `RCTNativeCoreNext.mm` confere cada
  argumento de objeto dos 19 métodos que os têm (os 16 da fase 2 com dicionário, lista ou texto, mais `pairDevice`,
  `startPairingAttempt` e `deletedSavedData`) e, com `nil`, rejeita na hora com `INVALID_ARGUMENT` e a mensagem
  `"<argumento> must not be null"`, sem chamar o `CoreBridge`, sem `onError` e com uma linha INFO no log
  (`RCTNativeCoreNext/<método>`); no `deletedSavedData`, que é `void`, só a linha do log. O
  `setHeartRateAutomaticCheck` com uma hora nula também rejeita. O Android rejeita sem `code` (DP-99).
- **Motivo**: um crash é pior que qualquer resposta, e a regra certa (`INVALID_ARGUMENT` com `onError`) é do
  `CoreBridge`, cuja API não aceita nulo; o shim não emite `onError` por conta própria (o evento e a fila dele são do
  controlador).
- **Impacto para o usuário**: nenhum com o que o app Condor manda hoje (DP-99). Um `undefined` vindo de um bug do JS
  vira uma rejeição com `code` `INVALID_ARGUMENT`, sem `onError`, em vez do comportamento de produção de cada método
  (que seguia com o valor nulo).
- **Como corrigir ou voltar**: o mesmo do DP-99: aceitar nulo no `CoreBridge` (`Map<String, Any?>?`, `List<Any?>?`,
  `String?`) e rejeitar com `onError` no `SettingsMapper`; aí o `CNRejectNil` do shim sai e o `nil` vai ao framework.
- **Revisar em**: fase 4 (troca do pacote no app Condor), junto com o DP-99.
- **Status**: aberto.

## 4. Ajustes

### DP-24 — D8: idade sem o mês deslocado (Android)

- **Produção**: o `getDateOnDay` põe o mês 1-12 do JS no `Calendar`, que conta de 0 a 11 (`DateHelpers.kt:189-194`,
  usado em `CRPUserSettingsManager.java:60-61`): o aniversário fica um mês depois, e no mês seguinte ao aniversário a
  idade do `0x12` sai um ano menor. O iOS calcula certo (`CRPUserSettings.m:26-51`).
- **Core Next**: idade em anos completos pela data local do telefone (`WatchClock`), com o mês 1-12 (D9).
- **Motivo**: D8.
- **Impacto para o usuário**: no Android, no mês seguinte ao aniversário, o relógio recebe a idade certa (um ano a mais
  que na produção).
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-25 — D8: data do alarme único certa na virada do mês (iOS)

- **Produção**: o iOS usa o ano e o mês de hoje com o dia de amanhã (`CRPUserSettings.m:132-143`): às 23:00 de 31/10,
  um alarme único às 07:00 vai com o dia 1 e o mês 10, uma data passada.
- **Core Next**: a data da próxima ocorrência pelo `WatchClock`, como o Android (D9).
- **Motivo**: D8.
- **Impacto para o usuário**: no iPhone, o alarme único criado na virada do mês ou do ano vai com a data certa.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-26 — D8: os 7 dias do alarme como "todo dia" também no iOS

- **Produção**: o iOS manda o tipo semanal sempre que há um dia marcado, inclusive com os 7
  (`CRPUserSettings.m:127-130`); o Android manda "todo dia" (tipo 1, máscara `7F`) para os 7 dias.
- **Core Next**: 7 dias = tipo 1 com `7F` nas duas plataformas (D9).
- **Motivo**: D8.
- **Impacto para o usuário**: os dois tocam todos os dias; o que muda é como o relógio mostra o alarme (a verificar
  na tela do P85).
- **Como corrigir ou voltar**: tipo 2 com `7F` no `CrpMessagePayloads.alarm` (Repo 1).
- **Revisar em**: validação da fase 2 (o `B9 05` nunca foi visto no ar).
- **Status**: pendente de validação no relógio.

### DP-27 — D8: intervalo de frequência cardíaca abaixo de 5 min

- **Produção**: o Android manda `intervalo / 5` (`CRPService.java:872-877`); abaixo de 5 dá 0, a SDK não manda nada
  (`sdk:h/a.java:673-677`) e a Promise resolve. O iOS manda 0 (`CRPService.m:842-848`), que desliga a medição.
- **Core Next**: ligado, n = clamp(round(intervalo / 5), 1, 255), com WARN abaixo de 5 min (D9).
- **Motivo**: D8.
- **Impacto para o usuário**: um intervalo abaixo de 5 min liga a medição a cada 5 min (antes: nada no Android,
  desligado no iPhone).
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-28 — D8: valores acima de 255 saturam em vez de truncar

- **Produção**: a SDK Android monta o `0x12` com cast para byte (`sdk:f/x1.java:9-27`): um peso de 300 kg vira 44. O
  iOS satura em `FF` (`iOS-bin@0x600e4-0x60248`, a verificar).
- **Core Next**: altura, peso e idade arredondados e saturados em 0-255 (D9); valores fora da faixa nos outros ajustes
  rejeitam `INVALID_ARGUMENT` (por exemplo, o tempo de tela fora de 1..255).
- **Motivo**: D8.
- **Impacto para o usuário**: só com valores fora da faixa: o relógio recebe 255, não um valor truncado.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-29 — Números fracionários arredondados, não truncados

- **Produção**: o Android lê com `getInt` ou `toInt()` e o iOS com `intValue`, que truncam: metas
  (`CRPUserSettingsManager.java:177-179`; `CRPUserSettings.m:95-97`), tempo de tela (`NativeCoreModule.kt:960`) e o
  intervalo de frequência cardíaca (`intervalo / 5` inteiro, `CRPService.java:874`).
- **Core Next**: arredonda (meio para cima), menos as coordenadas do relógio mundial (D7, D9).
- **Motivo**: D7.
- **Impacto para o usuário**: um intervalo de 8 min mede a cada 10 min (antes, 5); metas com fração de 0,5 ou mais
  sobem 1. Se o Condor manda valores fracionários ou intervalos fora dos múltiplos de 5: a verificar no app.
- **Como corrigir ou voltar**: truncar no `SettingsMapper`.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-30 — Metas sem a tag 03 também no iOS

- **Produção**: o iOS manda a meta de distância como `INT_MAX` (`CRPUserSettings.m:98`), que o binário grava na tag 03
  do `B9` (`iOS-bin@0x65a00-0x65bcc`, a verificar); o Android manda sem a tag 03 (`pair-sync@7276`, `@76085`).
- **Core Next**: o layout do Android nas duas plataformas (D9).
- **Motivo**: D9 (o layout que a captura prova).
- **Impacto para o usuário**: no iPhone, o relógio deixa de receber a meta de distância "infinita"; o efeito na tela
  é conferido na validação.
- **Como corrigir ou voltar**: mandar a tag 03 com `7F FF FF FF` quando o host for iOS (o protocolo não sabe a
  plataforma; seria um parâmetro do domínio).
- **Revisar em**: validação da fase 2 no iPhone.
- **Status**: pendente de validação no relógio.

### DP-31 — `setTemperatureUnit` espera o `8C`

- **Produção**: o Android manda `7C` e `8C` e resolve sem esperar (`CRPUserSettingsManager.java:396-405`); o iOS manda
  a unidade, reenvia o clima e resolve (`CRPService.m:1758-1775`).
- **Core Next**: espera o `8C`; unidade diferente da pedida → `PROTOCOL`; sem resposta em 4 s → `TIMEOUT` (D4(b)).
- **Motivo**: D4 (o P85 sempre respondeu: `pair-sync@76536→@76894`).
- **Impacto para o usuário**: um firmware que não responda passa a rejeitar (e gera um evento no Crashlytics do
  Condor), onde a produção resolvia.
- **Como corrigir ou voltar**: tornar o `8C` resposta opcional, como no clima (D4(e)).
- **Revisar em**: quando entrar outro firmware ou modelo CRP.
- **Status**: aceito pelo usuário até revisão.

### DP-32 — Economia de bateria espera o eco `A4`

- **Produção**: o Core manda o `94` e resolve (`CRPUserSettingsManager.java:351-354`; `CRPUserSettings.m:413-416`); o
  Android nem registra o listener do `A4` (nenhum `setBatterySavingListener` no `CRPService.java`).
- **Core Next**: espera o eco `A4`; estado diferente → `PROTOCOL`; sem eco em 4 s → `TIMEOUT` (D4(b)).
- **Motivo**: D4.
- **Impacto para o usuário**: um relógio que não ecoe passa a rejeitar. Só o eco ao desligar foi visto
  (`pair-sync@80907`); o eco ao ligar é suposição.
- **Como corrigir ou voltar**: tornar o `A4` resposta opcional.
- **Revisar em**: validação da fase 2.
- **Status**: pendente de validação no relógio.

### DP-33 — Estresse automático confirmado também no iOS, em 4 s

- **Produção**: o Android espera o `B9 11 01` pela fila do Core, com 5 s (`CRPUserSettingsManager.java:152-170`;
  `CRPQueueManager.kt:14, 22-32`); o iOS manda e resolve (`CRPUserSettings.m:211-218`).
- **Core Next**: espera o `B9 11 01` com 4 s nas duas plataformas, casando 2 bytes (D4(b)).
- **Motivo**: D4 (o P85 sempre respondeu: `pair-sync@79282→@79332`).
- **Impacto para o usuário**: no iPhone, um relógio que não confirme passa a rejeitar; o estresse sai em todo sync,
  inclusive o parcial (`condor:` `useUserSettingsSyncHandler.ts:72-81`).
- **Como corrigir ou voltar**: resposta opcional no iOS (o protocolo não sabe a plataforma; seria um parâmetro).
- **Revisar em**: validação da fase 2 no iPhone.
- **Status**: aceito pelo usuário até revisão.

### DP-34 — D8: sem a flag global do estresse

- **Produção**: um único `latestStressAutomaticCheckEnabled` (`CRPUserSettingsManager.java:153-154`): duas chamadas em
  voo comparam a resposta com o valor da última.
- **Core Next**: cada pedido compara com o próprio valor, um pedido por vez (D8).
- **Motivo**: D8.
- **Impacto para o usuário**: nenhum visível; uma chamada não rejeita por causa da outra.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 3 (estresse).
- **Status**: aceito pelo usuário até revisão.

### DP-35 — D8: um `B9 11 01` não pedido não resolve a Promise

- **Produção**: qualquer `onTimingStressStateChange` liquida o pedido da fila (`CRPService.java:1896-1898`;
  `CRPUserSettingsManager.java:165-170`).
- **Core Next**: só a resposta do pedido registrado casa; um `B9 11 01` avulso vai para o log, e `B9 11 00 FF` e
  `B9 11 03` nunca casam (D8).
- **Motivo**: D8.
- **Impacto para o usuário**: nenhum visível.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 3 (estresse).
- **Status**: aceito pelo usuário até revisão.

### DP-36 — Gesto sem a conferência `28`/`82` (Android)

- **Produção**: o Android manda `18` e `72`, consulta `28` e `82` e compara, sem prazo
  (`CRPUserSettingsManager.java:316-344`); o iOS manda e resolve (`CRPUserSettings.m:293-314`).
- **Core Next**: só as duas escritas; resolve depois de 2 × 200 ms (D4(c)). As outras consultas de leitura de volta da
  linha de corte (e) também não saem, mas essas a produção também não manda (as consultas do `CRPService.java` e do
  `CRPUserSettingsManager.java` são só as de passos, bateria, firmware, históricos, gesto, sedentarismo, relógio
  mundial, unidade de temperatura e estresse).
- **Motivo**: D4(c) (`28`/`82` nunca vistos no P85; a captura não tinha o gesto).
- **Impacto para o usuário**: no Android, um relógio que não aplique o gesto não é mais detectado (antes rejeitava ou
  travava o sync sem resposta).
- **Como corrigir ou voltar**: mandar as consultas como respostas opcionais, se a validação mostrar que o P85 responde.
- **Revisar em**: validação da fase 2.
- **Status**: pendente de validação no relógio.

### DP-37 — Unidade de distância desconhecida rejeita

- **Produção**: o Android usa métrico se o valor contém "km" e imperial para qualquer outro, inclusive nulo
  (`CRPUserSettingsManager.java:133-141`); o iOS usa imperial se contém "miles" e métrico para o resto
  (`CRPUserSettings.m:71-77`).
- **Core Next**: sem diferenciar maiúsculas e sem espaços nas pontas: "km" → métrico; "mi", "mile", "miles" →
  imperial; outro valor → `INVALID_ARGUMENT` (especificação, `setDistanceUnit`).
- **Motivo**: D7 (os dois Cores divergem numa string desconhecida).
- **Impacto para o usuário**: nenhum com "km" e "miles"; um valor inesperado rejeita em vez de cair num padrão que
  muda com a plataforma.
- **Como corrigir ou voltar**: um padrão no `SettingsMapper`.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-38 — Lembretes do ciclo menstrual = `reminder`, ou `enabled` sem ele

- **Produção**: o Android liga os três lembretes com `enabled || reminder` (`CRPUserSettingsManager.java:288-309`); o
  iOS só com `reminder` (`CRPUserSettings.m:260-268`).
- **Core Next**: lembretes = `reminder ?? enabled` (especificação, `setMenstrual`).
- **Motivo**: D7 (paridade com o iOS quando `reminder` vem).
- **Impacto para o usuário**: no Android, `enabled: true` com `reminder: false` deixa os lembretes desligados (antes,
  ligados).
- **Como corrigir ou voltar**: `enabled || reminder` no `SettingsMapper`.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-39 — Não perturbe respeita o `alwaysOn`

- **Produção**: os dois Cores ignoram o `alwaysOn` e mandam 00:00 em cada hora vazia ou com `enabled` falso
  (`CRPUserSettingsManager.java:228-250`; `CRPUserSettings.m:188-209`); no Android, um `enabled` nulo lança exceção
  (`getBoolean`, `:232`).
- **Core Next**: a mesma regra para horas vazias e `enabled` falso ou nulo; só `alwaysOn: true` explícito manda
  00:00-23:59; ligado com início igual ao fim gera WARN (D9).
- **Motivo**: D9.
- **Impacto para o usuário**: um `alwaysOn: true` silencia o dia inteiro (antes, 00:00-00:00, que o relógio lê como
  desligado).
- **Como corrigir ou voltar**: ignorar o `alwaysOn` no `SettingsMapper`.
- **Revisar em**: validação da fase 2.
- **Status**: pendente de validação no relógio.

### DP-40 — D8: coordenadas do relógio mundial certas

- **Produção**: o Android lê latitude e longitude com `getInt`, em graus inteiros
  (`CRPUserSettingsManager.java:270-271`); o iOS passa a latitude no campo da longitude e vice-versa
  (`CRPUserSettings.m:240`).
- **Core Next**: graus × 1e6 truncados em direção a zero, como o cast `(long)` da SDK (`sdk:f/n2.java:53, 57`), cada
  um no seu campo (D9).
- **Motivo**: D8.
- **Impacto para o usuário**: o relógio recebe as coordenadas certas das cidades (o que ele faz com elas: a verificar
  na tela).
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-41 — D8: lista vazia limpa o relógio mundial (Android)

- **Produção**: o Android chama `resetWorldClockList(new byte[]{})` (`CRPUserSettingsManager.java:258`), que a SDK
  descarta porque o array é vazio (`sdk:f/n2.java:81-84`): as cidades antigas ficam no relógio e uma lista vazia não
  limpa nada.
- **Core Next**: lê os ids com `BB 00 00` e apaga cada um com `BB 00 03 id` antes de gravar as novas (D9).
- **Motivo**: D8.
- **Impacto para o usuário**: tirar cidades no app passa a tirá-las do relógio.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2 (`BB 00 03` nunca visto no ar).
- **Status**: pendente de validação no relógio.

### DP-42 — Relógio mundial no iOS: apagar por `BB 00 03`, `jetLag` e conferência

- **Produção**: o iOS limpa tudo com `setClearWorldClock` (`CRPUserSettings.m:230`; o `BB 00 05` de
  `iOS-bin@0x1c6730`, a verificar), que a SDK Android não tem, e o modelo dele não tem `jetLag` (`iOS-h:3534-3552`, a
  verificar). Nenhum dos dois Cores relê a lista depois de gravar.
- **Core Next**: apaga por id com `BB 00 03` (o sub das duas SDKs), manda `jetLag` = fuso − offset atual do telefone
  (sinal do Android) e relê com `BB 00 00` quando gravou ou apagou algo (diferença só gera WARN) (D9).
- **Motivo**: D9.
- **Impacto para o usuário**: no iPhone, o relógio passa a receber o `jetLag`; nas duas plataformas, cerca de 850 ms a
  mais quando a lista muda.
- **Como corrigir ou voltar**: `BB 00 05` no iOS, se o `BB 00 03` não funcionar no P85; tirar a conferência.
- **Revisar em**: validação da fase 2.
- **Status**: pendente de validação no relógio.

### DP-43 — D8: cidade com nome vazio rejeita em vez de ser pulada

- **Produção**: no Android, uma cidade com nome vazio vira um frame nulo, pulado sem aviso (`sdk:f/n2.java:40-41`), e
  as outras vão.
- **Core Next**: nome vazio → `INVALID_ARGUMENT` e nada é enviado (especificação, `setWorldClock`).
- **Motivo**: D8.
- **Impacto para o usuário**: uma lista com uma cidade sem nome não grava nenhuma cidade (antes, gravava as outras).
- **Como corrigir ou voltar**: pular com WARN no `SettingsMapper`, como a produção.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-83 — Unidade de temperatura da conexão vem de qualquer `8C` válido

- **Produção**: o Core Android trata todo RX `8C` como troca de unidade e reenvia o clima guardado, convertendo
  (`onTempUnitChange`, `CRPService.java:1369-1415`); a unidade só fica no `weatherTempType` do clima. O iOS não lê o
  `8C`: manda a unidade e reenvia o clima (`CRPService.m:1758-1775`).
- **Core Next**: a última unidade confirmada da conexão (o `CrpTemperatureUnit` do Repo 1, que o clima usa quando o
  `8C` dele não responde, D4(e)) é a de qualquer `8C` válido: a resposta do `setTemperatureUnit`, inclusive quando
  difere da pedida (o pedido rejeita com `PROTOCOL`, DP-31), e um `8C` que chegue sem pedido ou depois do prazo
  (`CrpSettingsWriter.onUnsolicited`). Nada é reenviado por causa dele (DP-54).
- **Motivo**: escolha da fatia S2 para o D10 e o D16, que falam da "última unidade confirmada na conexão" sem dizer o
  que conta como confirmação: vale o que o relógio diz que mostra.
- **Impacto para o usuário**: só quando o `8C` do clima não responde: o clima sai na unidade que o relógio informou por
  último na conexão, em vez de °C.
- **Como corrigir ou voltar**: aceitar só a resposta casada do `setTemperatureUnit` igual à pedida, no
  `CrpSettingsWriter`.
- **Revisar em**: validação da fase 2 (se o P85 manda `8C` sem pedido quando a unidade muda no próprio relógio).
- **Status**: aberto.

### DP-84 — Ciclo menstrual: dia e mês como vieram, sem a normalização do `Calendar` (Android)

- **Produção**: o Android monta a data num `Calendar` leniente (`CRPUserSettingsManager.java:295-299`) e a SDK lê o mês
  e o dia de volta (`sdk:f/d1.java:31-36`): uma data inexistente é normalizada (29/02/2027 vai como 01/03; 31/04, como
  01/05). O iOS repassa o dia e o mês como vieram (`CRPUserSettings.m:273-274`).
- **Core Next**: o dia e o mês vão como vieram nas duas plataformas, saturados em 1..31 e 0..11
  (`CrpSettingsPayloads.menstrualCycle`, Repo 1); o ano não vai ao fio.
- **Motivo**: é o que o iOS de produção já faz, e normalizar dependeria de um ano que o relógio não recebe.
- **Impacto para o usuário**: só com uma data inexistente vinda do app: o relógio recebe o dia como veio (o efeito na
  tela não se sabe).
- **Como corrigir ou voltar**: recusar a data inexistente com `INVALID_ARGUMENT` no `SettingsMapper`, ou normalizar
  pelo ano no `CrpSettingsPayloads`.
- **Revisar em**: fase 4.
- **Status**: aberto.

### DP-85 — Alarme único depois de 2030 recusa com `PROTOCOL`; hora e minuto saturam

- **Produção**: os dois Cores mandam o alarme único com a data da próxima ocorrência, e a SDK Android grava
  `(ano − 2015) << 12` num u16 sem conferir a faixa (`sdk:f/e.java:40-44`; `sdk:g1/d.java:42-44`): a partir de 2031,
  o ano estoura os 4 bits e o relógio leria uma data de 2015 (o iOS faz a mesma conta, `iOS-bin@0xfd0d4`, a
  verificar). Hora e minuto vão com cast para byte, sem conferir a faixa (`sdk:f/e.java:58-59`).
- **Core Next**: a data do alarme único fora de 2015..2030 rejeita o `setAlarm` com `PROTOCOL` antes de qualquer
  escrita (nada é apagado); hora fora de 0..23 e minuto fora de 0..59 saturam, com WARN (`CrpMessagePayloads.alarm`,
  Repo 1; D9).
- **Motivo**: D9 ("ano acima de 2030 → PROTOCOL"); a saturação é a defesa do driver para um host que chame a
  `WatchSession` direto (o `:bridge` confere as faixas antes).
- **Impacto para o usuário**: nenhum até 31/12/2030; depois, um alarme único falha (e o sync registra a rejeição) em
  vez de ir com a data errada.
- **Como corrigir ou voltar**: antes de 2031, descobrir na SDK do fornecedor (ou no relógio) outro formato de data;
  voltar à produção seria mandar o ano estourado.
- **Revisar em**: antes de 2030-12, ou numa atualização da SDK do fornecedor.
- **Status**: aceito pelo usuário até revisão.

### DP-86 — Relógio mundial e clima: corte em caractere inteiro e temperatura saturada

- **Produção**: a SDK Android corta o nome da cidade do relógio mundial (40 bytes UTF-8, `sdk:f/n2.java:43`) e a
  cidade do clima (4 caracteres UTF-16 no `43` e 25 bytes UTF-8 no `B5`, `sdk:f/a2.java:53, 107`) pela unidade UTF-16
  (`sdk:g1/d.java:181-195`), o que pode partir um emoji ao meio; as temperaturas do `43`, do `B5` e do `42` vão com
  cast para byte (`sdk:f/a2.java:38-42, 63, 142-143`), que dá a volta acima de 127. No iOS: a verificar.
- **Core Next**: corte em caractere inteiro (nunca parte um par substituto nem uma sequência UTF-8) e temperatura
  saturada em −128..127, com WARN; a conversão de °C para °F é um arredondamento só, metade para cima, do valor em °C
  (`CrpMessagePayloads`, Repo 1; D9, D10).
- **Motivo**: D9 (texto em caractere inteiro, como nos contatos, DP-51) e a regra de saturação do D8 (DP-28).
- **Impacto para o usuário**: só com um nome de cidade que tenha emoji no limite do corte (o relógio não recebe meio
  caractere) e com temperaturas acima de 53 °C em °F.
- **Como corrigir ou voltar**: as regras ficam no `CrpMessagePayloads` (Repo 1).
- **Revisar em**: validação da fase 2 (como o P85 mostra um nome no limite).
- **Status**: aceito pelo usuário até revisão.

### DP-95 — Gênero e unidade de temperatura sem diferenciar maiúsculas; string desconhecida rejeita

- **Produção**: gênero: o Android usa masculino quando o texto contém `"m"` (`CRPUserSettingsManager.java:57-58`): `"M"`
  vira feminino, `"female"` e `"feminino"` viram masculino, e nulo lança `NullPointerException` (`requireNonNull`); o
  iOS só usa masculino com `"m"` exato (`CRPUserSettings.m:29`). Os dois mandam feminino para todo o resto, inclusive
  `"o"` e o vazio. Unidade de temperatura: o Android usa °F só com `"f"` (sem diferenciar maiúsculas) e °C para todo o
  resto (`CRPUserSettingsManager.java:396-399`); o iOS usa °F quando o texto contém `"f"` minúsculo
  (`CRPService.m:1767`), então `"F"` vira °C e `"fahrenheit"` vira °F.
- **Core Next**: sem diferenciar maiúsculas e sem os espaços das pontas. Gênero `"m"` → masculino, `"f"` → feminino,
  `"o"` → outro (feminino no fio, como os dois Cores); vazio, nulo ou ausente → outro, com WARN (o mesmo byte da
  produção); outra string → `INVALID_ARGUMENT`. Temperatura `"c"`/`"celsius"` → °C e `"f"`/`"fahrenheit"` → °F; outra
  string → `INVALID_ARGUMENT` (`SettingsMapper.userProfile` e `temperatureUnit`, Repo 1; ADR 38).
- **Motivo**: D7 (os dois Cores divergem nas strings desconhecidas; o mesmo critério da unidade de distância, DP-37).
- **Impacto para o usuário**: nenhum com o que o app Condor manda (`"m"`, `"f"`, `"o"` ou vazio, e `"c"`/`"f"`). Um
  valor inesperado rejeita (no sync, um evento no Crashlytics) em vez de cair num padrão que muda com a plataforma.
- **Como corrigir ou voltar**: um padrão no `SettingsMapper` (Repo 1), por exemplo a regra do Android.
- **Revisar em**: fase 4.
- **Status**: aberto.

## 5. Mensagens

### DP-44 — Sem encaminhamento de notificações no Android

- **Produção**: o `NotificationListener` (`AndroidManifest.xml:211-220`) lê as notificações do telefone, filtra pelo
  que o usuário ligou (`TechnosSbNotification.kt:157-187`; filtro em `user_prefs`/`notification_option`,
  `UserNotificationConfigRepository.kt:10, 36`) e manda ao relógio pelo `0x41` (`CRPService.java:737-760`).
- **Core Next**: nada na fase 2 (linha de corte (a)). O filtro vai ao relógio (DP-46).
- **Motivo**: decisão do usuário 1: fatia própria, depois da fase 2, até 2026-11-05.
- **Impacto para o usuário**: até a fatia entrar, o Condor Android com o Core trocado não mostra notificações no
  relógio.
- **Como corrigir ou voltar**: a fatia de encaminhamento: `NotificationListenerService`, tabela pacote → app,
  deduplicação, migração do `user_prefs`/`notification_option` e o `ComponentName` (DP-74).
- **Revisar em**: fatia de encaminhamento de notificações.
- **Status**: aceito pelo usuário até revisão.

### DP-45 — `checkIsNotificationServiceEnabled` resolve `true` no Android

- **Produção**: confere se há algum listener do pacote aprovado (`SDKUtils.java:61-78`); o Condor usa no banner da
  Home e na tela de acesso do primeiro pareamento, e no iOS devolve `false` sem chamar o Core
  (`condor:services/Smartwatch.ts:252-256`).
- **Core Next**: resolve `true` no Android enquanto não houver listener e nunca rejeita (D18).
- **Motivo**: decisão do usuário 1 e D18: `false` pediria uma permissão que o app sem listener não consegue receber.
- **Impacto para o usuário**: o app não pede o acesso às notificações, e o usuário não é avisado de que elas não chegam
  ao relógio.
- **Como corrigir ou voltar**: com a fatia de encaminhamento, conferir o `ComponentName` do listener novo (não só o
  pacote, como o `SDKUtils.java:72`).
- **Revisar em**: fatia de encaminhamento de notificações.
- **Status**: aceito pelo usuário até revisão.

### DP-46 — Filtro de notificações vai ao relógio também no Android

- **Produção**: no Android, o `manageNotifications` só grava o filtro nas preferências e resolve, sem falar com o
  relógio (`CRPService.java:903-929`).
- **Core Next**: `B9 14 00` uma vez por conexão e `B9 04` com uma flag por código, nas duas plataformas (D13); sem
  resposta ao `B9 14 00`, WARN, sem `B9 04`, e resolve (D4(e)).
- **Motivo**: D13 (o protocolo não sabe a plataforma do host; o filtro no relógio não atrapalha um encaminhamento
  futuro).
- **Impacto para o usuário**: no Android, sem efeito visível até haver encaminhamento; até 4 s a mais no primeiro sync
  completo da conexão se o relógio não responder.
- **Como corrigir ou voltar**: um parâmetro do domínio para não mandar no Android.
- **Revisar em**: validação da fase 2 (`B9 14`/`B9 04` nunca vistos no ar).
- **Status**: pendente de validação no relógio.

### DP-47 — Filtro no iOS: chaves normalizadas e silêncio que não rejeita

- **Produção**: o iOS confere chaves fixas, com maiúsculas exatas (`CRPService.m:549-617`), liga sempre o código do
  próprio app (`:619`) e rejeita `"-1"` se a SDK devolver erro na consulta dos tipos (`:621-625`).
- **Core Next**: chaves sem diferenciar maiúsculas e sem espaços nas pontas (`NotificationKeys`, D13), chave
  desconhecida ignorada com WARN, o código do próprio app sempre ligado (igual), e sem resposta ao `B9 14 00` em 4 s,
  WARN e resolve sem `B9 04` (D4(e)).
- **Motivo**: D13 e D4(e).
- **Impacto para o usuário**: um relógio que não responda fica com o filtro anterior sem que o app saiba (antes,
  rejeição e evento no Crashlytics).
- **Como corrigir ou voltar**: rejeitar `TIMEOUT` no `B9 14 00` (D4(b) em vez de D4(e)).
- **Revisar em**: validação da fase 2 no iPhone.
- **Status**: pendente de validação no relógio.

### DP-48 — D8: 'Youtube Music' e 'Email' ligam no iOS

- **Produção**: a lista do Condor Reebok no iOS tem 'Youtube Music' e 'Email' (`CondorReebokNotificationTypes.m:32,
  41`), mas o `manageNotifications` confere 'YouTube Music' (`CRPService.m:591`) e nunca 'Email': os dois nunca ligam
  no relógio.
- **Core Next**: 'YouTube Music' → `YOUTUBE_MUSIC` (`0x20`) e 'Email' ou 'Mail' → `MAIL` (`0x32`), sem diferenciar
  maiúsculas (D13).
- **Motivo**: D8.
- **Impacto para o usuário**: no iPhone, quem ligou YouTube Music ou Email passa a ver essas notificações no relógio.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2 no iPhone.
- **Status**: aceito pelo usuário até revisão.

### DP-49 — D8: CALENDAR ganha código no iOS

- **Produção**: a chave fixa 'CALENDAR' do Condor (`condor:constants/notifications.ts:10`) não tem código no iOS (só
  'Google Calendar', `CRPService.m:583-584`).
- **Core Next**: CALENDAR → `DEFAULT_CALENDAR` (`0x39`) + `GOOGLE_CALENDAR` (`0x12`) (D13).
- **Motivo**: D8.
- **Impacto para o usuário**: no iPhone, ligar Calendário no app passa a ligar o calendário no relógio.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2 no iPhone.
- **Status**: aceito pelo usuário até revisão.

### DP-50 — Ligações só pelo HFP, sem a notificação de ligação pelo `0x41`

- **Produção**: no Android, numa ligação, o Core manda o `0x41` tipo ligação com o nome (`CallManager.java:56-70` →
  `CRPService.java:737-760`) e, ao desligar, `41 FF` (`CallManager.java:124-133` → `CRPService.java:1172-1175`), com
  `READ_PHONE_STATE` e `READ_CALL_LOG` (`AndroidManifest.xml:116, 119`). O P85 também toca pelo HFP do vínculo
  clássico (ADR 30).
- **Core Next**: só o HFP; nenhum `0x41` na fase 2 (linha de corte (b)).
- **Motivo**: decisão do usuário 4 (o `0x41` junto com o HFP pode tocar duas vezes).
- **Impacto para o usuário**: no Android, a ligação chega ao relógio só pelo Bluetooth clássico; o que ele mostra por
  ali (nome, número) não foi validado.
- **Como corrigir ou voltar**: o codec `0x41`/`41 FF` e o porte do `CallManager` com `READ_PHONE_STATE`.
- **Revisar em**: validação da fase 2 (ligação real no P85) e quando o Force entrar (DP-75).
- **Status**: aceito pelo usuário até revisão.

### DP-51 — Contatos: o '+', a largura do nome, o avatar e o emoji

- **Produção**: o Android mantém o '+' (`CRPPhoneManager.kt:30`), não consulta o perfil `F2 00`, usa o nome de 20
  bytes da SDK (`sdk:ble/conn/bean/CRPContactInfo.java:11`) e avatar 0 (`CRPPhoneManager.kt:32`); a SDK troca emoji
  conhecido por "[emoji]" (`sdk:f/f1.java:47` → `sdk:g1/h.java:91`). O iOS tira o '+' (`CRPPhoneManager.m:33`) e
  monta o nome e o avatar pelo perfil (`:40-42`).
- **Core Next**: mantém o '+'; largura do nome = max(perfil `F2 00`, 20), com teto 64; avatar `00 00`; nome UTF-8 cru,
  cortado em caractere inteiro, sem a troca de emoji (D9).
- **Motivo**: D9.
- **Impacto para o usuário**: no iPhone, o número vai com '+' (se o P85 aceita, a validação confere na tela do relógio;
  o botão do `F2 05` não entrou no app de exemplo, [`pendencias.md`](pendencias.md)); no Android, nomes de mais de 20
  bytes cabem se o relógio informar mais; emoji vai cru.
- **Como corrigir ou voltar**: as escolhas ficam no `CrpMessagesWriter`.
- **Revisar em**: validação da fase 2.
- **Status**: pendente de validação no relógio.

### DP-52 — D8: ids de contato sem buracos

- **Produção**: os dois Cores usam o índice original da lista como id, e um contato sem número deixa um buraco
  (`CRPPhoneManager.kt:23-32`; `CRPPhoneManager.m:27-35`).
- **Core Next**: ids 0..N−1 sem buracos (especificação, `setAddressBook`).
- **Motivo**: D8.
- **Impacto para o usuário**: nenhum visível esperado.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-53 — D8: confirmação de cada contato pelo id

- **Produção**: o Android conta N + 1 respostas (uma do apagar) sem olhar o id, com um listener novo a cada chamada e
  sem prazo (`CRPPhoneManager.kt:36-64`); o iOS resolve sem esperar confirmação (`CRPPhoneManager.m:40-44`).
- **Core Next**: ack opcional do `F2 EF` (1 s); um `F2 FE [id][status]` por contato, casado pelo id, com 4 s cada;
  status diferente de `00` → `PROTOCOL`; ack ausente → WARN e para de esperar os seguintes (D4(e)).
- **Motivo**: D8.
- **Impacto para o usuário**: um contato recusado pelo relógio rejeita com o id; um relógio que não confirme não trava
  a Promise (no Android, travava). Risco que a produção Android não tem (ela espera as N + 1 respostas sem prazo): um
  ack do apagar que chegue depois de 1 s tem os mesmos bytes do ack do contato 0 (`F2 FE 00 00`) e é tomado por ele;
  o ack de verdade do contato 0 vai só para o log, e uma falha dele não rejeita (`docs/protocolo-crp.md` do Repo 1,
  seção 6.2).
- **Como corrigir ou voltar**: não há o que voltar. Se a validação mostrar o ack do `F2 EF` perto de 1 s ou depois,
  alongar a janela do apagar no `CrpMessagesWriter` (`CLEAR_ACK_MS`, Repo 1).
- **Revisar em**: validação da fase 2 (os acks `F2` nunca foram vistos no ar; medir se o P85 confirma o `F2 EF`, com
  que id e em quanto tempo).
- **Status**: pendente de validação no relógio.

### DP-54 — D8: clima sem o truque `unit = 2` e sem reenvio a cada `8C`

- **Produção**: o Android guarda o clima e a unidade em dois estados e converte com o truque "unit = 2 para não
  converter" (`CRPService.java:1362-1416`, `:1375-1378`), o que pode converter duas vezes; qualquer `8C` recebido
  reenvia o clima, inclusive o do `setTemperatureUnit` e o do próprio `syncWeather` (`:689-699`). O iOS repete o truque
  (`CRPService.m:1777-1834`, a verificar).
- **Core Next**: o `CoreBridge` guarda o último clima não vazio em °C; o driver consulta o `8C` a cada envio (resposta
  opcional) e converte para °F só no envio; o reenvio sai só depois de um `setTemperatureUnit` que resolveu (D10).
- **Motivo**: D8 e D10.
- **Impacto para o usuário**: a temperatura no relógio não sai convertida duas vezes; um `8C` avulso não reenvia o
  clima.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-55 — D8: nascer e pôr do sol sem o parse estrito

- **Produção**: o Android lê `sunrise` e `sunset` só no formato `yyyy-MM-dd'T'HH:mm:ssZZZZZ` (`DateHelpers.kt:21,
  335-337`); qualquer outro cai no `catch` e o clima inteiro não sai (`CRPUserSettingsManager.java:356-394`).
- **Core Next**: pega o `hh:mm` depois do 'T' (`WeatherMapper`, especificação).
- **Motivo**: D8.
- **Impacto para o usuário**: um formato de hora diferente não derruba mais o clima.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: fase 4 (com o `getCurrentGeolocation`, DP-68).
- **Status**: aceito pelo usuário até revisão.

### DP-56 — Clima no iOS: `B5`, 7 dias, ícones do Android e cache mantido

- **Produção**: no Reebok, o iOS manda só o `43` antigo (sem nascer e pôr do sol) e a previsão com todos os itens
  (`CRPUserSettings.m:316-357`; o `B5` é só do Condor Smart 1); os ícones caem em nublado por padrão, e o código 31
  também (`:359-394`); o `syncWeather([])` troca o cache por uma lista vazia (`CRPService.m:977-982`). O Android manda
  `43` e `B5` (a SDK, `sdk:h/a.java:435-440`), a previsão com os 7 primeiros itens (`CRPUserSettingsManager.java:379`)
  e ícones com sol por padrão e 31 como neblina (`:427-459`; `WeatherAPIV3.java:8-21`).
- **Core Next**: `43`, `B5 00` e `42` com 7 dias contando hoje e a tabela do Android, nas duas plataformas; o
  `syncWeather([])` resolve sem enviar e sem apagar o cache (D9, D10).
- **Motivo**: D9 (o Android é o que a captura mostra no ar).
- **Impacto para o usuário**: no iPhone, o relógio passa a receber o `B5` (com nascer e pôr do sol) e no máximo 7
  dias, e um ícone fora da tabela vira sol em vez de nublado.
- **Como corrigir ou voltar**: as escolhas ficam no `CrpMessagesWriter` e no `WeatherMapper`.
- **Revisar em**: validação da fase 2 (se a tela do P85 usa o `43` ou o `B5`).
- **Status**: pendente de validação no relógio.

### DP-87 — Filtro: a lista do relógio (e a falta dela) vale a conexão inteira

- **Produção**: o iOS consulta os tipos suportados (`getNotificationSupportType`, o `B9 14 00`) a cada
  `manageNotifications`, sem prazo (`CRPService.m:621-639`): uma resposta que chegue tarde ainda é usada, sem resposta
  a Promise fica pendurada, e com a lista vazia ele chama `setNotificationState` sem nenhuma flag. O Android não fala
  com o relógio (DP-46).
- **Core Next**: o `B9 14 00` sai uma vez por conexão; a lista, ou a falta de resposta em 4 s, vale até a próxima
  conexão: as chamadas seguintes não consultam de novo e, sem lista, resolvem com WARN sem `B9 04`. Uma resposta
  atrasada vai só para o log. Com a lista vazia, WARN e nenhum `B9 04` (`CrpMessagesWriter`, Repo 1; D4(e), D13).
- **Motivo**: D4(e) e D13 (uma consulta nunca vista no ar não pode custar 4 s a cada chamada).
- **Impacto para o usuário**: se o relógio não responder à primeira consulta da conexão, mudar as notificações no app
  não muda o relógio até a próxima conexão, sem erro.
- **Como corrigir ou voltar**: consultar de novo a cada chamada no `CrpMessagesWriter` (até 4 s a mais por chamada
  quando o relógio não responde).
- **Revisar em**: validação da fase 2 (se o P85 responde ao `B9 14 00`).
- **Status**: pendente de validação no relógio.

### DP-88 — Contatos: limite do `F2 00`, perfil uma vez por conexão e só o '+' inicial

- **Produção**: o Android não consulta o perfil e manda todos os contatos da lista (o Condor manda no máximo 8,
  `condor:screensV2/contacts/ContactsOnTheWatch/constants.ts:11-14`); pula só o número vazio antes da limpeza e tira
  tudo que não é dígito nem '+', em qualquer posição (`CRPPhoneManager.kt:27-30`), então um número sem dígito vai
  vazio. O iOS consulta o perfil a cada chamada (`CRPPhoneManager.m:40-44`; se a SDK limita pela quantidade do perfil:
  a verificar) e tira até o '+' (`:33`).
- **Core Next**: o `F2 00` sai uma vez por conexão, só quando há contato com número, e a resposta (ou a falta dela em
  4 s) vale a conexão; a quantidade do perfil limita os contatos (WARN acima), e sem perfil o limite é 8; o número fica
  só com os dígitos e o '+' inicial, e um contato sem dígito é pulado, sem buraco nos ids (DP-52)
  (`CrpMessagesWriter` e `CrpMessagePayloads.phoneDigits`, Repo 1; D4(e), D9).
- **Motivo**: D4(e) e D9.
- **Impacto para o usuário**: se o P85 informar menos de 8 contatos, os excedentes não vão (antes, o relógio
  decidia); um número sem dígito não vira um contato sem número no relógio.
- **Como corrigir ou voltar**: ignorar a quantidade do perfil no `CrpMessagesWriter`.
- **Revisar em**: validação da fase 2 (se o P85 responde ao `F2 00`, e com que quantidade).
- **Status**: pendente de validação no relógio.

### DP-89 — Codec do `0x41` sem a troca de emoji e sem perder o texto depois do segundo ':'

- **Produção**: o Android monta `título:texto` com o ':' do título trocado por '-' (`CRPService.java:751-757`); a SDK
  separa pelo ':' e guarda só os dois primeiros pedaços, perdendo o texto depois de um segundo ':'
  (`sdk:i/a.java:53-66`), troca emoji conhecido por "[emoji]" (`sdk:i/a.java:39` → `sdk:g1/h.java:66-100`) e corta
  pela unidade UTF-16 (`sdk:i/a.java:88-99`). O Core ainda tira tudo que não é ASCII antes
  (`TechnosSbNotification.kt:148-150`; DP-74).
- **Core Next**: só codec na fase 2 (`CrpMessagePayloads.notification` e `callEnded`, Repo 1; nada sai, DP-44 e
  DP-50): o mesmo `título:texto` com o ':' do título trocado, o título em até 63 bytes e o todo em 92 (38 na ligação),
  com '…' depois do corte, cortados em caractere inteiro, sem perder o texto depois do segundo ':' e sem a troca de
  emoji; o código do app é o de fio (`CrpNotificationCodes`, D13).
- **Motivo**: D8, D9 e D13 (o mesmo tratamento de texto dos contatos, DP-51).
- **Impacto para o usuário**: nenhum na fase 2; quando a fatia de encaminhamento usar o codec, um texto com ':' chega
  inteiro e emoji vai cru (o que o P85 mostra: a validar).
- **Como corrigir ou voltar**: as regras ficam no `CrpMessagePayloads` (Repo 1).
- **Revisar em**: fatia de encaminhamento de notificações (DP-74).
- **Status**: aberto.

### DP-98 — Clima guardado mesmo com a Promise rejeitada, e reenviado por um pedido interno

- **Produção**: o Android não guarda nada com a lista vazia ou sem conexão (`CRPService.java:689-699`) e reenvia o
  clima guardado a cada `8C` (DP-54). O iOS guarda toda lista, inclusive a vazia (`CRPService.m:977-982`; DP-56). Nos
  dois o `syncWeather` é `void` e não há como saber que o reenvio falhou.
- **Core Next**: uma lista válida e não vazia vira o clima guardado, em °C, antes de ir à sessão, mesmo que ela rejeite
  (`NOT_READY` desconectado, `NOT_SUPPORTED` no fitGPS e no Life Ultra GPS); uma lista inválida (`INVALID_ARGUMENT`)
  não troca o guardado; o `syncWeather([])` resolve na hora, em qualquer estado. O reenvio depois de um
  `setTemperatureUnit` que resolveu é um pedido interno da sessão, sem Promise, com o nome `syncWeather`, na fila atrás
  do que já estava pedido; uma falha dele sai em `onError` com `method: "syncWeather"` e o `requestId` interno
  (`CoreBridge.resendWeather`, Repo 1; D10; ADR 38).
- **Motivo**: o D10 não diz se o guardado depende da conexão; guardar o dado mais novo (como o iOS) faz o reenvio mandar
  o clima mais recente que o app teve.
- **Impacto para o usuário**: depois de um `syncWeather` feito com o relógio fora, o próximo `setTemperatureUnit` manda
  esse clima (o Android de produção reenviaria um mais velho, ou nenhum). Um app que escuta `onError` pode ver uma falha
  com `method: "syncWeather"` sem ter chamado o método naquela hora.
- **Como corrigir ou voltar**: guardar só no `onCompleted` do `syncWeather`, no `CoreBridge` (Repo 1), ou não emitir
  `onError` do reenvio interno.
- **Revisar em**: fase 4 (com o `getCurrentGeolocation`, DP-68, quando o clima passar a chegar ao relógio).
- **Status**: aberto.

## 6. Interações

### DP-57 — Encontrar celular só com o evento JS (opção A)

- **Produção**: o Core CRP não emite `onFindPhone` em nenhuma plataforma (só SMA e UTE: `SMAService.java:218`,
  `UTEService.java:1608`, `SMAService.m:1401`) e alarma ele mesmo. Android: `CRPService.java:1948-1971` →
  `CRPFindPhoneManager.kt:13-21` → `TechnosFindPhoneManager.kt:38-60`: tela por cima (com `canDrawOverlays`), volume
  máximo, lanterna, toque em laço e vibração, e `62 FF` ao parar (`CRPFindPhoneManager.kt:16-20`), com o processo vivo
  pelo serviço em primeiro plano persistente (DP-65). iOS: `CRPService.m:1258-1266` → `TechnosFindPhoneManager.m`:
  som de sistema em laço, vibração e lanterna (`:13, 23-65, 81-91`), parando só quando o relógio manda o fim.
- **Core Next**: o RX `62` vira `onFindPhone {status: '1' | '0'}`, sem fila; o TX `62 FF` existe só como codec e não
  sai (D12). O handler que o Condor já tem toca o `alarm.mp3` 2 s depois, e no iPhone também posta uma notificação
  local com som e vibração (`condor:store/MainStoreContext/WatchInfo/useWatchInfoData/index.ts:166-209`).
- **Motivo**: decisão do usuário 2 (opção A).
- **Impacto para o usuário**: sem tela cheia, lanterna, volume máximo e, no Android, sem vibração; parar pelo telefone
  não avisa o relógio; com o app em segundo plano no Android, só toca se o processo estiver vivo; no iPhone em segundo
  plano, quem toca é o JS do Condor depois do evento, no tempo que o iOS dá ao processo acordado pelo modo
  `bluetooth-central` (`condor:../ios/CondorSmart/Info.plist:126-133`), em vez do laço nativo da produção (não
  validado; [`ios-pendente.md`](ios-pendente.md#condor-reebok-crp)).
- **Como corrigir ou voltar**: a opção B, nativa como a produção (tela cheia, lanterna, toque, vibração, `62 FF` e o
  serviço em primeiro plano persistente; cerca de 1 dia; linha de corte (c)).
- **Revisar em**: depois de 2026-11-05, junto com a decisão do serviço persistente (DP-65).
- **Status**: aceito pelo usuário até revisão.

### DP-58 — Regra do `62` do Android também no iOS

- **Produção**: o Android começa com o payload vazio ou o primeiro byte `00` e para com qualquer outro
  (`sdk:m/a.java:3641-3649`). No iOS, um caminho do binário chama `recevieFindPhone:` com 0 (começar) sem olhar o
  estado (`iOS-bin@0x75148-0x75188`); segundo a pesquisa da fase 2, é o caminho do payload com 2 bytes ou mais
  (condição a verificar).
- **Core Next**: a regra do Android nas duas plataformas (D12).
- **Motivo**: D12 (decide pelo byte de estado que o firmware informa).
- **Impacto para o usuário**: no iPhone, um `62 01 xx` passaria a parar (antes começava). Nunca visto no ar.
- **Como corrigir ou voltar**: a regra do iOS no `CrpInteractions`.
- **Revisar em**: validação da fase 2.
- **Status**: pendente de validação no relógio.

### DP-59 — `onOpenCameraMode` depois da escrita, nas duas plataformas

- **Produção**: o Android nunca emite `onOpenCameraMode` no CRP (só iDO e SMA: `IDOService.java:346`,
  `SMAService.java:718`) e só abre a câmera do relógio se conectado (`CRPCameraManager.kt:13-18`), então a espera de
  10 s do Condor (`condor:store/MainStoreContext/Camera/useCameraData/index.ts:23-27`) sempre estoura. O iOS emite
  antes de mandar o frame e sem conferir a conexão (`CRPCameraManager.m:38-43`).
- **Core Next**: emite `onOpenCameraMode {}` depois que a escrita do `66` termina e antes do resolve; fora de
  `READY`/`SYNCING`, `NOT_READY` e nenhum evento (D11, D5). Um `openCameraMode` superado antes de concluir (um
  `closeCameraMode`, a saída pela tela do relógio ou uma queda depois da chamada, com o abrir ainda na fila atrás de um
  sync ou no intervalo de 200 ms) resolve sem o evento e sem ligar o modo (emenda de 2026-11-02 à ADR 38 do Repo 1;
  `CoreBridgeInteractionsTest.closeCalledWhileTheOpenIsStillInFlightLeavesTheModeClosed`): na produção, abrir e fechar
  são síncronos e na ordem da chamada (`CRPCameraManager.kt:13-23`; `CRPCameraManager.m:38-49`), e o modo termina
  fechado igual.
- **Motivo**: D11 (evento antes do resolve, e só se a escrita deu certo).
- **Impacto para o usuário**: no Android, a espera do Condor passa a terminar; no iPhone desconectado, o evento não
  sai e a Promise rejeita. Com o abrir superado (o usuário saiu da tela da câmera durante um sync), a espera de 10 s do
  Condor estoura como na produção Android, sem efeito na tela.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-60 — Disparo com a câmera fechada não promove o modo (iOS)

- **Produção**: no iOS, o primeiro disparo do relógio fora da câmera marca o modo aberto e emite
  `onDeviceRequestedCameraMode`, e os seguintes viram `onTakeAPicture` com o app fora da tela
  (`CRPCameraManager.m:51-64`). O Android, com o modo fechado, emite sempre `onDeviceRequestedCameraMode`
  (`CRPCameraManager.kt:31-35`).
- **Core Next**: a regra do Android nas duas plataformas (D11).
- **Motivo**: D11 (paridade com Android, SMA e iDO; o iOS deixava um `photoTaken` velho no Condor).
- **Impacto para o usuário**: no iPhone, disparos fora da tela da câmera não viram foto.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-61 — Saída da câmera pelo relógio só com `53 0E FF` (Android)

- **Produção**: no Android, qualquer `53` com 2 bytes ou mais e o primeiro `0E` fecha o modo (`sdk:m/a.java:891-898` →
  `CRPCameraManager.kt:38-40`).
- **Core Next**: só `53 0E FF` fecha (a regra do iOS, `iOS-bin@0x717c4-0x717ec`, a verificar); os outros `53` vão
  para o log (D11).
- **Motivo**: D11 (um `53 0E 00` qualquer faria os disparos seguintes virarem `onDeviceRequestedCameraMode`).
- **Impacto para o usuário**: no Android, um `53 0E` com outro estado não fecha mais o modo.
- **Como corrigir ou voltar**: a regra do Android no `CrpInteractions`.
- **Revisar em**: validação da fase 2.
- **Status**: pendente de validação no relógio.

### DP-62 — Modo câmera zerado ao desconectar

- **Produção**: o estado da câmera vive num singleton e não é zerado numa desconexão (`CRPCameraManager.kt:10-23`;
  `CRPCameraManager.m:33-49`).
- **Core Next**: qualquer estado fora de `READY`/`SYNCING` zera o modo, e o `closeCameraMode` sem conexão zera e
  resolve sem escrever (D11, D5).
- **Motivo**: D11.
- **Impacto para o usuário**: depois de uma queda com a câmera aberta, um disparo vira `onDeviceRequestedCameraMode`
  até o app abrir a câmera de novo.
- **Como corrigir ou voltar**: não há o que voltar.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-63 — Sem câmera disparada pelo relógio com o app em segundo plano (Android)

- **Produção**: no Android, com o app em segundo plano, o disparo mostra uma notificação que abre o app na câmera por
  deep link (`CRPCameraManager.kt:26-30`; `CameraControl.java:61-72`). O iOS nunca teve isso.
- **Core Next**: o disparo só vira o evento JS (linha de corte (d)).
- **Motivo**: decisão do usuário 3 (fora até 2026-11-05).
- **Impacto para o usuário**: no Android, o botão de foto do relógio com o app em segundo plano não faz nada.
- **Como corrigir ou voltar**: notificação local com deep link no `CoreHost` Android, com o esquema configurado pelo
  app (não escolhido pelo modelo do relógio, como em `CRPCameraManager.kt:27`).
- **Revisar em**: depois de 2026-11-05.
- **Status**: aceito pelo usuário até revisão.

### DP-64 — Sem controle de música por BLE no Android

- **Produção**: no Android, o Core responde aos botões de música do relógio pelo RX `67` (`setPhoneOperationListener`,
  `CRPService.java:1927-1945`), e o `manageMusicOption` (em todo sync, inclusive o parcial:
  `condor:` `useUserSettingsSyncHandler.ts:72-81`) liga o `MusicControlService` (um `NotificationListener`,
  `MusicControlService.java:25`) e manda o estado (`7B`), o título e o volume (`CRPService.java:1100-1125`;
  `CRPMusicManager.kt:17-58`). O iOS só resolve (`CRPService.m:538-540`).
- **Core Next**: o RX `67` só vai para o log; o `manageMusicOption` vira um stub que resolve sem tráfego na fase 4
  (D18, D19; linha de corte (i)).
- **Motivo**: D19: a premissa é que o P85 controla a música pelo AVRCP do vínculo clássico.
- **Impacto para o usuário**: no Android, os botões de tocar, pausar e trocar de faixa do P85 não fazem nada com o
  Core Next (a validação mostrou que o relógio os manda pelo `67`). O título aparece e o volume muda, mal, pelo
  vínculo clássico.
- **Validação (Android, 2026-11-02, I4; `fase2-interacoes-android`, `atMs` 497181 a 512297)**: com um player tocando
  e o vínculo clássico ativo, o relógio mostra o nome da música sem nada do Core Next (vem do AVRCP). Tocar/pausar,
  próxima e anterior chegam só como RX `67 06`, `67 02` e `67 01` (`MUSIC_PLAY`, `MUSIC_NEXT`, `MUSIC_PREVIOUS` do
  `CRPPhoneOperationType` da SDK; o tocar/pausar mandou `06` nas duas vezes) e o player não reage. Os botões de volume
  não mandam nada pelo BLE (nenhum `67 04`/`05`) e o volume do telefone muda, mas errado: é o AVRCP. A produção trata
  os `67` no `musicControlHandler` (`CRPService.java:1927-1946`; o `00`, tocar ou pausar, fica sem tratamento); se o
  `7B` do `manageMusicOption` faz o P85 mandar o volume pelo `67`: a verificar na captura de referência do app Condor.
- **Como corrigir ou voltar**: uma fatia própria: o `67` vira teclas de mídia, como na produção, e, se fizer falta,
  o estado, o título e o volume pelo `7B` (dependem do `NotificationListener` da fatia do encaminhamento).
- **Revisar em**: depois das prioridades da migração (prioridade baixa, decisão do usuário de 2026-11-02). No iPhone,
  o I4 da validação fica opcional.
- **Status**: aceito pelo usuário até revisão.

### DP-82 — Evento do relógio antes do `READY` só vai para o log

- **Produção**: os listeners da SDK CRP valem desde que o Core os registra na conexão, e o callback do encontrar
  celular ou da câmera chega ao app em qualquer momento da conexão (Android, `CRPService.java:1948-1971`; iOS,
  `CRPService.m:1258-1266`); se um `62` ou `66` durante o handshake chegaria ao JS: a verificar. No Android, todo
  evento passa pelo `EventSafetyManager.emitOrQueue`, que guarda a emissão numa fila enquanto o módulo JS não registrou
  o `EventData` e a entrega quando ele volta (`EventSafetyManager.kt:38-63`, a partir de `EventHandler.kt:121-125,
  436-440`): um disparo da câmera durante um reload do JS chegava ao JS novo (DP-101).
- **Core Next**: a sessão só repassa um `WatchEvent` (`62`, `66`, `53 0E FF`) com a conexão pronta (`READY` ou
  `SYNCING`); antes disso, o evento vai só para o log DEBUG `Session/onWatchEvent` e se perde. O `CoreBridge` também
  não guarda os eventos enquanto o JS não existe (`queueIfNotReady = false`; D3; ADR 35 do Repo 1), de propósito,
  ao contrário da fila do Android de produção (DP-101).
- **Motivo**: D3: eventos transitórios (foto, encontrar celular) fora de hora disparariam uma ação velha depois do
  handshake ou de um reload do JS.
- **Impacto para o usuário**: um toque em "encontrar celular" ou no disparo da câmera nos cerca de 2 s do handshake de
  uma conexão ou reconexão não faz nada; é preciso tocar de novo.
- **Como corrigir ou voltar**: repassar o evento já no `HANDSHAKING` na `SessionEngine.onNotice` do Repo 1.
- **Revisar em**: validação da fase 2.
- **Status**: aceito pelo usuário até revisão.

### DP-90 — Eco do `66` nos 200 ms do `openCameraMode` não vira foto

- **Produção**: não há janela de eco. O `66` é o mesmo `cmd` no TX de abrir a câmera e no RX de disparo, e a SDK
  entrega todo RX `66` como `onTakePhoto`, sem olhar o payload (`sdk:m/a.java:605-606` → `:3141-3146`; iOS,
  `iOS-bin@0x71764-0x71794`). Android: o abrir marca o modo depois do `enterCameraView` (`CRPCameraManager.kt:13-18`)
  e um disparo com o modo aberto vira `onTakeAPicture` (`:31-32`). iOS: o modo é marcado antes do frame
  (`CRPCameraManager.m:38-43`) e todo disparo vira `onTakeAPicture` (`:51-60`). Se o relógio ecoasse o `66`, a
  produção tiraria uma foto ao abrir a tela; se o P85 ecoa: a verificar (nunca visto no ar).
- **Core Next**: todo `66` que chega durante o atraso da fila da escrita do `66` (200 ms no P85) é consumido como eco,
  vai só para o DEBUG `CrpDriver/camera` e não vira `CameraShutter`; depois disso, um `66` é disparo
  (`CrpInteractions.openCamera`, resposta opcional do D4(e), Repo 1; D11).
- **Motivo**: D11: um eco viraria uma foto espúria ao abrir a tela da câmera.
- **Impacto para o usuário**: se o P85 ecoar, abrir a câmera não tira foto sozinho. Um toque de verdade no botão de foto
  do relógio nos 200 ms seguintes ao abrir se perde, e é preciso tocar de novo.
- **Como corrigir ou voltar**: se a validação não mostrar eco, tirar a resposta opcional do `openCamera` no
  `CrpInteractions` (o `66` vira escrita sem resposta, como na produção).
- **Revisar em**: validação da fase 2 (abrir a câmera pelo app de exemplo e ver se chega um RX `66` em até 200 ms).
- **Status**: pendente de validação no relógio.

### DP-101 — Eventos da câmera no Android com `{}` e sem fila enquanto o JS não existe

- **Produção**: no Android, o CRP emite o `onTakeAPicture` e o `onDeviceRequestedCameraMode` com payload `null`
  (`EventHandler.kt:121-125, 436-440`, chamados de `CRPCameraManager.kt:31-35`), pelo `EventSafetyManager.emitOrQueue`:
  sem o `EventData` do módulo JS registrado (um reload do JS, o módulo ainda subindo), a emissão vai para uma fila e sai
  quando ele volta (`EventSafetyManager.kt:38-63`). O `onOpenCameraMode` não sai no CRP (DP-59) e o `onFindPhone`
  também não (DP-57). O iOS emite `{}` (seção "Conferido: não é desvio").
- **Core Next**: nas duas plataformas, os dois eventos saem com `{}` (`EventMapper.empty()`, `CoreBridge` do Repo 1), e
  com o JS fora eles se perdem: os eventos transitórios da fase 2 (`onFindPhone`, `onTakeAPicture`,
  `onDeviceRequestedCameraMode`, `onOpenCameraMode`) não entram na `PendingEvents` (`queueIfNotReady = false`; D3, ADR
  35 e ADR 38 do Repo 1; `CoreBridgeInteractionsTest.watchFramesWhileTheJsIsAwayAreDroppedNotQueued`).
- **Motivo**: o payload `{}` é o formato do codegen e do iOS de produção. A falta de fila é o D3: uma foto ou um alarme
  de celular entregues depois de um reload disparariam uma ação velha.
- **Impacto para o usuário**: o payload, nenhum: o app Condor não lê o argumento desses eventos
  (`condor:store/MainStoreContext/Camera/useCameraData/index.ts:8`; `condor:componentsV2/Modals/CameraControlModal/
  index.tsx:52`). A fila: no Android, um toque no disparo do relógio durante um reload do JS (no uso normal, raro; em
  desenvolvimento, a cada Fast Refresh) se perde, e é preciso tocar de novo.
- **Como corrigir ou voltar**: emitir esses dois com `queueIfNotReady = true` no `CoreBridge` (Repo 1), aceitando a foto
  atrasada depois de um reload; o payload não precisa voltar.
- **Revisar em**: fase 4 (troca do pacote no app Condor).
- **Status**: aceito pelo usuário até revisão (D3, especificação aprovada da fase 2).

## 7. Plataforma e segundo plano

### DP-65 — Sem serviço em primeiro plano persistente no Android

- **Produção**: o Core sobe o `TechnosForegroundService` ao iniciar o módulo (`NativeCoreModule.kt:97-99` →
  `TechnosForegroundServiceManager.kt:36-52`), com `START_STICKY` (`TechnosForegroundService.java:75`), e o
  `NotificationListener` também o sobe (`NotificationListener.java:47-53`).
- **Core Next**: serviço em primeiro plano só durante o sync (`SyncForegroundService`,
  [`transporte-android.md`](transporte-android.md#serviço-em-primeiro-plano-só-no-sync)); fora dele, a conexão vive pelo
  `autoConnect` enquanto o processo existir.
- **Motivo**: escopo da PoC (risco 10 do plano, aceito); o serviço persistente se cruza com o CDM (ADR 34).
- **Impacto para o usuário**: com o app em segundo plano, o Android pode congelar ou matar o processo: o relógio
  desconecta até o app abrir, e encontrar celular (DP-57) e qualquer comando em segundo plano param.
- **Como corrigir ou voltar**: serviço em primeiro plano persistente, ou o `NotificationListener` da fatia de
  encaminhamento (que também mantém o processo vivo), ou o CDM.
- **Revisar em**: fatia de encaminhamento de notificações; depois da fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-66 — Ajustes depois do sync sem o serviço em primeiro plano

- **Produção**: as escritas dos ajustes rodam com o serviço persistente ligado (DP-65).
- **Core Next**: o `CoreBridge` desliga o serviço no `onSyncFinished` (`stopSyncWork("sync finished")`, `CoreBridge.kt`
  do Repo 1), e o sync de ajustes do Condor roda logo depois.
- **Motivo**: D15 (nenhuma mudança de plataforma na fase 2).
- **Impacto para o usuário**: com o app em segundo plano no Android, as escritas dos ajustes podem atrasar ou cair.
- **Como corrigir ou voltar**: manter o trabalho em segundo plano enquanto houver comandos na fila.
- **Revisar em**: fase 4.
- **Status**: aberto.

### DP-67 — Sem pareamento pelo CDM

- **Produção**: o Core `v4.3.57` também não usa o `CompanionDeviceManager` (nenhuma ocorrência em `android/`, `ios/` ou
  `src/` na tag); o que mantém o processo vivo lá é o serviço persistente e o `NotificationListener` (DP-65). O desvio
  é em relação ao plano, que previa o CDM na fase 4.
- **Core Next**: sem CDM; pareamento pelo scan, `pairDevice` e o vínculo clássico (ADR 34).
- **Motivo**: decisão do usuário (ADR 34): fora do prazo de 2026-11-05.
- **Impacto para o usuário**: igual à produção no pareamento; sem o CDM nem o serviço persistente, nada substitui o que
  mantinha o processo vivo (DP-65).
- **Como corrigir ou voltar**: trabalho do host Android, com ADR própria.
- **Revisar em**: depois da fase 4, se sobrar tempo.
- **Status**: aceito pelo usuário até revisão.

## 8. Previstos para as fases 3 e 4

### DP-68 — Clima não chega ao relógio sem o `getCurrentGeolocation`

- **Produção**: o Condor monta o clima com `TechnosCore.getCurrentGeolocation()` (`NativeCore.ts:133`;
  `condor:store/MainStoreContext/Weather/useWeatherData/index.ts:14`) e, sem posição, chama `syncWeather([])`
  (`:63, 69`).
- **Core Next**: não existe; o `syncWeather` recebe a lista pronta do app (D10).
- **Motivo**: decisão do usuário 5 (porte na fase 4).
- **Impacto para o usuário**: depois da troca, nenhum clima chega ao relógio até a fase 4.
- **Como corrigir ou voltar**: portar o `TechnosDeviceLocationManager` para o Repo 2, no formato
  `{coords: {latitude, longitude}, neighborhood, city}`.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-69 — Permissões que vinham do manifest do Core antigo

- **Produção**: o manifest do Core entra no app pelo merge com `ACCESS_BACKGROUND_LOCATION`, `VIBRATE`,
  `RECEIVE_BOOT_COMPLETED`, `SYSTEM_ALERT_WINDOW`, `READ_PHONE_STATE`, `READ_CONTACTS`, `ANSWER_PHONE_CALLS` e
  `READ_CALL_LOG`, entre outras (`AndroidManifest.xml:102-119`); o do Condor só declara `INTERNET`, `CAMERA`,
  localização, `VIBRATE`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `FLASHLIGHT`, `MODIFY_AUDIO_SETTINGS` e
  `READ_CALL_LOG` (`GTE-CondorSmart/android/app/src/main/AndroidManifest.xml:19-27`).
- **Core Next**: o manifest da biblioteca só tem Bluetooth, serviço em primeiro plano e notificação
  ([`transporte-android.md`](transporte-android.md#permissões)).
- **Motivo**: a fase 2 não muda a plataforma (D15).
- **Impacto para o usuário**: sem declarar no Condor, a agenda do telefone não é lida para o `setAddressBook` (sem
  `READ_CONTACTS`).
- **Como corrigir ou voltar**: declarar no manifest do Condor as que ele ainda usa.
- **Revisar em**: fase 4.
- **Status**: aberto.

### DP-70 — Stubs de compatibilidade que resolvem sem tráfego

- **Produção**: no Android, `setSpo2AutomaticCheck` (`CRPService.java:888-890`), `setSedentaryMode` (`:942-944`),
  `setSportPlate` (`:1030-1032`), `setSportParameter` (`:1035-1037`), `setDeviceShortcuts` (`:1046-1048`),
  `setAutomaticActivity` (`:1061-1063`) e `setAutomaticScreenBrightness` (`:1095-1097`) resolvem sem falar com o
  relógio; o `manageMusicOption` liga o controle de música (DP-64) e o `setFindTelephoneControl` manda o
  `startFindPhone` e nunca resolve (`:1128-1131`). No iOS, os mesmos resolvem (`CRPService.m:538-540, 774-776,
  787-793, 804-806, 876-882, 896-899`), menos o `setSportParameter`, que rejeita `"-1"` (`:884-888`).
- **Core Next**: os nove resolvem sem tráfego, no JS (`src/compat`), documentados como no-op de compatibilidade (D18).
- **Motivo**: D18 (o `manageMusicOption` roda em todo sync e o `setSportPlate` em todo sync completo; rejeitar poria
  um evento por sync no Crashlytics).
- **Impacto para o usuário**: no Android, sem o controle de música (DP-64) e sem o `62` do `setFindTelephoneControl`
  (fora da lista do REEBOK, `condor:` `useUserSettingsSyncHandler.ts:152-170`); no iOS, o `setSportParameter` deixa de
  rejeitar.
- **Como corrigir ou voltar**: implementar no Repo 1 o que o P85 precisar.
- **Revisar em**: fase 4.
- **Status**: aceito pelo usuário até revisão.

### DP-71 — Stubs de compatibilidade que rejeitam `NOT_SUPPORTED`

- **Produção**: varia por nome. `getDeviceGoals` já rejeitava (`CRPService.java:1149-1151`; `CRPService.m:1726-1728`);
  `setGestureControl` (a primeira versão) é implementado (`CRPService.java:965-972`; `CRPService.m:808-810`);
  `screenBrightness` é `void` e não faz nada (`CRPService.java:773-775`; `CRPService.m:762-764`).
- **Core Next**: os nomes fora da fase 2 que o Core CRP não resolvia sem tráfego rejeitam `NOT_SUPPORTED` com
  `onError`, por um método nativo genérico do `CoreBridge` (D18).
- **Motivo**: D18 (um stub em JS que rejeita não emite `onError`).
- **Impacto para o usuário**: uma chamada a `setGestureControl` ou `screenBrightness` passa a rejeitar; o Condor usa a
  versão 2 do gesto no REEBOK.
- **Como corrigir ou voltar**: implementar o nome no Repo 1, ou movê-lo para os stubs que resolvem (DP-70).
- **Revisar em**: fase 4 (lista definitiva dos cerca de 40 nomes).
- **Status**: aceito pelo usuário até revisão.

### DP-72 — Perfil do usuário só em memória

- **Produção**: o Android grava o perfil no `UserProfileManager` para a atividade (`NativeCoreModule.kt:930-933`) e
  num cache (`CRPUserSettingsManager.java:66`); o iOS não persiste.
- **Core Next**: o último perfil fica em memória no `CoreBridge` (D15; linha de corte (f)).
- **Motivo**: D15 (só a atividade da fase 3 precisa dele).
- **Impacto para o usuário**: um processo novo não tem o perfil até o próximo `setUserInfo` (o Condor manda no fim de
  todo sync).
- **Como corrigir ou voltar**: persistir no `store/` do host, se a fase 3 precisar.
- **Revisar em**: fase 3.
- **Status**: aceito pelo usuário até revisão.

### DP-73 — Exports do Core que o app Condor usa e não existem aqui

- **Produção**: o Condor usa o `technosAssets.IANA_TIMEZONE_INFO_LIST`
  (`condor:screensV2/worldClock/WorldClockSelector/index.tsx:28, 73`), o `getNotificationListByModel`
  (`condor:services/Smartwatch.ts:100-102`) e os tipos pelo caminho profundo
  `react-native-technos-ware-core/src/NativeModules/type/...` (`condor:services/Smartwatch.ts:25`;
  `condor:mappers/entities/activity.ts:9`).
- **Core Next**: nenhum dos três existe na fase 2.
- **Motivo**: linha de corte (g).
- **Impacto para o usuário**: sem eles, a troca no Condor não compila ou a tela de relógio mundial fica sem fusos.
- **Como corrigir ou voltar**: exportar os dados e os tipos, ou ajustar os imports no adaptador.
- **Revisar em**: fase 4.
- **Status**: aberto.

### DP-74 — Desvios previstos da fatia de encaminhamento (SMS e acentos)

- **Produção**: no Android, o SMS é procurado pela chave 'Mensagens' (`TechnosAvailableNotificationApps.kt:33-35`),
  que não existe no filtro do Condor (lá é 'SMS'), então segue o 'OTHERS' e ignora o botão de SMS
  (`TechnosSbNotification.kt:164, 182-186`); o texto perde acentos e emoji (`:148-150`).
- **Core Next**: quando a fatia entrar, respeita o botão de SMS e só manda acentos se o relógio os exibir direito
  (decisão do usuário 1).
- **Motivo**: decisão do usuário 1.
- **Impacto para o usuário**: no Android, o SMS passa a seguir o próprio botão, e os acentos aparecem no relógio (se a
  validação aprovar).
- **Como corrigir ou voltar**: manter o comportamento de produção na fatia.
- **Revisar em**: fatia de encaminhamento de notificações.
- **Status**: aberto.

### DP-94 — Sync sem frequência cardíaca, estresse e treinos (até a fase 3)

- **Produção**: o `syncDataHistory` do Android pede, além de passos e sono, o histórico de treinos
  (`queryHistoryTraining`, `CRPService.java:208`), a frequência cardíaca medida de hoje e de ontem (`:210` e `:216`,
  esta só quando ontem ainda não foi sincronizado) e o estresse de hoje e de ontem nos modelos com o recurso `STRESS`,
  que inclui o Condor Reebok (`:224-226`; `DeviceFeatures.kt:41-46`); o SpO2 (`:220`) só nos modelos com `SPO2`, que não
  inclui o P85. O iOS pede as atividades (`getSportRecordList`), a frequência cardíaca e o estresse (`CRPService.m:132,
  134, 140`; `ios/reactlibrary/Devices/DeviceFeatures.m:55-59`). O app Condor lê esses históricos do Core em todo sync
  (`condor:store/LowerLevelContext/SyncHandlerStoreContext/useSyncHandlerData/useSyncStepsRunner.ts:80-84`).
- **Core Next**: o `syncDataHistory` lê só passos (com os totais do dia) e sono (`syncHistory`, Repo 1,
  `docs/arquitetura.md`, seção 6); não há método JS de histórico de frequência cardíaca, estresse nem atividades.
- **Motivo**: o plano do porte do CRP deixa atividades, frequência cardíaca e estresse para a fase 3 (`CLAUDE.md` do
  Repo 1; `docs/pendencias.md` de lá, "O que ficou para depois").
- **Impacto para o usuário**: enquanto a fase 3 não entrar, os históricos de frequência cardíaca, estresse e
  atividades do Condor não recebem dados do relógio; passos e sono continuam. Como a troca do pacote é a fase 4, o
  usuário só sente isso se ela vier sem a fase 3.
- **Como corrigir ou voltar**: a fase 3 (atividades `B2`, frequência cardíaca `35`/`B6 02` e estresse `B9 11`;
  `docs/protocolo-crp.md` do Repo 1, seção 13).
- **Revisar em**: fase 3.
- **Status**: aceito pelo usuário até revisão.

## 9. Outros modelos CRP

### DP-75 — Relógio Force: CRP só com BLE, sem Bluetooth clássico

- **Produção**: o Core trata o Mormaii Force como CRP (`AvailableDevices.java:42`; o scan iOS em
  `CRPService.m:721-722`), sem o recurso `CLASSIC_BT` (`DeviceFeatures.kt:32-34`, só SpO2): no Android não pede o
  vínculo clássico
  (`CRPBleConnectHelper.java:513-518, 674-683`), e as ligações chegam ao relógio pelo `0x41` do `CallManager` (DP-50),
  que vale para qualquer CRP.
- **Core Next**: só o P85 tem perfil. Nele, as ligações dependem do HFP (DP-50), a música do AVRCP (DP-64) e o
  pareamento pede o vínculo clássico (`Quirks.classicBond`, ADR 30); nada disso existe num relógio só com BLE.
- **Motivo**: pendência pedida pelo usuário (decisão 4 de 2026-11-01): o Force usa a SDK CRP mas não tem Bluetooth
  clássico.
- **Impacto para o usuário**: portado como o P85, o Force ficaria sem ligações e sem música no relógio, e o pedido de
  vínculo clássico falharia.
- **Como corrigir ou voltar**: um perfil do Force com `classicBond = false`; ligações pelo codec `0x41`/`41 FF` (o
  caminho provável) com o porte do `CallManager` e `READ_PHONE_STATE`; revalidar a música (o RX `67` e o `7B`, DP-64),
  o SOS e tudo que no P85 depende do clássico.
- **Revisar em**: quando o Force for portado.
- **Status**: aberto.

### DP-76 — Recursos por modelo (`DeviceFeatures`) não conferidos

- **Produção**: antes dos contatos e do relógio mundial, o Core confere o modelo e rejeita `"-1"` nos que não têm o
  recurso (`CRPPhoneManager.kt:17-20`; `CRPPhoneManager.m:20-23`; `CRPService.java:1308-1311`; `CRPService.m:1702`),
  pela tabela `DeviceFeatures.kt:31-52` (o Force não tem contatos nem relógio mundial).
- **Core Next**: o driver CRP manda os comandos para qualquer perfil CRP; só existe o P85, que tem os dois.
- **Motivo**: a fase 2 só cobre o P85.
- **Impacto para o usuário**: nenhum hoje; um modelo CRP novo receberia comandos que não suporta.
- **Como corrigir ou voltar**: recursos no perfil (como o `Quirks.classicBond`), com `NOT_SUPPORTED` antes de escrever.
- **Revisar em**: quando entrar outro modelo CRP.
- **Status**: aberto.

## Conferido: não é desvio

Para não voltar a investigar:

- **Gênero vazio ou `"o"`**: os dois Cores mandam feminino no `0x12` (`CRPUserSettingsManager.java:57-58`;
  `CRPUserSettings.m:29`); o Core Next guarda `OTHER`, que o CRP codifica como feminino (`01`): o mesmo byte.
- **`enable` do alarme como número ou booleano, e `enabled` ignorado no alarme**: o Core Android já lia só `enable` e
  aceitava `Double` diferente de 0 (`NativeCoreModule.kt:449-457`); o `SettingsMapper` faz igual (com um DEBUG quando
  vem `enabled` sem `enable`).

- **Consultas de leitura de volta** (`2A`, `27`, `8D`, `85`, `87 01`, `81`, `83`, `2F`, `B9 15 04`) e o período do
  sedentarismo (`0x73`): a produção também não manda (DP-36; o `setSedentaryMode` resolve sem tráfego,
  `CRPService.java:942-944`).
- **`0x6D` sem pedido** (o resultado da medição única de frequência cardíaca): a produção ignora
  (`onOnceMeasureComplete` vazio, `CRPService.java:1798-1799`); o Core Next só loga.
- **`A1` e `A4` sem pedido** (o aviso de SOS do relógio, `sdk:m/a.java:499-500`, e o estado da economia de bateria):
  a produção não registra `setSosChangeListener` nem `setBatterySavingListener` no `CRPService.java`, então os ignora;
  o Core Next só loga em INFO (`CrpSettingsWriter.onUnsolicited`, Repo 1).
- **Bytes dos ajustes que a produção mandou** (`12`, `B9 00 00`, `17`, `1A`, `7C`, `8C`, `7D`, `94`, `BB 08 01`, `1F`,
  `B9 01 01`, `B9 11 01 00`, `71`, `77 01`, `1D`, `2D`): o Core Next monta o mesmo pacote, cabeçalho incluído, para
  os mesmos valores (`CrpSettingsGoldenTest.everySettingFrameOfTheReferenceCaptureIsReproduced`, Repo 1, sobre as
  três fixtures de referência).
- **Vínculo clássico no iOS**: nenhum dos dois cria; os dois conectam com o transport bridging (ADR 30).
- **Ajuste rejeitado não reenviado**: a produção também não reenvia; ele volta no próximo sync completo (D15).
- **Scan Android sem filtro** (ADR 25), **bateria acima de 100 = carregando** (`CRPService.java:1814-1822`, ADR 31) e
  **total do sono sem o acordado** (`CRPService.java:2018-2041`, ADR 29): iguais à produção.
- **Mais cidades que o máximo do relógio mundial e mais de 8 alarmes**: a produção também corta
  (`CRPUserSettingsManager.java:259`; `CRPService.java:949`); o Core Next corta igual, com WARN.
- **Alarme sem nenhum dia**: o `repeat` zerado vira único no Core Android (`CrpTechnosToSdkMappers.java:31-52`, em
  `android/src/main/java/com/crp/bluetooth/mappers/`), com a data da próxima ocorrência; igual no Core Next.
- **Nascer e pôr do sol ausentes**: o Core Android deixa os campos do `B5` em 0 (`CRPUserSettingsManager.java:363-376`);
  o Core Next manda `00 00` igual.
- **Clima com a cidade vazia**: a SDK pula o `43` e o `B5` (`sdk:h/a.java:434-440`) e manda só o `42`; igual no Core
  Next.
- **Bytes das interações** (`61`, `66`, `53 0E`, `51 02` e o codec `62 FF`): os mesmos das duas SDKs, com o mesmo atraso
  de fila de 200 ms (`sdk:h/a.java:605-607, 752-758, 1017-1019`; `sdk:f/t.java:9-17`; `sdk:f/x.java:21-25`;
  `iOS-bin data@0x1c5780`, `@0x1c5810`, `@0x1c5bd0`, `@0x1c5ab0`), e nenhuma das duas espera resposta ao `61` nem ao
  `51 02` (não há `case 97` nem `case 81` no despacho, `sdk:m/a.java:455-745`); o Core Next também não espera.
  `CrpInteractionsGoldenTest`, Repo 1.
- **Disparo da câmera sem olhar o payload e `53 0E` curto ignorado**: as duas SDKs fazem igual (`sdk:m/a.java:605-606,
  891-898`; `iOS-bin@0x71764-0x71794, 0x717c4-0x717c8`); o Core Next também.
- **Formato dos eventos da fase 2 no iOS**: o Core iOS de produção emite o `onOpenCameraMode`, o
  `onDeviceRequestedCameraMode` e o `onTakeAPicture` com `{}`, e o `onFindPhone` com `{status}` em string, pelos
  emissores do codegen (`ios/reactlibrary/Events/EventHandler.mm:82-92, 186-190`; o `onFindPhone` vem só do SMA, o CRP
  de produção não o emite, DP-57). O shim do iOS emite os mesmos formatos (`RCTNativeCoreNext.mm`, `emitName:payload:`;
  `Phase2HostTests` em `ios/Tests/`). No Android de produção o payload era `null` e havia fila: DP-101.
