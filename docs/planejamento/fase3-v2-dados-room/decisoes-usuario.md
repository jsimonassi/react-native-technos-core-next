# Decisões do usuário sobre a fase 3 (2026-11-03, ~01:30)

Texto do usuário:

> Não me importaria de fazer apenas pareamento, sincronização de dados (Com um room database global, semelhante ao
> technos data storage de produção), sincronização e as informações da tela de dispositivos.
>
> Todo o restante, como atividades, notificações, mostradores, atualização de firmware e similares... Pode esperar.

Interpretação adotada (o usuário pode corrigir):

- Escopo até 2026-11-05: pareamento (fase 1, feito), informações da tela Dispositivo (fase 2, feita no Android),
  sincronização de dados e o fluxo de sync. Depois, a troca do Core no Condor (fase 4) com só isso ligado.
- "Sincronização de dados" = tudo o que o sync do Condor busca do relógio e manda à API
  (condor:store/LowerLevelContext/SyncHandlerStoreContext/useSyncHandlerData/useSyncStepsRunner.ts:78-112):
  passos, sono, FC, estresse, SpO2 (vazio no P85, como na produção) e os treinos gravados no relógio
  (syncHistoryActivityFromWatch → getHistoryActivityV2).
- Persistência: um banco Room global, no modelo do TechnosAppDatabase/DataStorage da produção
  (TechnosWareCore v4.3.57 android/src/main/java/com/reactlibrary/dataStorage/), com tabelas por tipo de dado, comum a
  todas as famílias (SMA, iDO, CRP), substituindo os arquivos JSON do FileSampleStore.
- Fora (espera): atividade iniciada pelo app (start/pause/resume/stop e eventos), GPS, mapa, encaminhamento de
  notificações do Android, mostradores, atualização de firmware e similares. Health Connect/HealthKit também esperam.
- O contrato JS da fase 3 (S0/S6a/S0h) fica, com a atividade em stub: o Condor precisa que os métodos, eventos, enums e
  componentes existam para compilar na fase 4.
- As perguntas 1 a 3 da especificação ficam respondidas por isso: GPS fora, Health Connect/HealthKit fora, atividade do
  app fora (stub da S0).
