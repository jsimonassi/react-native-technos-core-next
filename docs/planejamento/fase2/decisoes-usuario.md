# Decisões do usuário para a fase 2 (2026-11-01, noite)

Respostas literais do usuário às 5 perguntas da especificação (`spec.json`, chave `userQuestions`):

> 1 sim
>
> 2 A -> Mas deixe anotado em um doc de pendências tudo que tiver comportamento diferente do de produção. PRa que a gente volte depois pra corrigir isso.
>
> 3 fora -> De acordo. Anote a pendência no doc.
>
> 4 HFP -> Concordo. Note que o relógio Force também usa essa SDK. Anote como pendência essa validação pra que a gente revisite quando olhar esse relógio. Ele usa CRP, mas não tem bluetooth clássico. Só BLE.
>
> 5 portar
>
> Tudo que desviar do comportamento original entra como pendência pra revisão futura.
>
> Pode seguir com a fase 2.

O que cada resposta decide (as recomendações que o usuário aceitou):

1. **Encaminhamento de notificações no Android: entra até 5/11**, como fatia própria (~1 dia) depois da fase 2, em paralelo à fase 3. NÃO faz parte da implementação da fase 2. Inclui NotificationListenerService, tabela de apps, migração do filtro antigo e, se o P85 usar o RX 67, o controle de música por BLE. Enquanto não entrar, o `checkIsNotificationServiceEnabled` do Android resolve true (D18). Quando entrar: corrigir o SMS (respeitar o botão de SMS em vez de seguir o "Outros") e só mandar acentos se o relógio exibir direito (testar na validação); os dois são desvios de produção e entram no doc de desvios. O serviço de notificações ligado também mantém o processo vivo em segundo plano (regra do Garmin), o que ajuda sem o CDM.
2. **Encontrar celular: opção A** (só o evento `onFindPhone` para o JS; o Condor toca o `alarm.mp3`; sem tela cheia, lanterna ou vibração; no Android em segundo plano só com o processo vivo). É desvio de produção: anotar.
3. **Câmera disparada pelo relógio com o app em segundo plano no Android: fora até 5/11.** Desvio de produção: anotar.
4. **Ligações: só HFP** (o P85 toca pelo Bluetooth clássico; sem a notificação de ligação pelo `0x41`, para não tocar duas vezes). Desvio de produção: anotar. **Pendência extra pedida pelo usuário:** o relógio **Force** também usa a SDK CRP, mas **não tem Bluetooth clássico, só BLE**; para ele, as ligações (e tudo que no P85 depende do clássico: HFP, AVRCP de música, o vínculo clássico do pareamento) precisam ser revalidadas quando o Force entrar. O codec `0x41`/`41 FF` da fatia S3 é o caminho provável para as ligações no Force.
5. **Clima na fase 4: portar o `TechnosDeviceLocationManager` (o `getCurrentGeolocation`) do Core antigo para o Repo 2.** Fase 4, não fase 2.

Regra geral do usuário: **tudo que desviar do comportamento original (o Core de produção, `TechnosWareCore`, e o app Condor de produção) entra como pendência para revisão futura**, num doc de pendências dedicado. Isso inclui os desvios já decididos nas fases 1 e 2 (esquecer sem reset de fábrica, bugs não copiados do D8, consultas de leitura de volta fora, stubs de compatibilidade do D18, fila serial que atrasa o `vibrateDevice` durante o sync, sem FGS persistente, sem CDM etc.), não só os destas 5 respostas.

Decisão anterior (2026-11-01, ADR 33 do Repo 1): esquecer e reset de fábrica ficam como **métodos separados** no Core Next. O reset de fábrica entra na fase 2 como método próprio, com o nome do Core (`resetDevice`, `TechnosWareCore/src/NativeModules/specs/NativeCore.ts:121`, lá `() => void`; aqui `Promise<void>` como os demais), CRP `51 02`, sem resposta do relógio; SMA e iDO rejeitam NOT_SUPPORTED.
