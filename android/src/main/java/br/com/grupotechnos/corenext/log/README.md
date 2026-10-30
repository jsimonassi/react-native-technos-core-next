# `log/`

Log de diagnóstico do Core e gravação do tráfego GATT para virar fixture do Repo 1.

## Tipos

| Tipo | Papel |
|---|---|
| `RingLogger` | `WatchLogger` do Repo 1. Anel de 2000 entradas, Logcat (tag `CoreNext`), evento `onLog`. Respeita `setLogLevel` (0 DEBUG, 1 INFO, 2 WARN, 3 ERROR). Pacotes GATT viram entradas `DEBUG` com `dir` (`TX`/`RX`) e `hex`. |
| `FrameRecorder` | Pacotes crus em memória no formato `FrameJsonl` do Repo 1; vira arquivo em `exportLogs()`. Para (com `WARN`) ao chegar em 50 mil pacotes, porque fixture sem o começo não serve para replay. |

## Arquivos exportados

`exportLogs()` grava em `getExternalFilesDir(null)/corenext/` (cai para `filesDir` se o armazenamento externo do app
não estiver disponível) e devolve o caminho do primeiro:

- `frames-<yyyyMMdd-HHmmss>.jsonl`: cabeçalho (`device`, `firmware`, `platform`, `mtu`, `recordedAt`, `timeZone`) e
  uma linha por pacote (`dir`, `atMs`, `characteristic`, `hex`). O `recordedAt` é o instante do primeiro pacote
  (atMs 0) em `yyyy-MM-dd'T'HH:mm:ss.SSSxxx`, com milissegundos e offset numérico mesmo em UTC
  (`2026-10-29T08:14:10.933-03:00`, `2026-10-28T17:30:00.000+00:00`). É o arquivo que vai para
  `technos-watch-protocol/fixtures/real/fitgps/<fw>/<cenário>.jsonl`: só o export mais recente de cada cenário,
  porque cada export traz tudo desde o último `Clear` e o anterior é prefixo dele. O cabeçalho é um só: `device` e
  `firmware` do último relógio cujo link abriu (ADR 24 do Repo 1) e o `mtu` do transporte na hora do export; trocar de
  relógio sem `Export` e `Clear` deixa os pacotes do primeiro sob o cabeçalho do segundo.
- `logs-<yyyyMMdd-HHmmss>.jsonl`: o anel, uma entrada JSON por linha. Tem o MAC do relógio: nunca versionar.

Para puxar sem root: `adb pull /sdcard/Android/data/<applicationId>/files/corenext/`.

## Não faz

Não grava em banco nem envia para servidor. Não filtra a gravação de frames pelo nível de log: a gravação é sempre
completa.

## Depende de

Repo 1 (`log/WatchLogger`, `log/FrameJsonl`), `android.util.Log`, `org.json`. Montado pelo `CoreGraph`, que liga o
`onEntry` ao `CoreBridge.onLogEntry` (o evento `onLog`); o `AndroidCoreHost` lê o anel (`getLogs`), muda o nível,
limpa, exporta e preenche o cabeçalho da gravação.

## Testes

`RingLoggerTest` (anel, filtro, frames, cabeçalho do fixture, limite, exportação).
