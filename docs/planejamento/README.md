# Planejamento: planos, pesquisas e workflows

Material de planejamento do Core Next, guardado para retomar o trabalho sem depender da conversa que o gerou. O ponto
de entrada é o [`../roadmap.md`](../roadmap.md).

Regra desta pasta: o plano vigente tem uma versão legível em Markdown (`especificacao.md`); o resto é registro (o JSON
original dos workflows de IA, as pesquisas e as críticas). Nada aqui entra no build nem nos testes.

## `fase3-v2-dados-room/` (plano vigente, não implementado)

- [`especificacao.md`](fase3-v2-dados-room/especificacao.md): o plano da fase 3 recortada (banco Room global no Repo 1
  e sync de FC, estresse, SpO2 e treinos), com decisões, esquema, comandos, API, desvios de produção (DP-102 em
  diante), testes, fatias, checklist de validação, riscos e as quatro perguntas sem resposta.
- `spec-v2.json`: o original, com as mudanças da revisão (`changed`) e as críticas rejeitadas (`rejected`).
- `pesquisa-producao-corenext-spike.json`: as três pesquisas (armazenamento da produção com citações do
  `core@v4.3.57`, armazenamento atual do Core Next e o spike do Room KMP).
- `rascunho-e-criticas.json`: o rascunho e as críticas de paridade e de engenharia.
- `base-result.json`: o que o workflow da base da fase 3 fez (contrato JS, stubs e métodos nativos, hoje sem commit).
- [`decisoes-usuario.md`](fase3-v2-dados-room/decisoes-usuario.md): o recorte do escopo de 2026-11-03, com o texto do
  usuário e a interpretação adotada.
- O spike do Room está no Repo 1, em `spikes/room-kmp/`.

## `fase3-v1-atividade/` (substituída)

- [`especificacao.md`](fase3-v1-atividade/especificacao.md): o plano anterior ao recorte (atividade iniciada pelo
  app, FC, estresse e treinos). Continua sendo o ponto de partida da atividade, que foi adiada.
- `spec.json` (só a especificação) e `full.json` (pesquisa, rascunho, críticas e revisão).

## `fase2/` (implementada e commitada)

- `spec.json`, `research.json` e `decisoes-usuario.md` da fase 2 do Condor (tela Dispositivo). O que valeu está no
  código, no [`../api-js.md`](../api-js.md) e no [`../desvios-de-producao.md`](../desvios-de-producao.md).

## `validacao-android-fase2/` (pendente: fixtures da S9)

- [`notas-s9.md`](validacao-android-fase2/notas-s9.md): achados da validação da fase 2 no Android, para escrever o
  `CrpPhase2FixtureTest`.
- `scripts/`: leitura dos exports do app de exemplo. Os exports ficam fora do repositório (os `logs-*.jsonl` têm o MAC
  do relógio); rode com `python3 -I` e com o export numa pasta isolada.

## `workflows/` (registro)

- Os scripts dos workflows de IA (Claude Code) que planejaram e implementaram cada fase, com os prompts. Servem para
  entender como cada fase foi conduzida e para reaproveitar prompts.
- Eles citam caminhos da máquina e da pasta temporária da sessão (`$SCRATCH`), que não existem mais. O endereço do
  relógio e o rótulo do aparelho na captura HCI, que apareciam em dois deles, foram trocados por `XX:XX:XX:XX:XX:XX`
  e `dev-xxxxxx`.

Nada aqui tem MAC, nome de aparelho ou dado pessoal da captura HCI. Mantenha assim.
