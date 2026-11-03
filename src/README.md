# `src/`: camada JavaScript

Wrapper fino sobre o TurboModule `NativeCoreNext`. Dá ao app os mesmos nomes do Core atual (`TechnosCore`,
`TechnosEvents`, `utils`, `deviceConnectStates`, `deletedCategory`) com tipos, e o mock oficial para Jest. Os métodos da
fase 2 do Condor Reebok (ajustes, mensagens e interações, mais o `resetDevice`) têm os nomes, argumentos e tipos de
entrada do Core que o app Condor fixa (`TechnosWareCore` `v4.3.57`). Referência completa de métodos e eventos:
[`docs/api-js.md`](../docs/api-js.md).

## O que fica fora

Nenhuma regra de protocolo, BLE ou permissão. Estado também não: o wrapper não guarda último valor de evento nem
cache; quem precisa disso é o app (o exemplo faz em `example/src/hooks/useCoreEvents.ts`). Os dicionários da fase 2
passam como vieram: chaves, `"HH:mm"`, `repeat`, booleano como número e nulos são lidos pelo `SettingsMapper` do
`:bridge` (Repo 1), que rejeita entrada malformada com `INVALID_ARGUMENT` e `onError`. O cache do clima e o estado da
câmera também moram lá.

## Arquivos

| Arquivo | Conteúdo | Dono |
|---|---|---|
| `specs/NativeCoreNext.ts` | Spec do TurboModule (codegen). Contrato. | lead |
| `types/events.ts` | Formato de cada evento. Contrato com o `EventMapper` do `:bridge` (Repo 1). | lead |
| `types/emitter.ts` | `TechnosEventEmitter`, `TechnosEventMap` (payload por nome de evento). | JS |
| `types/compat.ts` | Apelidos com os nomes de tipo do Core atual (`TechnosPedometerHistory`, `TechnosFindPhoneStatus`...). | JS |
| `types/watchSettings.ts` | Entradas da fase 2 com os nomes e campos do Core (`TechnosUserInfoSet`, `TechnosAlarmSet` com `enable`, `TechnosWalkReminderUpdate` com `onOff`, `TechnosNotDisturbSet` com `alwaysOn`, os `repeat`...). Contrato com o `SettingsMapper` do `:bridge` (Repo 1). | lead |
| `constants.ts` | `deviceConnectStates`, `deletedCategory`, `errorCodes`, `logLevels`, `technosEventNames`. | JS |
| `utils/` | `getNativeEventData`, `requestNativeEventData`, `getErrorCode`, agrupamento do `deletedSavedData` e `observed` (`utils/promise.ts`: marca a Promise como tratada sem engolir a rejeição; `docs/api-js.md`, regra 3). | JS |
| `index.ts` | `TechnosCore` e `TechnosEvents` sobre o spec; reexporta o resto. Os aliases do Core atual (`initSMASDK`, que tem método próprio no spec, e `initCRPSDK`, só no JS, que chama o `initialize` nativo) também moram aqui. | JS |
| `__mocks__/react-native-technos-core-next.ts` | Mock oficial: `jest.fn`, emissores em memória, `mockEmit`. | JS |

## Dependências

- Depende de `react-native` (peer, `>= 0.81`) e do módulo nativo registrado como `NativeCoreNext`.
- `constants.ts`, `types/` e `utils/` não importam o módulo nativo: o mock e os testes usam esses arquivos sem ele.
- Só `index.ts` importa `specs/NativeCoreNext.ts`, que chama `TurboModuleRegistry.getEnforcing` no import.

## Invariantes

- Os valores de `deviceConnectStates` e `deletedCategory` são os do Core atual e não mudam.
- `errorCodes` acompanha `WatchErrorCodes.kt` (`:protocol`, catorze códigos, com o `NOT_SUPPORTED` da fase 2) e
  `HostErrorCodes.kt` (`:bridge`, cinco, com o `CLASSIC_BOND_FAILED` do Condor Reebok), os dois no Repo 1.
- Os 23 métodos da fase 2 e o `resetDevice` devolvem `observed(NativeCoreNext.x(...))`: a mesma Promise, com um
  `.catch` vazio pendurado, para uma chamada sem `await` (como o app Condor faz com `setUserInfo`, `syncWeather`,
  `vibrateDevice` e a câmera) não gerar "Possible unhandled promise rejection". Os métodos da fase 1 não passam por ele.
  Método novo da fase 2 entra no spec, no wrapper com `observed`, no mock (`TechnosCore` e `promiseMethods`) e no
  `__tests__/watchSettings.test.ts`.
- Os tipos de `types/watchSettings.ts` copiam os do Core campo a campo (com `reminder?` a mais no ciclo, que o app
  Condor já manda; DP-77 do `docs/desvios-de-producao.md`); não renomeie nem torne obrigatório um campo: o app Condor
  troca de pacote sem mudar os tipos.
- Um alias novo de método sem efeito próprio (como `initCRPSDK`) fica só no JS: não muda o spec, o codegen nem os
  módulos nativos. Ele entra no mock (`TechnosCore` e `promiseMethods`) e no `wrapper.test.ts`.
- Nada aqui guarda estado entre chamadas; `getNativeEventData` e `requestNativeEventData` sempre removem a inscrição.
- Mudou spec, payload ou constante: atualize `docs/api-js.md`, o mock e os testes do exemplo no mesmo PR.

## Typecheck e testes

Não há `node_modules` na raiz; tudo usa o do exemplo.

- `example/node_modules/.bin/tsc --noEmit -p tsconfig.json` (na raiz) checa `src/`.
- `cd example && npm test` roda os testes de `src/` (`__tests__/wrapper.test.ts`, `events.test.ts`,
  `watchSettings.test.ts`) e do exemplo.
