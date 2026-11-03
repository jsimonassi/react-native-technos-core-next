// TurboModule `NativeCoreNext` no iOS: uma casca sobre o `TWPCoreBridge` do Repo 1, par do `NativeCoreNextModule.kt`.
//
// Cada método do spec (`src/specs/NativeCoreNext.ts`, 47 métodos: os 23 da fase 1 e os 24 de ajustes, mensagens e
// interações da fase 2) embrulha o par resolve/reject do React Native numa `TCNPromiseCompletion` (Swift,
// `CoreNext.swift`: todo valor resolvido passa pelo `FoundationConverter`, e o `isConnected` chega ao JS como
// `true`/`false`) e chama o seletor de mesmo nome do `TWPCoreBridge` do processo. O módulo é o `TWPCoreEventSink`:
// converte cada payload com o `TWPFoundationConverter` e chama o `emitOnX:` gerado pelo codegen no
// `NativeCoreNextSpecBase` (17 eventos). Nenhuma regra mora aqui; a forma é a do
// `bridge/objc-interop/MinimalTurboModule.mm` do Repo 1, que o `./gradlew check` de lá compila.
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

/// `YES` (e rejeita com `INVALID_ARGUMENT`, sem chamar o controlador) quando um argumento de objeto chega `nil`: o
/// `null`/`undefined` do JS no lugar do texto, do dicionário ou da lista inteiros, que o React Native 0.81 entrega como
/// `nil` (`RCTTurboModule.mm`, `convertJSIValueToObjCObject`, sem a flag `enableModuleArgumentNSNullConversionIOS`). O
/// `CoreBridge` do Repo 1 recebe tipos não nulos, e um `nil` vira um `kotlin.NullPointerException` não capturado, que
/// encerra o processo (conferido no simulador em 2026-11-02). Sem `onError`, que é evento do controlador; o desvio e
/// a correção no `CoreBridge` estão no DP-100 do `docs/desvios-de-producao.md`. Sem `reject` (método `void`), só loga.
static BOOL CNRejectNil(id _Nullable value, NSString *argument, SEL method, RCTPromiseRejectBlock _Nullable reject)
{
	if (value != nil) {
		return NO;
	}
	NSString *jsMethod = [NSStringFromSelector(method) componentsSeparatedByString:@":"].firstObject;
	NSString *message = [NSString stringWithFormat:@"%@ must not be null", argument];
	NSString *outcome = reject != nil ? @"rejected with INVALID_ARGUMENT" : @"ignored";
	[TCNCoreNext logWithTag:[NSString stringWithFormat:@"RCTNativeCoreNext/%@", jsMethod] message:[NSString stringWithFormat:@"%@; %@ before the CoreBridge", message, outcome]];
	if (reject != nil) {
		reject(TWPHostErrorCodes.shared.INVALID_ARGUMENT, message, nil);
	}
	return YES;
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
	} else if ([name isEqualToString:@"onFindPhone"]) {
		[self emitOnFindPhone:value];
	} else if ([name isEqualToString:@"onTakeAPicture"]) {
		[self emitOnTakeAPicture:value];
	} else if ([name isEqualToString:@"onOpenCameraMode"]) {
		[self emitOnOpenCameraMode:value];
	} else if ([name isEqualToString:@"onDeviceRequestedCameraMode"]) {
		[self emitOnDeviceRequestedCameraMode:value];
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
	if (CNRejectNil(deviceId, @"deviceId", _cmd, reject) || CNRejectNil(name, @"name", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] pairDeviceDeviceId:deviceId name:name completion:CNCompletion(resolve, reject)];
}

- (void)startPairingAttempt:(NSString *)deviceId name:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(deviceId, @"deviceId", _cmd, reject) || CNRejectNil(name, @"name", _cmd, reject)) {
		return;
	}
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

- (void)resetDevice:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] resetDeviceCompletion:CNCompletion(resolve, reject)];
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
	if (CNRejectNil(filteredArrayData, @"filteredArrayData", _cmd, nil)) {
		return;
	}
	// O NSArray do TurboModule vai como está: strings (wrapper do Core atual) ou mapas do spec.
	[[self coreBridgeFor:_cmd] deletedSavedDataFilteredArrayData:filteredArrayData category:category];
}

#pragma mark - Ajustes, mensagens e interações (fase 2)

// Os dicionários e as listas vão como chegam do React Native, sem cópia nem conversão. Com as flags padrão do RN 0.81.4
// (`enableModuleArgumentNSNullConversionIOS` desligada), um `null`/`undefined` dentro de uma lista chega como `NSNull`
// (`RCTTurboModule.mm:123-125`) e, dentro de um dicionário, a chave nem chega (`:141-145`). O `SettingsMapper` do Repo 1
// trata os dois como ausente (`isNullLike`, D7 da fase 2), e a validação de cada campo (`INVALID_ARGUMENT` com `onError`
// antes do reject) também mora lá. Só o argumento inteiro `nil` para aqui (`CNRejectNil`), porque o framework não o
// recebe.

