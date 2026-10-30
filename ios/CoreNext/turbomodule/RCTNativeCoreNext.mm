// TurboModule `NativeCoreNext` no iOS: uma casca sobre o `TWPCoreBridge` do Repo 1, par do `NativeCoreNextModule.kt`.
//
// Cada método do spec (`src/specs/NativeCoreNext.ts`, 23 métodos) embrulha o par resolve/reject do React Native numa
// `TCNPromiseCompletion` (Swift, `CoreNext.swift`: todo valor resolvido passa pelo `FoundationConverter`, e o
// `isConnected` chega ao JS como `true`/`false`) e chama o seletor de mesmo nome do `TWPCoreBridge` do processo. O
// módulo é o `TWPCoreEventSink`: converte cada payload com o `TWPFoundationConverter` e chama o `emitOnX:` gerado pelo
// codegen no `NativeCoreNextSpecBase`. Nenhuma regra mora aqui; a forma é a do `bridge/objc-interop/MinimalTurboModule.mm`
// do Repo 1, que o `./gradlew check` de lá compila.
//
// Sem header público de propósito: com `DEFINES_MODULE`, um `.h` entraria no umbrella do módulo `TechnosCoreNext`, e o
// `import TechnosCoreNext` do Swift do app tentaria compilar os headers C++ do codegen.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#import <NativeCoreNextSpec/NativeCoreNextSpec.h>
#import <React/RCTInvalidating.h>
#import <TechnosWatchProtocol/TechnosWatchProtocol.h>

#if __has_include(<TechnosCoreNext/TechnosCoreNext-Swift.h>)
#import <TechnosCoreNext/TechnosCoreNext-Swift.h>
#else
#import "TechnosCoreNext-Swift.h"
#endif

NS_ASSUME_NONNULL_BEGIN

@interface RCTNativeCoreNext : NativeCoreNextSpecBase <NativeCoreNextSpec, TWPCoreEventSink, RCTInvalidating>
@end

static id<TWPCoreCompletion> CNCompletion(RCTPromiseResolveBlock resolve, RCTPromiseRejectBlock reject)
{
	return [[TCNPromiseCompletion alloc] initWithResolve:resolve reject:reject];
}

/// A instância que o `CoreBridge` tem como sink agora (a última que recebeu `attachSink:`), no processo inteiro; só
/// para decidir quando religar e para o log. Protegida por `@synchronized([RCTNativeCoreNext class])`.
static __weak RCTNativeCoreNext *sCurrentSink = nil;

/// Quantas trocas de sink entre instâncias vivas ainda vão para o log (as primeiras bastam para o diagnóstico).
static NSInteger sSinkMovesToLog = 20;

@implementation RCTNativeCoreNext {
	/// O controlador, depois que este módulo se ligou a ele (primeiro método JS); `nil` antes e depois do `invalidate`.
	TWPCoreBridge *_Nullable _attachedBridge;
	id _Nullable _foregroundObserver;
}

+ (NSString *)moduleName
{
	return @"NativeCoreNext";
}

+ (BOOL)requiresMainQueueSetup
{
	return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
	return std::make_shared<facebook::react::NativeCoreNextSpecJSI>(params);
}

#pragma mark - Ciclo de vida

