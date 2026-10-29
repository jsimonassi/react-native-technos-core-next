package br.com.grupotechnos.corenext

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Pacote registrado pelo autolinking do React Native (nenhum `add(...)` manual no `MainApplication`).
 *
 * Só expõe o [NativeCoreNextModule], como TurboModule (arquitetura nova).
 */
class NativeCoreNextPackage : BaseReactPackage() {
	override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
		if (name == NativeCoreNextModule.NAME) NativeCoreNextModule(reactContext) else null

	override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
		mapOf(
			NativeCoreNextModule.NAME to ReactModuleInfo(
				NativeCoreNextModule.NAME,
				NativeCoreNextModule::class.java.name,
				false,
				false,
				false,
				true,
			),
		)
	}
}
