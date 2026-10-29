package br.com.grupotechnos.corenext.example

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

/**
 * Application do app de exemplo, igual ao modelo do RN 0.81. A biblioteca entra pelo autolinking (`PackageList`),
 * apontada para a raiz do repositório por `example/react-native.config.js`; nenhum pacote é registrado à mão.
 */
class MainApplication : Application(), ReactApplication {
	override val reactNativeHost: ReactNativeHost =
		object : DefaultReactNativeHost(this) {
			override fun getPackages(): List<ReactPackage> = PackageList(this).packages

			override fun getJSMainModuleName(): String = "index"

			override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

			override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
			override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
		}

	override val reactHost: ReactHost
		get() = getDefaultReactHost(applicationContext, reactNativeHost)

	override fun onCreate() {
		super.onCreate()
		loadReactNative(this)
	}
}
