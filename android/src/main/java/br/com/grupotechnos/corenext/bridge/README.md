# `bridge/`

O lado React Native da ponte: converte entre os tipos do RN e os valores puros que o `CoreBridge` do Repo 1 (pacote
`br.com.grupotechnos.watch.bridge`, módulo `:bridge`) recebe e devolve. O mapeamento do domínio para os payloads
(`EventMapper`), os estados, o `deletedSavedData`, os códigos de erro do host, a fila de eventos e os pedidos em
andamento estavam aqui até 2026-10-29 e hoje moram lá (`docs/arquitetura.md`, "O que mora onde").

## Tipos

| Tipo | Papel |
|---|---|
| `WritableConverter` | `Map`/`List` → `WritableMap`/`WritableArray` (os payloads dos eventos e os retornos com objeto). Precisa do runtime nativo do RN; não é testado na JVM. |
| `ReadableConverter` | `ReadableArray`/`ReadableMap` → `List`/`Map` pelo `getType` de cada valor (número sempre `Double`), para o `deletedSavedData`. Não usa o `toArrayList()`, cujo tipo de item varia com a implementação (o `JavaOnlyArray` devolve o `JavaOnlyMap` aninhado, que não é `java.util.Map`). |
| `PromiseCompletion` | A `Promise` do RN como `CoreCompletion`: mapas e listas pelo `WritableConverter`, o resto (`null`, `Boolean`, `String`) como está; `reject(code, message)`. |

## Não faz

Não decide nada (é o `CoreBridge`), não conhece BLE nem arquivo, não mapeia o domínio.

## Depende de

`react-android` e o `:bridge` do Repo 1 (`CoreCompletion`). Usado pelo `NativeCoreNextModule`.

## Invariantes

- Os tipos de valor que entram no `WritableConverter` são os do `EventMapper` do Repo 1: inteiros como `Int`,
  decimais como `Double`, `Long` (epoch millis) como `Double`, `String`, `Boolean`, `null`, mapas e listas.
- Um `PromiseCompletion` por chamada JS; o `CoreBridge` chama `resolve` ou `reject` uma vez só.

## Testes

`ReadableConverterTest` e `PromiseCompletionTest` (o caminho sem mapa nem lista; o resto precisa da biblioteca nativa
do RN). O `ReadableConverter` também passa pelo `DeletedSavedDataEquivalenceTest` da raiz.
