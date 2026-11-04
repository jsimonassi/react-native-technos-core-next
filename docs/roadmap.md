# Roadmap: estado, decisões e próximos passos

Ponto de entrada para retomar o Core Next: o Repo 1 (`technos-watch-protocol`, protocolo em Kotlin Multiplatform) e o
Repo 2 (`react-native-technos-core-next`, TurboModule, hosts Android e iOS e app de exemplo). Atualizado em
2026-11-04, quando o trabalho foi pausado. Os detalhes moram nos docs citados; este arquivo diz o que existe, o que foi
decidido, o que falta e onde está cada coisa.

## Como retomar

1. Leia este arquivo e depois o `CLAUDE.md` dos dois repositórios.
2. Veja a seção [Estado do código](#estado-do-código): a base da fase 3 está no working tree dos dois repositórios,
   sem commit.
3. Escolha o próximo passo em [Próximos passos](#próximos-passos) e abra o plano dele em
   [`planejamento/`](planejamento/README.md).
4. Com um agente de IA (Claude Code), comece pedindo: "leia o `docs/roadmap.md` do react-native-technos-core-next e
   continue de onde paramos". A memória do agente é guardada por pasta (`~/.claude/projects/<pasta>/memory/`) e só
   carrega numa sessão aberta na mesma pasta de antes; por padrão, o Claude Code também apaga as conversas locais
   antigas (30 dias). O que vale é o que está nos repositórios.

## Estado do código

Último commit de cada repositório:

| Repositório | Commit | O que entrou |
|---|---|---|
| Repo 1 | `a5c8aa5` | tradutor CRP (Condor Reebok) com as funções da fase 2 |
| Repo 2 | `44080ba` | fase 2 do Condor Reebok (ajustes, mensagens e interações) |

Sem commit, nos dois repositórios, está a base da fase 3, feita em 2026-11-03 e verde nos portões da época:

- Repo 1 (44 arquivos, 9 novos):
  - domínio da fase 3 (`WatchActions`, `WatchEvents`, `WatchErrorCodes.LOW_BATTERY`) e `DeviceProfile.dataKinds`
    (o Condor Reebok com os cinco tipos);
  - `SampleStore` com medições e treinos;
  - `WatchSession.getMeasurements`, `getWorkouts`, `storeWorkout` e `fetchLastWorkout`, em stub;
  - `SyncEngine` com FC, estresse e treinos não fatais;
  - grupos CRP vazios (`CrpHealthReader`, `CrpWorkoutReader`, `CrpActivityControl`), que recusam com
    `NOT_SUPPORTED`;
  - 9 métodos novos no `CoreBridge` e 5 no `CoreHost`, todos stub;
  - os testes `Phase3SessionContractTest` e `CoreBridgePhase3FallbackTest`;
  - publicado no `mavenLocal` (0.1.0) e no XCFramework.
- Repo 2 (36 arquivos, 7 novos):
  - contrato JS da fase 3: 9 métodos e 10 eventos no spec, enums, tipos, mock e constantes;
  - os quatro componentes em stub (`TechnosNativeChronometer`, `TechnosNativeMap`, `TechnosMapStyles`,
    `TechnosNativeActionTimer`);
  - os métodos nos hosts Android e iOS e o `react` nos `paths` do `example/tsconfig.json`.
- Efeito: o Condor compila contra o contrato novo. Os históricos novos emitem lista vazia, e o `startActivityByTypeV2`
  emite `onActivityError` com `-1` e resolve.
- Portões verdes na época, no Repo 2: 66 testes Android, 134 do Jest, os dois typechecks, ESLint, Prettier, 69 testes
  do host iOS e os builds Debug e Release do exemplo.
- Também sem commit, desta pausa: este arquivo, a pasta [`planejamento/`](planejamento/README.md), o apontador no
  `CLAUDE.md` dos dois repositórios e, no Repo 1, a pasta `spikes/room-kmp/`.
- Ruído conhecido: todo `pod install` em `example/ios` tira 8 linhas vazias do `project.pbxproj`; não é mudança real.

## Relógios e famílias

| Família | Relógio | Android | iPhone |
|---|---|---|---|
| SMA | fitGPS (Mormaii) | PoC validada (pareamento, bateria, versão, hora, passos) | rodou em 2026-10-30 |
| iDO | Life Ultra GPS (Mormaii) | funções básicas validadas | rodou em 2026-10-30 |
| CRP | Condor Reebok (BLE `P85`, firmware MOY-VS02-2.0.0) | fases 1 e 2 validadas | fase 1 validada, fase 2 pendente |
| UTE, UTERT | outros modelos | não começado | não começado |

No iOS, reconexão, segundo plano e restauração ainda não foram validados (ver o `CLAUDE.md` do Repo 1).

## Migração do Condor Smart

Objetivo: provar o Core Next de ponta a ponta num segundo app antes do Mormaii. Prazo original: 2026-11-05.

| Fase | Conteúdo | Estado |
|---|---|---|
| 1 | Protocolo CRP e pareamento | feita, commitada, validada no Android e no iPhone (2026-11-01) |
| 2 | Tela Dispositivo: ajustes, mensagens e interações | feita, commitada, validada no Android (2026-11-02); iPhone pendente |
| 3 | Sync de dados com banco Room global (recortada em 2026-11-03) | desenho pronto, base sem commit, implementação adiada |
| 4 | Troca do Core no Condor | não começada |
| depois | Pareamento pelo CDM do Android | fora do prazo (ADR 34 do Repo 1) |

## Decisões tomadas

- 2026-11-01: esquecer nunca faz reset de fábrica. O `forgetDevice` e o `resetDevice` (CRP `51 02`) são métodos
  separados, e o adaptador do Condor escolhe qual botão chama qual (ADR 33 do Repo 1).
- 2026-11-01: o CDM ficou fora do prazo (ADR 34 do Repo 1).
- 2026-11-01, fase 2:
  - encontrar celular na opção A;
  - câmera disparada pelo relógio com o app em segundo plano, no Android, fora;
  - chamadas só por HFP;
  - o encaminhamento de notificações do Android entraria como fatia própria, de cerca de 1 dia (o recorte de
    2026-11-03 adiou);
  - o clima viria com o port do `TechnosDeviceLocationManager` na fase 4 (ver o conflito em
    [Perguntas em aberto](#perguntas-em-aberto)).
- 2026-11-03, 01:30, recorte do escopo:
  - até o prazo, só pareamento, sync de dados com um banco Room global (como o `technosdatastorage` de produção), o
    fluxo do sync, a tela Dispositivo e a fase 4;
  - atividade iniciada pelo app, GPS, mapa, notificações, mostradores, firmware, Health Connect e HealthKit esperam;
  - a atividade fica em stub para o Condor compilar;
  - texto original em
    [`planejamento/fase3-v2-dados-room/decisoes-usuario.md`](planejamento/fase3-v2-dados-room/decisoes-usuario.md).
- 2026-11-03: a implementação da fase 3 v2 foi adiada pelo custo em tokens. O desenho consumiu cerca de 1,3 milhão de
  tokens de subagentes, e a implementação em paralelo foi estimada em alguns milhões.
- 2026-11-03: direção recomendada: o Core Next híbrido (ver
  [Estratégia recomendada](#estratégia-recomendada-core-next-híbrido)). O usuário aceita manter bibliotecas de
  fabricante de chip, desde que rodem em emulador. A decisão entre seguir com o Core Next e continuar com as SDKs é da
  gestão (slide 25 da apresentação).
- Regra permanente: todo comportamento diferente da produção vira uma entrada `DP-nn` em
  [`desvios-de-producao.md`](desvios-de-producao.md), para revisão futura.

## Perguntas em aberto

Fase 3 v2 (detalhe na última seção do desenho da
[especificação](planejamento/fase3-v2-dados-room/especificacao.md)):

1. O `forgetDevice` apaga o banco local na hora, como a produção? Recomendação: sim (opção A).
2. No logout e no "Resetar relógio" da tela Dispositivo, o adaptador da fase 4 chama `resetDevice` antes do
   `forgetDevice`? Recomendação: sim, só nesses dois casos (opção A).
3. O que fazer com o banco do Core antigo (`technosdatastorage.db`) depois da troca? Recomendação: não mexer na fase 4
   (opção A).
4. O `exportLogs` inclui uma cópia do banco, como o `shareLogs` da produção? Recomendação: não (opção A).

Para começar a implementação bastam a resposta da 1 e o ok para rodar; a 2 e a 3 são da fase 4, e a 4 tem padrão (não
incluir).

Fase 4, sem bloquear: DP-92 (scan de 7 s contra 20 s e 10 s), DP-93 (`observed()` nos métodos `void` da fase 1),
DP-95 a DP-98 (rigor da ponte contra a produção), DP-99 e DP-100 (argumento `null` inteiro; a correção certa são
parâmetros anuláveis no `CoreBridge`).

Conflito a resolver, o clima: a decisão de 2026-11-01 previa portar o `TechnosDeviceLocationManager` na fase 4; a
especificação v2 deixa a tabela `DeviceLocationData` de fora e põe `getLastDeviceLocation`, `deleteDeviceLocation` e
`deleteAllDeviceLocation` como stub na camada de compatibilidade da fase 4 (DP-139).

## Próximos passos

Em ordem sugerida; cada item diz onde está o plano.

1. **Decidir o destino da base da fase 3**, sem commit nos dois repositórios: commitar como está ou junto com a
   fase 3 v2.
2. **Fechar a validação da fase 2.**
   - iPhone: checklist em [`example/README.md`](../example/README.md#checklist-da-fase-2-com-o-condor-reebok) e
     extras em [`ios-pendente.md`](ios-pendente.md); termina com o reset de fábrica (I5).
   - Android, o que ficou:
     - refazer o F12 com o contador zerado;
     - descobrir qual relógio resetou sozinho;
     - botão opcional de "ciclo de abril" no F8, que não distingue 9 de fevereiro de 9 de março;
     - o vínculo clássico do P85 no Android falhou: esquecer e parear de novo antes de refazer.
   - Fixtures da fase 2 (S9): `CrpPhase2FixtureTest` e `PHASE2_PENDING_STRICT` (D17, ADR 39), a partir dos exports da
     validação. Eles ficam fora dos repositórios, porque os `logs-*.jsonl` têm o MAC. Notas em
     [`planejamento/validacao-android-fase2/notas-s9.md`](planejamento/validacao-android-fase2/notas-s9.md).
   - Música pelo RX `67` não funcionou (DP-64, prioridade baixa).
3. **Fase 3 v2: sync de dados com banco Room** ([especificação](planejamento/fase3-v2-dados-room/especificacao.md)).
   - **Conteúdo:**
     - módulo novo `:storage` no Repo 1: Room KMP 2.7.2, arquivo `corenext.db`, sete tabelas no modelo do
       `TechnosAppDatabase` de produção, com `confirmed_key` no lugar da coluna `deleted`;
     - FC e estresse reais no P85 e treinos gravados no relógio;
     - `syncDataHistory` com os cinco tipos, `getHistory*` reais e `deletedSavedData` por categoria;
     - aba Dados do exemplo para validar.
   - **Execução:** o plano original roda 15 fatias em paralelo (cerca de 7,5 h de relógio). Para gastar menos tokens,
     rode em sequência numa sessão só:
     1. banco (S3b e S3c) e histórico na sessão (S3);
     2. FC e estresse (S1) e a parte de saúde da ponte (S4);
     3. Android (S78a e S7b) e aba Dados (S9): primeiro APK para validar;
     4. treinos do relógio (S2a e a parte de treinos da S4);
     5. iOS (S8b);
     6. documentação (S6b e D1) e integração (S10).
   - **Corte, se faltar tempo:** primeiro o iOS, depois os treinos, depois as docs secundárias. O banco no Android, a
     FC e o estresse não se cortam.
4. **Fase 4: troca do Core no Condor.** O que já se sabe:
   - o Condor usa o Core v4.4.5;
   - o adaptador mapeia desparear, trocar de relógio e logout para `forgetDevice`, com o reset conforme a pergunta 2;
   - entram stubs de compatibilidade para o que o Condor chama e o Core Next não tem: o item 9 do
     [`api-js.md`](api-js.md), o `checkIsNotificationServiceEnabled`, o `technosAssets` (item 14) e os três métodos de
     localização;
   - o checklist da fase 4 está na especificação v2;
   - no build Debug do Condor, use o XCFramework release: o debug não liga com o SQLite (resultado do spike);
   - validar no Android e no iPhone.
5. **Validação em campo com testadores** (slide 26 da apresentação):
   - modo campo no Core: gravação em blocos por hora, botão "algo estranho" que marca a hora no log, envio no Wi-Fi;
   - roteiros curtos para os testadores;
   - análise automática com relatório diário;
   - termo de consentimento e regra de guarda, porque os logs têm dado de saúde, sensível pela LGPD;
   - piloto no Condor Reebok.
6. **Itens adiados**, na ordem sugerida:
   1. atividade iniciada pelo app (plano em
      [`planejamento/fase3-v1-atividade/especificacao.md`](planejamento/fase3-v1-atividade/especificacao.md));
   2. notificações do Android;
   3. Health Connect e HealthKit;
   4. GPS e mapa;
   5. mostradores;
   6. atualização de firmware;
   7. música (DP-64);
   8. CDM.
7. **Paridade total com o Core atual** (126 métodos, 5 famílias): UTE e UTERT do zero, histórico V3 do iDO, os demais
   modelos de cada família e a migração modelo a modelo com feature flag (slide "Próximos passos" da apresentação).

## Pendências de documentação da base da fase 3

Achadas na revisão da base, para a próxima fatia que mexer nesses arquivos:

- A tabela de pacotes do `CLAUDE.md` do Repo 1 ainda diz que `profile/` não depende de nada.
- O `CLAUDE.md` do Repo 1 ainda põe as fases 3 e 4 do CRP fora do escopo.
- O [`api-js.md`](api-js.md) não fala dos componentes nem do estado atual dos métodos da fase 3.
- O DP-73 deve citar os componentes em stub.
- O dono do `B2 01` sem pedido é o `CrpActivityControl`.
- O TSDoc da atividade precisa dizer que ela está em stub pelo recorte.

## Viabilidade da paridade total

Avaliação de 2026-11-03:

| Área | Viabilidade | Por quê |
|---|---|---|
| Pareamento, reconexão, tela Dispositivo, ajustes | 95% | provado no P85 e no fitGPS; falta repetir por modelo |
| Sync de histórico e banco | 90% | protocolo mapeado pela captura; desenho pronto; spike do Room verde |
| Health Connect e HealthKit | 95% | só código de plataforma |
| Atividade pelo app, GPS e mapa | 85% | comandos do P85 mapeados na fase 3 v1; GPS e mapa são port da produção |
| Notificações, chamadas, clima, música, encontrar celular | 80% | notificações desenhadas; música do P85 falhou (DP-64) |
| UTE e UTERT | 75% | nada começado: falta SDK descompilado, capturas e relógios |
| EPO/AGPS (iDO com GPS) | 70% | transferência de arquivo; comportamento conhecido |
| Mostradores | 60 a 70% | formato de imagem por fabricante; falta o tipo de compressão do P85 |
| Firmware, implementação própria | 40 a 50% | 6 bibliotecas de chip só no CRP, algumas nativas; risco de inutilizar o relógio |
| Firmware com as bibliotecas de chip | 85 a 90% | sessão isolada que empresta a conexão |

Riscos principais:

- atualização de firmware;
- comportamento escondido da produção: 101 desvios só até a fase 2 do Condor;
- variedade de modelos e firmwares;
- validação manual;
- contratos com os fornecedores;
- segundo plano no Android e no iOS;
- migração de dados na troca;
- toolchain: Room 2.8 só com Kotlin 2.2;
- custo.

Lista completa nos slides 23 a 25 da apresentação.

## Estratégia recomendada: Core Next híbrido

- Protocolo nosso em tudo (pareamento, sync, ajustes, atividade, notificações), sem SDK de fornecedor no build
  principal. O app roda em emulador e simulador, com e2e sobre o relógio simulado (`CrpSimulator` e replay de
  gravações).
- Só o código nativo de fabricante de chip continua como biblioteca (conversão de imagem de mostrador e partes do
  firmware), num módulo opcional carregado sob demanda, com stub onde não roda.

Bibliotecas de fornecedor e emulador, conferido nos binários do TechnosWareCore em 2026-11-03:

| Plataforma | Biblioteca | Para quê | Emulador ou simulador |
|---|---|---|---|
| Android | `libRtkAesJni.so` (Realtek, dentro da crpblelib) | AES da atualização de firmware | sim (x86, x86_64, arm64, armv7) |
| Android | `libezipmy.so` (SiFli) | imagem de mostrador em eZIP | sim |
| Android | `libjl_bmp_convert.so` (Jieli) | bitmap de mostrador | sim |
| Android | `libminilzo.so` e `libnativelib.so` (CRP) | compressão (LZO no fundo do mostrador) | sim |
| Android | SDKs iDO, SMA (com Adups), UTE (ActionsOta), UTERT e Nordic DFU | protocolo e firmware | Java puro |
| iOS | Jieli (`JL_OTALib`, `JLBmpConvertKit`, `JLDialUnit` e outras) | firmware e mostrador | sim (XCFramework com simulador) |
| iOS | Realtek (`RTKOTASDK`, `RTKLEFoundation`, `ABParTool`, `UTERTKLib`) | firmware | não (só aparelho) |
| iOS | `CRPSmartBand` (com LZO e o mostrador SiFli), `OTAFramework`, iDO e UTE | SDKs | não (só aparelho) |

- No Android, o bloqueio do emulador no Core atual vem do SDK do iDO em execução (`AGENTS.md` do app Mormaii), não de
  falta de binário.
- Para o que só roda em aparelho, há três saídas: ligar só no build de aparelho, com stub no simulador; pedir ao
  fornecedor um XCFramework com simulador; ou reimplementar.
- O mostrador personalizado do CRP comprime a foto do jeito que o relógio informa
  (`CRPWatchFaceLayoutInfo.CompressionType`: ORIGINAL, LZO, RGB_LINE, RGB_DEDUPLICATION, JIELI, JIELI_707, SIFLI,
  RTK_8773, BLUETRUM). Se o P85 pedir ORIGINAL ou LZO, não precisa de biblioteca nativa.
- O miniLZO é GPL v2, ou licença comercial do autor: escreva um compressor próprio a partir do formato, sem copiar o
  código.
- Falta mapear o chip de cada modelo e confirmar com o jurídico o que os contratos dos SDKs permitem.

## Como uma chamada atravessa as camadas

Exemplo do `set12HourFormat(true)` (slide 19 da apresentação; desenho em [`arquitetura.md`](arquitetura.md) e no
`docs/arquitetura.md` do Repo 1):

1. JS: `TechnosCore.set12HourFormat(true)` (`src/index.ts`; contrato em `src/specs/NativeCoreNext.ts`).
2. TurboModule: `NativeCoreNextModule.kt` (Android) ou `ios/CoreNext/turbomodule/RCTNativeCoreNext.mm` (iOS), que só
   repassam ao `CoreBridge`.
3. Ponte (Repo 1, `bridge/`): `CoreBridge.set12HourFormat` registra o pedido e cria
   `WatchSetting.TimeFormat(twentyFourHours = false)` pelo `SettingsMapper`.
4. Sessão (Repo 1, `protocol/.../session/`): fila, um comando por vez, até `driver.applySetting`.
5. Tradutor: `CrpDriver`, depois `CrpSettingsWriter`, que monta o frame `FE EA 20 06 17 00` (vetor no
   `CrpSettingsGoldenTest`).
6. Host: `AndroidGattTransport` ou `CentralTransport` escreve no FEE2 do relógio.

O tradutor é escolhido no pareamento: o nome anunciado casa com um perfil (`DeviceRegistry`, `Profiles.kt`), o id do
perfil fica salvo com o pareamento e, a cada conexão, o `Drivers.create` escolhe pela família (SMA, iDO ou CRP). Um
tradutor sem o ajuste responde `NOT_SUPPORTED`. Na volta, a escrita confirmada vira `onCompleted` e a ponte resolve a
Promise; quando o comando tem resposta, ela chega pelo FEE3 e o caminho se inverte.

## Onde está cada coisa

Nos repositórios:

| O quê | Onde |
|---|---|
| Este roteiro | Repo 2, `docs/roadmap.md` |
| Planos, pesquisas e scripts dos workflows de IA | Repo 2, [`docs/planejamento/`](planejamento/README.md) |
| Spike do Room KMP | Repo 1, `spikes/room-kmp/` |
| Desvios de produção (`DP-nn`) | Repo 2, [`desvios-de-producao.md`](desvios-de-producao.md) |
| O que falta validar com o relógio | Repo 1, `docs/pendencias.md`; Repo 2, [`pendencias.md`](pendencias.md) |
| Decisões de protocolo (ADR) | Repo 1, `docs/decisoes.md` |
| Protocolos | Repo 1, `docs/protocolo-sma.md`, `docs/protocolo-ido.md`, `docs/protocolo-crp.md` |
| Contrato JS | Repo 2, [`api-js.md`](api-js.md) |
| iOS | Repo 2, [`ios-pendente.md`](ios-pendente.md) |

Fora dos repositórios, na máquina local (dados privados, nunca versionar):

- `~/technos-capturas/condorreebok/`: captura HCI bruta do app Condor de produção e exports do iPhone;
  `~/technos-capturas/arquivo/logs`, logs das fases encerradas.
- `~/validacao-fase2/`: exports da validação da fase 2 no Android (`fase2-*-android.jsonl`) e a pasta `logs/`.
- Código de referência, só leitura: `~/TechnosWareCore` (tags v4.3.57 e v4.4.5), `~/GTE-CondorSmart`, `~/GTE-Mormaii`,
  `~/smartBackend`, `~/CrpTechnosIosSdk` e `~/CRPBleSdkSample`.
- A crpblelib descompilada era temporária; refaça com o baksmali e o Fernflower que vêm no Android Studio.

Páginas privadas (compartilhe pelo menu Share antes de mandar a alguém):

- Apresentação "Mormaii vs Garmin: rumo a uma SDK própria": https://claude.ai/artifact/PywXR3Qs8YeuejFNZD84aE
  (slide 19: fluxo de dados; 25: decisão; 26: validação em campo).
- Relatório "Pareamento Garmin × Mormaii": https://claude.ai/artifact/SCAQmKFQegQXPquQKqkBKj
- "Fluxo de dados Core + KMP": https://claude.ai/artifact/UGZ2ACehQBa1iTgws3wSDr
