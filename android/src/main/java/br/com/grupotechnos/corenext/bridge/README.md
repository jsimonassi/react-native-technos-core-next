# `bridge/`

Tradução entre o domínio do Repo 1 e o que o JavaScript recebe. Quase tudo aqui é Kotlin puro, testado na JVM.

## Tipos

| Tipo | Papel |
|---|---|
| `EventMapper` | Domínio → `Map<String, Any?>` nos formatos de `src/types/events.ts` (mesmos nomes do Core atual). Datas ISO `yyyy-MM-dd'T'HH:mm:ssXXX`. |
| `WritableConverter` | `Map`/`List` → `WritableMap`/`WritableArray` (precisa do runtime do RN; único arquivo daqui não testado na JVM). |
| `StateMapper` | `ConnectionState` → `deviceConnectStates`: `DISCONNECTED`/`RECONNECTING` 0, `CONNECTING`/`CONFIGURING`/`HANDSHAKING` 1, `READY`/`SYNCING` 2, `BLUETOOTH_OFF` 4. |
| `PendingEvents` | Fila de eventos até o módulo poder emitir (callback do codegen instalado e instância React ativa). Não troca de thread: emitir da thread da sessão é seguro no RN 0.81. |
| `RequestRegistry` | `requestId` → Promise + nome do método, liquidado uma única vez. |
| `SavedDataMapper` | `deletedSavedData`: categoria (5 passos, 0 sono) → `DataKind`; `registered_at` ISO → dia local. |
| `HostErrorCodes` | Códigos que nascem no host: `PERMISSION_DENIED`, `BLUETOOTH_OFF`, `INVALID_ARGUMENT`, `IO_ERROR`. |

## Não faz

Não conhece BLE nem arquivo. Não decide nada sobre o relógio: só muda forma de dado.

## Depende de

Repo 1 (`domain/`, `profile/`, `log/`), `react-android` só em `WritableConverter`. Usado pelo módulo, pelo
`CoreGraph` e pelo `CoreSessionListener`.

## Invariantes

- Os nomes de campo seguem `src/types/events.ts`. Mudou lá, muda aqui no mesmo PR (e o `EventMapperTest`).
- Inteiros saem como `Int`, decimais como `Double`, `Long` (epoch millis) como `Double`.

## Testes

`EventMapperTest`, `StateMapperTest`, `SavedDataMapperTest`, `PendingEventsTest`, `RequestRegistryTest`.