/// Como o `bridge()` do módulo Android (aqui `coreBridgeFor:`, porque `bridge` é propriedade do `RCTBridgeModule`): o
/// módulo se liga na primeira chamada de um método JS (o `attachSink:` entrega a fila de eventos).
///
/// Religa também quando o sink do `CoreBridge` está em **outra** instância: no primeiro teste no iPhone (2026-10-30), o
/// log teve dois `RCTNativeCoreNext/attach` no mesmo milissegundo, de duas instâncias, e o `attachSink:` da segunda
/// substitui o da primeira. Assim os eventos ficam sempre na instância que o JS chamou por último: o `sCurrentSink` e o
/// `attachSink:` mudam juntos, sob a trava da classe (fora dela, duas primeiras chamadas ao mesmo tempo deixavam o sink
/// do `CoreBridge` numa instância e o `sCurrentSink` na outra, e a última nunca o pegava de volta). Não trava: o
/// `attachSink:` entrega a fila pelo `emitName:`, que não usa as travas deste arquivo. A causa das duas
/// instâncias está em investigação (`docs/ios-pendente.md`, seção "Duas instâncias do TurboModule"); o log leva o
/// endereço da instância e o método, para o próximo teste mostrar qual chamada veio por qual.
- (TWPCoreBridge *)coreBridgeFor:(SEL)method
{
	@synchronized(self) {
		TWPCoreBridge *bridge = _attachedBridge;
		BOOL firstCall = bridge == nil;
		if (firstCall) {
			bridge = [TCNCoreNext sharedBridge];
			_attachedBridge = bridge;
			// O RN não tem `onHostResume` para TurboModule no iOS: a volta ao primeiro plano vem do UIKit.
			__weak RCTNativeCoreNext *weakSelf = self;
			_foregroundObserver = [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationWillEnterForegroundNotification
																					object:nil
																					 queue:nil
																				usingBlock:^(NSNotification *note) {
																					[weakSelf hostWillEnterForeground];
																				}];
		}
		RCTNativeCoreNext *previous;
		BOOL logMove = NO;
		@synchronized([RCTNativeCoreNext class]) {
			previous = sCurrentSink;
			sCurrentSink = self;
			if (!firstCall && previous != self && sSinkMovesToLog > 0) {
				sSinkMovesToLog -= 1;
				logMove = YES;
			}
			if (firstCall || previous != self) {
				[bridge attachSink:self];
			}
		}
		if (firstCall) {
			NSString *message = [NSString stringWithFormat:@"TurboModule %p attached to the CoreBridge (first JS call: %@; previous sink %p)",
														 self, NSStringFromSelector(method), previous];
			[TCNCoreNext logWithTag:@"RCTNativeCoreNext/attach" message:message];
		} else if (logMove) {
			NSString *message = [NSString stringWithFormat:@"TurboModule %p took the event sink back from %p (%@)", self, previous, NSStringFromSelector(method)];
			[TCNCoreNext logWithTag:@"RCTNativeCoreNext/attach" message:message];
		}
		return bridge;
	}
}

/// Só a instância que é o sink avisa: com duas instâncias ligadas, cada uma tem o seu observador, e dois `onHostResume`
/// pediriam duas reconexões, a primeira cancelada pela segunda (um `onError` `CANCELLED` sem motivo para o JS).
- (void)hostWillEnterForeground
{
	TWPCoreBridge *bridge;
	@synchronized(self) {
		bridge = _attachedBridge;
		@synchronized([RCTNativeCoreNext class]) {
			if (sCurrentSink != self) {
				bridge = nil;
			}
		}
	}
	[bridge onHostResume];
}

/// Reload ou fim do JS: o `CoreBridge` rejeita com `CANCELLED` toda Promise pendente e volta a guardar os eventos.
- (void)invalidate
{
	TWPCoreBridge *bridge;
	id observer;
	@synchronized(self) {
		bridge = _attachedBridge;
		observer = _foregroundObserver;
		_attachedBridge = nil;
		_foregroundObserver = nil;
		@synchronized([RCTNativeCoreNext class]) {
			if (sCurrentSink == self) {
				sCurrentSink = nil;
			}
		}
	}
	if (observer != nil) {
		[[NSNotificationCenter defaultCenter] removeObserver:observer];
	}
	if (bridge != nil) {
		[bridge invalidateSink:self];
		NSString *message = [NSString stringWithFormat:@"TurboModule %p invalidated; pending Promises rejected with CANCELLED", self];
		[TCNCoreNext logWithTag:@"RCTNativeCoreNext/invalidate" message:message];
	}
}

#pragma mark - TWPCoreEventSink

/// O `_eventEmitterCallback` do `NativeCoreNextSpecBase` só existe depois que o JSI ligou o módulo.
- (BOOL)canEmit
{
	return static_cast<bool>(_eventEmitterCallback);
}

