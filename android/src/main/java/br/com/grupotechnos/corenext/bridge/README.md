# `bridge/`

O lado React Native da ponte: converte entre os tipos do RN e os valores puros que o `CoreBridge` do Repo 1 (pacote
`br.com.grupotechnos.watch.bridge`, módulo `:bridge`) recebe e devolve. O mapeamento do domínio para os payloads
(`EventMapper`), os estados, o `deletedSavedData`, os códigos de erro do host, a fila de eventos e os pedidos em
andamento estavam aqui até 2026-10-29 e hoje moram lá (`docs/arquitetura.md`, "O que mora onde").

## Tipos

| Tipo | Papel |
|---|---|
| `WritableConverter` | `Map`/`List` → `WritableMap`/`WritableArray` (os payloads dos eventos e os retornos com objeto). Precisa do runtime nativo do RN; não é testado na JVM. |
| `ReadableConverter` | `ReadableArray`/`ReadableMap` → `List`/`Map` pelo `getType` de cada valor (número sempre `Double`), para o `deletedSavedData` e para os dicionários e listas dos 24 métodos da fase 2 (`toMap` nos `ReadableMap`, `toList` nos `ReadableArray`). Não usa o `toArrayList()`, cujo tipo de item varia com a implementação (o `JavaOnlyArray` devolve o `JavaOnlyMap` aninhado, que não é `java.util.Map`). |
| `PromiseCompletion` | A `Promise` do RN como `CoreCompletion`: mapas e listas pelo `WritableConverter`, o resto (`null`, `Boolean`, `String`) como está; `reject(code, message)`. |

## Não faz

Não decide nada (é o `CoreBridge`), não conhece BLE nem arquivo, não mapeia o domínio. Na fase 2, não lê nenhuma
chave dos dicionários: nomes (`enable` no alarme, `onOff` no sedentarismo), padrões de chave ausente, booleano como
número, `"HH:mm"`, faixas e `INVALID_ARGUMENT` são do `SettingsMapper`, do `NotificationKeys` e do `WeatherMapper` do
`:bridge` (D7; ADR 38 do Repo 1).

## Depende de

`react-android` e o `:bridge` do Repo 1 (`CoreCompletion`). Usado pelo `NativeCoreNextModule`.

## Invariantes

- Os tipos de valor que entram no `WritableConverter` são os do `EventMapper` do Repo 1: inteiros como `Int`,
  decimais como `Double`, `Long` (epoch millis) como `Double`, `String`, `Boolean`, `null`, mapas e listas.
- Um `PromiseCompletion` por chamada JS; o `CoreBridge` chama `resolve` ou `reject` uma vez só.
- O `ReadableConverter` não interpreta: um booleano mandado como número sai `Double`, um elemento nulo de lista sai
  `null` na mesma posição, uma chave ausente fica ausente e a ordem das chaves é a do mapa de origem.
- Um argumento `null`/`undefined` do JS no lugar de um mapa, lista ou texto nem chega aqui: o RN o entrega como `null`,
  a checagem de parâmetro não nulo do Kotlin no `NativeCoreNextModule` lança antes da conversão e o RN 0.81 rejeita a
  Promise com um `Error` sem `code` e sem `onError` (DP-99 do `docs/desvios-de-producao.md`).

## Testes

`ReadableConverterTest` e `PromiseCompletionTest` (o caminho sem mapa nem lista; o resto precisa da biblioteca nativa
do RN). O `ReadableConverterTest` cobre os tipos simples, mapas e listas aninhados, nulos dentro de mapas e a forma
dos argumentos da fase 2: uma lista de mapas com booleanos e números misturados, um objeto aninhado e um elemento nulo
no meio, e um dicionário com objeto aninhado e lista de mapas (sem coerção de tipo e na ordem do mapa de origem). O
`ReadableConverter` também passa pelo `DeletedSavedDataEquivalenceTest` da raiz.
