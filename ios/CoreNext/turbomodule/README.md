# `turbomodule/` (iOS)

`RCTNativeCoreNext.mm`: o TurboModule `NativeCoreNext` em Objective-C++, a casca sobre o `TWPCoreBridge` do Repo 1.
Par do `NativeCoreNextModule.kt`. É o único arquivo do Core iOS que conhece o React Native.

## O que faz

- Conforma ao protocolo `NativeCoreNextSpec` e herda do `NativeCoreNextSpecBase` que o codegen do RN 0.81 gera
  (`example/ios/build/generated/ios/NativeCoreNextSpec/` depois do `pod install`); `getTurboModule:` devolve o
  `NativeCoreNextSpecJSI`.
- Registro: `codegenConfig.ios.modulesProvider` no `package.json` (`"NativeCoreNext": "RCTNativeCoreNext"`), que o
  codegen escreve no `RCTModuleProviders.mm` do app; `+moduleName` devolve `NativeCoreNext`.
- Os 23 métodos do spec, cada um uma linha: embrulha resolve/reject numa `TCNPromiseCompletion` (Swift; todo valor
  resolvido passa pelo `FoundationConverter`, e o `isConnected` chega como `true`/`false`) e chama o seletor de mesmo
  nome do `TWPCoreBridge` (o `initSMASDK` chama `doInitSMASDKCompletion:`, porque o Kotlin/Native renomeia a família
  `init`). O `deletedSavedData` passa o `NSArray` como está.
- É o `TWPCoreEventSink`: `canEmit` = `_eventEmitterCallback` instalado; `emitName:payload:` converte com
  `TWPFoundationConverter` e chama o `emitOnX:` do nome. O `emitOnX:` gerado chama um `AsyncEventEmitter`, que agenda a
  entrega na thread JS: emitir da thread da sessão é seguro, como no Android.
- Ciclo de vida: `attachSink:` na primeira chamada de um método JS (`coreBridgeFor:`; `bridge` já é propriedade do
  `RCTBridgeModule`) e de novo sempre que o sink do `CoreBridge` estiver em outra instância, para os eventos irem à
  instância que o JS chamou por último (a marca da instância atual e o `attachSink:` mudam juntos, sob a trava da classe,
  e o `CoreBridge.attach` troca o sink e entrega a fila sob a trava dele); `invalidateSink:` no `invalidate` (reload: o
  `CoreBridge` rejeita as Promises pendentes com `CANCELLED`); e `onHostResume` no `UIApplicationWillEnterForegroundNotification` (só da instância que
  é o sink), porque o RN não tem `LifecycleEventListener` para TurboModule no iOS. As transições ficam no log com o endereço da instância e o método
  que as causou (`RCTNativeCoreNext/attach`, inclusive `took the event sink back from …`, e
  `RCTNativeCoreNext/invalidate`). O porquê do religar: duas instâncias no primeiro teste no iPhone
  (`docs/ios-pendente.md`, seção "Duas instâncias do TurboModule").

## Por que não há `.h`

Com `DEFINES_MODULE = YES`, um header público entraria no umbrella do módulo `TechnosCoreNext`, e o
`import TechnosCoreNext` do `AppDelegate` tentaria compilar os headers C++ do codegen. A interface fica no `.mm`.

## De quem depende

`NativeCoreNextSpec` (codegen, pod `ReactCodegen`), `TechnosWatchProtocol.h` (o framework do Repo 1) e o
`TechnosCoreNext-Swift.h` (`TCNCoreNext`, `TCNPromiseCompletion`). A forma de cada chamada é a do
`bridge/objc-interop/MinimalTurboModule.mm` do Repo 1, que o `./gradlew check` de lá compila com `-Werror`.

## Testes

Não roda nos testes do simulador (que não têm React Native): o que ele usa do Swift (`PromiseCompletion`) e a conversão
dos payloads são exercitados pelo `CoreBridgeReplayTests`. A prova de que o módulo registra e responde é o app de
exemplo no simulador ([`ios/README.md`](../../README.md#app-de-exemplo-no-simulador)).