/// O `emitOnX:` gerado chama um `AsyncEventEmitter`, que agenda a entrega na thread JS: pode ser chamado de qualquer
/// thread (aqui, a da sessão ou a do TurboModule), como o `emitOnX` do Android.
- (void)emitName:(NSString *)name payload:(NSDictionary<NSString *, id> *)payload
{
	NSDictionary *value = [TWPFoundationConverter.shared toDictionaryPayload:payload];
	if ([name isEqualToString:@"onScannedDevice"]) {
		[self emitOnScannedDevice:value];
	} else if ([name isEqualToString:@"onConnectStateChanged"]) {
		[self emitOnConnectStateChanged:value];
	} else if ([name isEqualToString:@"onDeviceInfo"]) {
		[self emitOnDeviceInfo:value];
	} else if ([name isEqualToString:@"onFirmwareInfo"]) {
		[self emitOnFirmwareInfo:value];
	} else if ([name isEqualToString:@"onBatteryStatus"]) {
		[self emitOnBatteryStatus:value];
	} else if ([name isEqualToString:@"onPedometer"]) {
		[self emitOnPedometer:value];
	} else if ([name isEqualToString:@"onHistoryPedometer"]) {
		[self emitOnHistoryPedometer:value];
	} else if ([name isEqualToString:@"onHistorySleep"]) {
		[self emitOnHistorySleep:value];
	} else if ([name isEqualToString:@"onSyncStarted"]) {
		[self emitOnSyncStarted:value];
	} else if ([name isEqualToString:@"onSyncProgress"]) {
		[self emitOnSyncProgress:value];
	} else if ([name isEqualToString:@"onSyncFinished"]) {
		[self emitOnSyncFinished:value];
	} else if ([name isEqualToString:@"onError"]) {
		[self emitOnError:value];
	} else if ([name isEqualToString:@"onLog"]) {
		[self emitOnLog:value];
	} else {
		// O Swift não lança exceção para o Kotlin: um nome fora da lista é erro do controlador e fica no log.
		NSLog(@"[CoreNext] RCTNativeCoreNext/emit: unknown event %@", name);
	}
}

#pragma mark - Inicialização

- (void)initialize:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] initializeCompletion:CNCompletion(resolve, reject)];
}

- (void)initSMASDK:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	// O Kotlin/Native renomeia a família `init`: o `initSMASDK` do CoreBridge é `doInitSMASDK`.
	[[self coreBridgeFor:_cmd] doInitSMASDKCompletion:CNCompletion(resolve, reject)];
}

#pragma mark - Scan e conexão

- (void)scan
{
	[[self coreBridgeFor:_cmd] scan];
}

- (void)stopScan
{
	[[self coreBridgeFor:_cmd] stopScan];
}

- (void)pairDevice:(NSString *)deviceId name:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] pairDeviceDeviceId:deviceId name:name completion:CNCompletion(resolve, reject)];
}

- (void)startPairingAttempt:(NSString *)deviceId name:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] startPairingAttemptDeviceId:deviceId name:name completion:CNCompletion(resolve, reject)];
}

- (void)disconnectCurrentDevice:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] disconnectCurrentDeviceCompletion:CNCompletion(resolve, reject)];
}

- (void)forgetDevice:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] forgetDeviceCompletion:CNCompletion(resolve, reject)];
}

- (void)isConnected:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] isConnectedCompletion:CNCompletion(resolve, reject)];
}

- (void)getLastPairedDevice:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] getLastPairedDeviceCompletion:CNCompletion(resolve, reject)];
}

#pragma mark - Comandos ao relógio

- (void)getDeviceInfo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] getDeviceInfoCompletion:CNCompletion(resolve, reject)];
}

- (void)getFirmwareInfo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] getFirmwareInfoCompletion:CNCompletion(resolve, reject)];
}

- (void)getBatteryStatus:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] getBatteryStatusCompletion:CNCompletion(resolve, reject)];
}

- (void)setTime:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] setTimeCompletion:CNCompletion(resolve, reject)];
}

- (void)refreshSteps:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] refreshStepsCompletion:CNCompletion(resolve, reject)];
}

- (void)syncDataHistory:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] syncDataHistoryCompletion:CNCompletion(resolve, reject)];
}

#pragma mark - Histórico local

- (void)getHistoryPedometer:(double)daysBefore resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] getHistoryPedometerDaysBefore:daysBefore completion:CNCompletion(resolve, reject)];
}

- (void)getHistorySleep:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] getHistorySleepCompletion:CNCompletion(resolve, reject)];
}

- (void)deletedSavedData:(NSArray *)filteredArrayData category:(double)category
{
	// O NSArray do TurboModule vai como está: strings (wrapper do Core atual) ou mapas do spec.
	[[self coreBridgeFor:_cmd] deletedSavedDataFilteredArrayData:filteredArrayData category:category];
}

#pragma mark - Logs

- (void)getLogs:(double)limit resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] getLogsLimit:limit completion:CNCompletion(resolve, reject)];
}

- (void)exportLogs:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] exportLogsCompletion:CNCompletion(resolve, reject)];
}

- (void)clearLogs
{
	[[self coreBridgeFor:_cmd] clearLogs];
}

- (void)setLogLevel:(double)level
{
	[[self coreBridgeFor:_cmd] setLogLevelLevel:level];
}

@end

NS_ASSUME_NONNULL_END
