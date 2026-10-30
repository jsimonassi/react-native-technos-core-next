# `log/` (iOS)

O `WatchLogger` do Core iOS e a gravação de frames. Par do `log/` do Android, com o mesmo formato de export.

## Tipos

| Tipo | Papel |
|---|---|
| `RingLogger` | Anel de 2000 entradas, `os_log` (subsistema `br.com.grupotechnos.corenext`, categoria `CoreNext`) e o `onEntry`, que o `CoreGraph` liga ao `CoreBridge.onLogEntry` (evento `onLog`). Entradas abaixo do nível do `setLogLevel` são descartadas. Pacotes GATT viram entradas `DEBUG` com `dir` e `hex` (tag `Frame/<uuid curto>`) e vão sempre para o `FrameRecorder`. `write(to:)` grava o anel em `.jsonl` (uma entrada por linha). |
| `LogEntry` | Uma linha do anel; `coreLogEntry` é a forma do `:bridge`. |
| `FrameRecorder` | Pacotes crus em memória no formato de fixture do Repo 1 (`FrameJsonl`), até 50 mil; `write(to:)` grava o cabeçalho (`platform` `ios`, `recordedAt` com milissegundos e offset numérico, MTU, firmware) e os pacotes. |

## Thread-safety

O logger é chamado de mais de uma thread ao mesmo tempo (a da sessão, a de quem chama `getStepsDays` e afins, a fila do
Bluetooth). Anel, nível e `onEntry` ficam atrás de um `NSLock`; o `onEntry` roda fora da trava, porque o `CoreBridge`
pode logar de novo de dentro dele. Nada aqui lança nem chama `fatalError`.

## Export

`IosCoreHost.exportLogs` grava `frames-<yyyyMMdd-HHmmss>.jsonl` e `logs-<mesmo carimbo>.jsonl` em
`Documents/corenext/` e devolve o caminho do de frames. No app de exemplo a pasta aparece no app Arquivos (No meu
iPhone → CoreNextExample → corenext), porque o `Info.plist` tem `UIFileSharingEnabled` e
`LSSupportsOpeningDocumentsInPlace`. O `logs-*.jsonl` não tem MAC no iOS (o endereço é o UUID do periférico, que o
iOS gera por app), mas continua fora do git, como no Android.

**Um cabeçalho por export.** `device` e `firmware` são os do último relógio que chegou ao handshake (o `CoreBridge`
nomeia o relógio só quando a sessão chega em `HANDSHAKING`, e apaga o firmware ao trocar de relógio; ADR 24 do Repo 1), e o
`mtu` é o `currentMtu` do transporte na hora do export, que volta a 23 a cada tentativa de conexão (mesmo uma que
falha). Os pacotes são todos os gravados desde o último `clearLogs`: entre um relógio e outro, `Export` e `Clear`, senão
os pacotes do primeiro saem sob o cabeçalho do segundo (`docs/fixtures.md` do Repo 1, seção 3.1).

## Testes

`StoreAndLogTests` (`../../Tests/`): 8 threads logando ao mesmo tempo, nível, pacote gravado abaixo do nível, formato
do cabeçalho lido de volta pelo leitor de fixture.
