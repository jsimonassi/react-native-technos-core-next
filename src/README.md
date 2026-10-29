# `src/`: camada JavaScript

Wrapper fino sobre o TurboModule `NativeCoreNext`. Dá ao app os mesmos nomes do Core atual (`TechnosCore`,
`TechnosEvents`, `utils`, `deviceConnectStates`, `deletedCategory`) com tipos, e o mock oficial para Jest.
Referência completa de métodos e eventos: [`docs/api-js.md`](../docs/api-js.md).

## O que fica fora

Nenhuma regra de protocolo, BLE ou permissão. Estado também não: o wrapper não guarda último valor de evento nem
cache; quem precisa disso é o app (o exemplo faz em `example/src/hooks/useCoreEvents.ts`).

## Arquivos

| Arquivo | Conteúdo | Dono |
|---|---|---|
| `specs/NativeCoreNext.ts` | Spec do TurboModule (codegen). Contrato. | lead |
| `types/events.ts` | Formato de cada evento. Contrato com `android/.../bridge/EventMapper.kt`. | lead |
| `types/emitter.ts` | `TechnosEventEmitter`, `TechnosEventMap` (payload por nome de evento). | JS |
| `types/compat.ts` | Apelidos com os nomes de tipo do Core atual (`TechnosPedometerHistory`...). | JS |
| `constants.ts` | `deviceConnectStates`, `deletedCategory`, `errorCodes`, `logLevels`, `technosEventNames`. | JS |
| `utils/` | `getNativeEventData`, `requestNativeEventData`, `getErrorCode`, agrupamento do `deletedSavedData`. | JS |
| `index.ts` | `TechnosCore` e `TechnosEvents` sobre o spec; reexporta o resto. | JS |
| `__mocks__/react-native-technos-core-next.ts` | Mock oficial: `jest.fn`, emissores em memória, `mockEmit`. | JS |

## Dependências

- Depende de `react-native` (peer, `>= 0.81`) e do módulo nativo registrado como `NativeCoreNext`.
- `constants.ts`, `types/` e `utils/` não importam o módulo nativo: o mock e os testes usam esses arquivos sem ele.
- Só `index.ts` importa `specs/NativeCoreNext.ts`, que chama `TurboModuleRegistry.getEnforcing` no import.

## Invariantes

- Os valores de `deviceConnectStates` e `deletedCategory` são os do Core atual e não mudam.
- `errorCodes` acompanha `WatchErrorCodes.kt` (Repo 1) e `HostErrorCodes.kt` (Android).
- Nada aqui guarda estado entre chamadas; `getNativeEventData` e `requestNativeEventData` sempre removem a inscrição.
- Mudou spec, payload ou constante: atualize `docs/api-js.md`, o mock e os testes do exemplo no mesmo PR.

## Typecheck e testes

Não há `node_modules` na raiz; tudo usa o do exemplo.

- `example/node_modules/.bin/tsc --noEmit -p tsconfig.json` (na raiz) checa `src/`.
- `cd example && npm test` roda os testes de `src/` (`__tests__/wrapper.test.ts`, `events.test.ts`) e do exemplo.
