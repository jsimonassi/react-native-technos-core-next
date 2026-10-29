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
  uma linha por pacote (`dir`, `atMs`, `characteristic`, `hex`). É o arquivo que vai para
  `technos-watch-protocol/.../fixtures/real/fitgps/<fw>/`.
- `logs-<yyyyMMdd-HHmmss>.jsonl`: o anel, uma entrada JSON por linha.

Para puxar sem root: `adb pull /sdcard/Android/data/<applicationId>/files/corenext/`.

## Não faz

Não grava em banco nem envia para servidor. Não filtra a gravação de frames pelo nível de log: a gravação é sempre
completa.

## Depende de

Repo 1 (`log/WatchLogger`, `log/FrameJsonl`), `android.util.Log`, `org.json`. Usado pelo `CoreGraph` (que liga o
`onEntry` ao evento `onLog`).

## Testes

`RingLoggerTest` (anel, filtro, frames, cabeçalho do fixture, limite, exportação).
