# Validação fase 2, Android, 2026-11-02 (notas para S9)

Export: Repo 2 root `frames-20261102-214205.jsonl` (cenário fase2-ajustes, começa num FIRST_PAIR; 216 linhas; 0 MAC;
12 e 75 zerados). Cópia isolada em `ajustes-in/`. Sem WARN/ERROR no log.

Usuário: F1–F14 "funciona".

- F1: 17 00 = 12 h confirmado (o relógio ficou em 12 h: 17 00, 17 01, 17 00).
- F2: 7C 01 → 8C → RX 8C 01; 7C 00 → RX 8C 00. Clima só no M6/M7.
- F4: 7D 05/0A/14/19/1E todos honrados (faixa 5–30 s).
- F5: A4 01 01 (on) e A4 00 01 (off): byte [1] = 01 nos dois. RX F9 02 00 + F9 01 00 00 logo após o on.
- F6: BB 08 01 01 (on) depois 00 (off); sem RX A1. SOS ficou desligado.
- F7: RX 82 ~200 ms depois de cada 72, sem 28: [início LE16 min][fim LE16 min] (C2 01 64 05 = 450/1380 =
  07:30–23:00; 69 05 05 00 = 23:05–00:05). SDK: m/a.java case -126 → onPeriodTime(2, CRPPeriodTimeInfo). Hoje
  o driver registra "unsolicited 82 UNKNOWN". Candidato a confirmação do 72 (como 8C/2D) e a nomear no CrpCommand.
- F8: relógio mostrou menstruação 16–20/11, janela fértil 28/10–06/11, ovulação 30/11 (a próxima), hoje = "Day 6,
  ovulation". Coerente com 28/5 e início ≡ 9/3 mod 28. NÃO distingue 9/2 de 9/3 (fev/2026 tem 28 dias): o erro
  plausível (mês 1-12 em vez de 0-11) não aparece. Discriminar com início em 9/4: certo → 19–23/11; errado → 16–20/11.
  "Silenciar" (flags F0, data de hoje) removeu a config do relógio; bytes iguais aos da produção (flags sem 07).
- F9: rajadas de 2A37 a cada ~300 s depois do 1F 01; nenhuma nos ~575 s depois do 1F 00.
- F10: B9 11 01 01 / 00 confirmados. F11: 71 21:33-22:34, 22:00-07:30, 00:00-00:00. F13: 2D 01/00.
- F12: 77 01 01 15 25 08 0A 00 (count 8), 77 01 01 15 27 00 0A 00 (count 0), 77 01 00 08 00 00 3C 00 (off).
  Resultado do count 0 pendente com o usuário.
- F14: 12 zerado; B9 00 00 01 40 1F … 02 5E 01 … 04 2D … (8000/350/45).
- RX 64 vazio ×3 (144 s, 499 s, 501 s): SDK m/a.java case 100 → CRPWeatherChangeListener.onUpdateWeather (relógio
  pede clima). Produção Android ignora (CRPService.java:1373-1376, corpo vazio) → paridade; vai em "Conferido".
- RX 6D FF ×2 de novo (2176 s), sem pedido.
- Bateria 31% → 19% em 46 min.

## fase2-mensagens (export ~/validacao-fase2/fase2-mensagens-android.jsonl, Clear às 21:52:01; 0 MAC; 43/B5/42
zerados, F2 02 só com 02 + id; sem WARN/ERROR)

Usuário: M1/M2 "parece ok, confirme pelos logs"; M3–M7 funcionou.

- M1: B9 14 00 → RX B9 14 00 15 + 21 códigos (00..0C, 0E, 0F, 11, 14, 1F, 0D, 2D, 80) em 140 ms; byte [1] = 00,
  [2] = 0x15 = contagem. B9 04 com 12 de 21 ligados: sem app na tabela 03 09 0A 0B 0D; fora do "Tudo" sintético
  WeChat 02, Skype 07, Viber 0F, Snapchat 1F. Chaves do Condor sem tipo no relógio: WhatsApp Business, Google
  Calendar, Default Calendar, YouTube, LinkedIn.