- (void)setUserInfo:(NSDictionary *)userInfo resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(userInfo, @"userInfo", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setUserInfoUserInfo:userInfo completion:CNCompletion(resolve, reject)];
}

- (void)setGoalsV2:(NSDictionary *)goals resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(goals, @"goals", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setGoalsV2Goals:goals completion:CNCompletion(resolve, reject)];
}

- (void)set12HourFormat:(BOOL)enabled resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] set12HourFormatEnabled:enabled completion:CNCompletion(resolve, reject)];
}

- (void)setTemperatureUnit:(NSString *)temp resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(temp, @"temp", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setTemperatureUnitTemp:temp completion:CNCompletion(resolve, reject)];
}

- (void)setDistanceUnit:(NSDictionary *)distanceUnit resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(distanceUnit, @"distanceUnit", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setDistanceUnitDistanceUnit:distanceUnit completion:CNCompletion(resolve, reject)];
}

- (void)setScreenTime:(double)time resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] setScreenTimeTime:time completion:CNCompletion(resolve, reject)];
}

- (void)setDeviceBatterySaving:(BOOL)enabled resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] setDeviceBatterySavingEnabled:enabled completion:CNCompletion(resolve, reject)];
}

- (void)setSosHelp:(BOOL)isEnabled resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] setSosHelpIsEnabled:isEnabled completion:CNCompletion(resolve, reject)];
}

- (void)setGestureControlV2:(NSDictionary *)gestureControlMap resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(gestureControlMap, @"gestureControlMap", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setGestureControlV2GestureControlMap:gestureControlMap completion:CNCompletion(resolve, reject)];
}

- (void)setMenstrual:(NSDictionary *)menstrual resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(menstrual, @"menstrual", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setMenstrualMenstrual:menstrual completion:CNCompletion(resolve, reject)];
}

- (void)setHeartRateAutomaticCheck:(BOOL)enabled startHour:(NSString *)startHour endHour:(NSString *)endHour interval:(double)interval resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(startHour, @"startHour", _cmd, reject) || CNRejectNil(endHour, @"endHour", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setHeartRateAutomaticCheckEnabled:enabled startHour:startHour endHour:endHour interval:interval completion:CNCompletion(resolve, reject)];
}

- (void)setStressAutomaticCheck:(NSDictionary *)automaticStress resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(automaticStress, @"automaticStress", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setStressAutomaticCheckAutomaticStress:automaticStress completion:CNCompletion(resolve, reject)];
}

- (void)setNotDisturb:(NSDictionary *)notDisturb resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(notDisturb, @"notDisturb", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setNotDisturbNotDisturb:notDisturb completion:CNCompletion(resolve, reject)];
}

- (void)setWaterReminderV2:(NSDictionary *)waterReminder resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(waterReminder, @"waterReminder", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setWaterReminderV2WaterReminder:waterReminder completion:CNCompletion(resolve, reject)];
}

- (void)setWalkReminder:(NSDictionary *)walkReminder resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(walkReminder, @"walkReminder", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setWalkReminderWalkReminder:walkReminder completion:CNCompletion(resolve, reject)];
}

- (void)setAlarm:(NSArray *)alarmArray resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(alarmArray, @"alarmArray", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setAlarmAlarmArray:alarmArray completion:CNCompletion(resolve, reject)];
}

- (void)setWorldClock:(NSArray *)worldClockList resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(worldClockList, @"worldClockList", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setWorldClockWorldClockList:worldClockList completion:CNCompletion(resolve, reject)];
}

- (void)manageNotifications:(NSDictionary *)notifications shouldShowNotificationModal:(BOOL)shouldShowNotificationModal resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(notifications, @"notifications", _cmd, reject)) {
		return;
	}
	// O segundo argumento vai como chegou; o `CoreBridge` o ignora (DP-79 do `docs/desvios-de-producao.md`).
	[[self coreBridgeFor:_cmd] manageNotificationsNotifications:notifications shouldShowNotificationModal:shouldShowNotificationModal completion:CNCompletion(resolve, reject)];
}

- (void)setAddressBook:(NSArray *)contactList resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(contactList, @"contactList", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] setAddressBookContactList:contactList completion:CNCompletion(resolve, reject)];
}

- (void)syncWeather:(NSArray *)weatherList resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	if (CNRejectNil(weatherList, @"weatherList", _cmd, reject)) {
		return;
	}
	[[self coreBridgeFor:_cmd] syncWeatherWeatherList:weatherList completion:CNCompletion(resolve, reject)];
}

- (void)vibrateDevice:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] vibrateDeviceCompletion:CNCompletion(resolve, reject)];
}

- (void)openCameraMode:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] openCameraModeCompletion:CNCompletion(resolve, reject)];
}

- (void)closeCameraMode:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
	[[self coreBridgeFor:_cmd] closeCameraModeCompletion:CNCompletion(resolve, reject)];
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
