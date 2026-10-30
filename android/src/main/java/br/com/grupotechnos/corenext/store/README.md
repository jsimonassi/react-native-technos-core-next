# `store/`

Persistência local do Core Android.

## Tipos

| Tipo | Papel |
|---|---|
| `FileSampleStore` | `SampleStore` do Repo 1 em JSON, em `context.filesDir/corenext/`: `steps.json`, `sleep.json`, `confirmed-steps.json`, `confirmed-sleep.json`. Escrita atômica (`.tmp` + `fsync` + rename). |
| `SampleJsonCodec` | Formato dos arquivos (`{"version":1,"items":[...]}`) com `org.json`. Item inválido é pulado, não derruba o arquivo. |
| `PairingPrefs` | `SharedPreferences` `"corenext.pairing"`: `address`, `profileId`, `name`. Gravado ao chegar em `READY` (nunca depois de um disconnect/forget do usuário), apagado no `forgetDevice` e de novo quando ele termina. |

## Por que existe o histórico local

O relógio pode não devolver o histórico inteiro a cada leitura (o cursor pode avançar depois do ACK). A sessão grava
aqui tudo o que leu; `getHistoryPedometer`/`getHistorySleep` respondem a partir daqui, filtrando os dias já
confirmados por `deletedSavedData`. O Core atual faz o mesmo em `SharedPreferences` (`SMADataRepository.java`).

## Não faz

Não agrega, não deduplica, não poda: isso é da sessão (Repo 1), que lê e regrava a lista inteira. Não faz migração
de dados do Core atual (`SMADATAREPOSITORYLABEL`).

## Depende de

Repo 1 (`session/SampleStore`, `domain/`), `org.json` e `SharedPreferences` do Android. Montado pelo `CoreGraph`; o
`FileSampleStore` é o `SampleStore` da sessão, e o `PairingPrefs` é lido e gravado pelo `AndroidCoreHost` (quando, o
`CoreBridge` decide).

## Invariantes

- Chamado na thread da sessão; IO síncrono é permitido (contrato do `SampleStore`).
- Arquivo ilegível vira lista vazia com `WARN`, nunca exceção.
- `clear()` apaga os quatro arquivos (chamado pela sessão em `disconnect(forget = true)`).

## Testes

`FileSampleStoreTest` (round-trip de todos os tipos, arquivo corrompido, item inválido, `clear`), com o `org.json`
real como `testImplementation`.