- M2: B9 04 com 11 de 21 (só a posição 8 = WhatsApp muda) e volta a 12.
- M3: B9 05 03 + 3 × B9 05 00 (#0 06:45 3E, #1 07:00 7F, #2 21:55 once BB 02). O P85 mandou sozinho B9 15 04
  (lista: 03 + 3 entradas de 8 bytes) às 21:55:01, quando o único tocou, com o #2 já desligado. Driver ignora
  ("unsolicited B9/15/04"); produção não tem listener de alarme (grep vazio no CRPService) → paridade.
  Limpar = B9 05 03 sozinho.
- M4: BB 00 03 apaga (consulta BB 00 00 → 06 02 01 02 → 06 01 01 → 06 00). Payload BB 00 02: id, offset s LE32
  (+32400 / −10800), lon e lat ×1e6 LE32, 4 bytes (C0 A8 00 00 em Tóquio, 0 em Buenos Aires), nome UTF-8.
- M5: F2 00 → F2 00 08 00 00 14 (8 contatos, avatar 0x0, nome 20). F2 EF → F2 FE FF 00 em 683 ms (id FF ≠ id 0:
  dá para distinguir o ack do apagar do ack do contato 0, resolve o DP-53). Um F2 FE por contato (55 e 595 ms).
  Ligação HFP pelo relógio: F9 01 01 00 → 01 01 01 → F9 02 01 a cada ~5 s. O "Limpar" (setAddressBook([])) NÃO
  aparece no export nem no log (nenhum applySetting:Contacts #47): não apertado ou perdido antes da ponte; perguntar.
- M6: 8C → 8C 00 → 43, B5 00, 42 (°C, 7 dias). Lista vazia sem TX. RX 64 de novo 12 s depois.
- M7: 7C 01 → 8C 01 → reenvio 8C, 43, B5, 42 em °F; idem °C. Sem TIMEOUT.

## fase2-interacoes (export ~/validacao-fase2/fase2-interacoes-android.jsonl, Clear às 22:03:01; 0 MAC; sem WARN)

- I1: 61 ×2, nenhum RX 61. Usuário: um som e ~2 s de vibração, ~2 pulsos.
- I2: TX 66 sem eco (próximo RX 66 é o disparo, 18 s depois). Disparos → onTakeAPicture ×2. Saída pelo relógio:
  RX 53 0E FF (byte [1] = 0E, [2] = FF). Abrir pelo menu do relógio não manda nada (usuário notou); disparos depois →
  onDeviceRequestedCameraMode ×4. O passo final (Abrir câmera + Fechar câmera pelo app) NÃO foi feito: nenhum
  TX 53 0E no export (closeCameraMode nunca visto no ar). Pedido ao usuário.
- I3: RX 62 00 → start, 62 FF → stop 7,5 s depois (1 byte). F9 01 00 00 (clássico cai) logo depois do start e
  F9 01 01 00 / 01 01 01 (volta) ~14 s depois.
- I4: RX 67 06, 02, 01, 06 (MUSIC_PLAY, NEXT, PREVIOUS, PLAY; CRPPhoneOperationType). Nenhum 04/05 (volume): os
  botões de volume não mandam nada por BLE; usuário: volume do telefone não muda. Produção Android trata 67
  (CRPService.java:1937-1956, musicControlHandler: 6/7 toggle, 2 next, 1 previous, 4/5 volume; 0 não tratado);
  Core Next ignora (DP-64). Perguntado se play/next/prev funcionaram no player (decide se a fatia BLE é obrigatória).
- Bateria 18% → 17%.

## fase2-extras (export de 22:23, ~/validacao-fase2/fase2-extras-android.jsonl, depois de um Clear; 0 MAC)

- I2 final: TX 66, TX 53 0E → RX 53 0E FF em 247 ms (o relógio ecoa a saída também no fechar pelo app; a ponte trata
  como CameraExited com o modo já fechado, sem evento JS). closeCameraMode confirmado no ar.
- M5 Limpar: setAddressBook([]) → só F2 EF → F2 FE FF 00 em 670 ms (sem F2 00). Agenda esvaziou (usuário).
- I4 (usuário): nome da música aparece; tocar/pausar/próxima/anterior não funcionam; volume muda, errado. Registrado
  em DP-64 (status aceito pelo usuário, prioridade baixa) e no pendencias.md §8 do Repo 2. I4 no iPhone opcional.
- Bateria 15%.

## gerais (export ~/validacao-fase2/fase2-gerais-android.jsonl; o cabeçalho virou Mormaii_fitGPS no pareamento do
G1, com pacotes do P85 antes; só serve para olhar; 0 MAC; WARN só os esperados)

- G2: openCameraMode em RECONNECTING → NOT_READY com onError; closeCameraMode resolve sem escrever.
- G3: ajustes pedidos durante o sync (MoveReminder, TimeFormat, TemperatureUnit) esperam o fim do sync e saem em
  ordem. O caso da câmera aberta e fechada DURANTE o sync não apareceu (abrir/fechar foram em READY); coberto só
  pelos testes de unidade.
- G4: 20 ajustes depois do sync, sem erro nem TIMEOUT; fila ocupada 10,2 s (janela de 27,6 s com o ritmo dos
  toques). Acima da estimativa de 5–8 s; cada frame CRP custa ~210 ms. Olhar na fase 4 se o Condor espera o fim.
- A4 do F5 desta vez = A4 01 00 (byte [1] = 00; antes 01 nos dois): o byte [1] varia; talvez carregando.
- Forget no P85 (F8 + removeBond) às 22:36:51, depois pareamento do fitGPS (FIRST_PAIR, MTU 23).
- G1: fitGPS → vibrateDevice e openCameraMode NOT_SUPPORTED com onError, nenhum TX além do handshake e do setTime.
- 6D FF de novo às 22:36:41.

## F12 refeito (export ~/validacao-fase2/fase2-f12-android.jsonl, Clear às 22:53:18)

- 77 01 01 16 37 08 0A 00 (22:53:31, início 22:55, 8 copos), 77 01 01 16 37 00 0A 00 (22:53:39, 0 copos),
  77 01 00 08 00 00 3C 00 (22:53:41, desligado): o desligar saiu 2 s depois, antes das 22:55. O resultado com 0 copos
  continua sem observação; refazer só o "count 0" e esperar 2 min.
- Usuário (22:5x): "desconectei o fitGPS e o relógio resetou sozinho". O momento não está no export (Clear depois).
  No export: o vínculo clássico do P85 no repareamento falhou 2 vezes (bond 11 -> 10, reason=4 =
  UNBOND_REASON_REMOTE_DEVICE_DOWN, CLASSIC_BOND_FAILED), compatível com o P85 reiniciando. Perguntado qual relógio.
