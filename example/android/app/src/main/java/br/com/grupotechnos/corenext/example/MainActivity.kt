package br.com.grupotechnos.corenext.example

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/** Activity única do app de exemplo; o nome do componente tem que ser o registrado em `index.js`. */
class MainActivity : ReactActivity() {
	override fun getMainComponentName(): String = "CoreNextExample"

	override fun createReactActivityDelegate(): ReactActivityDelegate =
		DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
