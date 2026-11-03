# `turbomodule/` (iOS)

`RCTNativeCoreNext.mm`: o TurboModule `NativeCoreNext` em Objective-C++, a casca sobre o `TWPCoreBridge` do Repo 1.
Par do `NativeCoreNextModule.kt`. É o único arquivo do Core iOS que conhece o React Native.

## O que faz

- Conforma ao protocolo `NativeCoreNextSpec` e herda do `NativeCoreNextSpecBase` que o codegen do RN 0.81 gera
  (`example/ios/build/generated/ios/NativeCoreNextSpec/` depois do `pod install`); `getTurboModule:` devolve o
  `NativeCoreNextSpecJSI`.
- Registro: `codegenConfig.ios.modulesProvider` no `package.json` (`"NativeCoreNext": "RCTNativeCoreNext"`), que o
  codegen escreve no `RCTModuleProviders.mm` do app; `+moduleName` devolve `NativeCoreNext`.
- Os 47 métodos do spec (23 da fase 1 e 24 da fase 2), cada um uma linha: embrulha resolve/reject numa
  `TCNPromiseCompletion` (Swift; todo valor resolvido passa pelo `FoundationConverter`, e o `isConnected` chega como
  `true`/`false`) e chama o seletor de mesmo nome do `TWPCoreBridge` (o `initSMASDK` chama `doInitSMASDKCompletion:`,
  porque o Kotlin/Native renomeia a família `init`; os seletores são os do `bridge/objc-interop/MinimalTurboModule.mm`
  do Repo 1, por exemplo `setUserInfoUserInfo:completion:`,
  `setHeartRateAutomaticCheckEnabled:startHour:endHour:interval:completion:` e `resetDeviceCompletion:`). O
  `deletedSavedData` passa o `NSArray` como está.
- **Fase 2** (ajustes, mensagens e interações do Condor Reebok, desde 2026-11-02; `docs/api-js.md`, seção "Ajustes,
  mensagens e interações"): os `NSDictionary` e `NSArray` vão como chegam do React Native, sem cópia nem conversão;
  `BOOL` e `double` vão como estão. Com as flags padrão do RN 0.81.4, um `null` dentro de uma lista chega como `NSNull`
  e, dentro de um dicionário, a chave nem chega (`RCTTurboModule.mm:123-125, 141-145`); o `SettingsMapper` do Repo 1
  trata os dois como ausente (`isNullLike`, D7), e a validação de cada campo (`INVALID_ARGUMENT` com o
  `onError` antes do reject), as rejeições `NOT_READY` e `NOT_SUPPORTED`, a máquina de estado da câmera e o
  `resetDevice` (`51 02`) moram no `CoreBridge`. O `shouldShowNotificationModal` do `manageNotifications` vai como
  chegou; o `CoreBridge` o ignora (DP-79 do `docs/desvios-de-producao.md`).
- **Argumento inteiro `nil`** (o `null`/`undefined` do JS no lugar do texto, do dicionário ou da lista, que o React
  Native 0.81 entrega como `nil`): o `CNRejectNil` rejeita na hora com `INVALID_ARGUMENT` (`"<argumento> must not be
  null"`), sem chamar o `CoreBridge` e sem `onError`, e loga uma linha INFO; no `deletedSavedData` (`void`), só loga.
  É a única conferência do shim, e existe porque o framework não recebe `nil`: o `CoreBridge` tem parâmetros não nulos
  e o `nil` vira um `kotlin.NullPointerException` não capturado, que encerra o processo (conferido no simulador). Vale
  para os 19 métodos com argumento de objeto, inclusive `pairDevice`, `startPairingAttempt` e `deletedSavedData` da
  fase 1. Desvio de produção (o Core iOS seguia com o `nil`): DP-100; o Android rejeita sem `code` (DP-99).
- É o `TWPCoreEventSink`: `canEmit` = `_eventEmitterCallback` instalado; `emitName:payload:` converte com
  `TWPFoundationConverter` e chama o `emitOnX:` do nome, um ramo para cada um dos 17 eventos do spec (da fase 2:
  `onFindPhone`, `onTakeAPicture`, `onOpenCameraMode` e `onDeviceRequestedCameraMode`, que o `CoreBridge` emite sem
  fila). Um nome sem ramo vai só para o `NSLog`. O `emitOnX:` gerado chama um `AsyncEventEmitter`, que agenda a
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
dos payloads são exercitados pelo `CoreBridgeReplayTests` e pelo `Phase2HostTests` (este chama os métodos da fase 2 com
os mesmos `NSDictionary` que o shim repassa, com `NSNumber`, `CFBoolean` e `NSNull`). O que o compilador não garante
no shim, o `TurboModuleSourceTests` confere lendo este arquivo e o spec: um método do protocolo sem implementação é só
um aviso (e um crash quando o JS o chama), um evento sem ramo no `emitName:` cai no `NSLog` e um argumento `nil` sem o
`CNRejectNil` derruba o app; o teste exige os 47 métodos, cada um com uma chamada ao `CoreBridge`, os 22 argumentos de
objeto conferidos antes dela e os 17 ramos, cada um com o `emitOnX:` do mesmo nome. A prova de
que o módulo registra e responde é o app de exemplo no simulador
([`ios/README.md`](../../README.md#app-de-exemplo-no-simulador)); os dois builds do exemplo (simulador Debug e iPhone
Release) compilam este arquivo contra o `NativeCoreNextSpec.h` gerado.
