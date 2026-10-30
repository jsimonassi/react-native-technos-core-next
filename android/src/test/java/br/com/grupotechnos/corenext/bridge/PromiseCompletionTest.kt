package br.com.grupotechnos.corenext.bridge

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertSame

/**
 * O que o [PromiseCompletion] entrega à `Promise` do RN nos valores que não são mapa nem lista (esses passam pelo
 * [WritableConverter], que precisa da biblioteca nativa do RN e não roda na JVM): o mesmo valor, e a rejeição pela
 * sobrecarga `reject(code, message)`, como o módulo antigo fazia.
 */
class PromiseCompletionTest {
	private class RecordingPromise : Promise {
		val calls = mutableListOf<String>()
		var resolved: Any? = UNSET

		override fun resolve(value: Any?) {
			calls += "resolve"
			resolved = value
		}

		override fun reject(code: String, message: String?) {
			calls += "reject($code, $message)"
		}

		override fun reject(code: String, throwable: Throwable?) {
			unexpected()
		}

		override fun reject(code: String, message: String?, throwable: Throwable?) {
			unexpected()
		}

		override fun reject(throwable: Throwable) {
			unexpected()
		}

		override fun reject(throwable: Throwable, userInfo: WritableMap) {
			unexpected()
		}

		override fun reject(code: String, userInfo: WritableMap) {
			unexpected()
		}

		override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
			unexpected()
		}

		override fun reject(code: String, message: String?, userInfo: WritableMap) {
			unexpected()
		}

		override fun reject(code: String?, message: String?, throwable: Throwable?, userInfo: WritableMap?) {
			unexpected()
		}

		@Deprecated("only the (code, message) overload is expected")
		override fun reject(message: String) {
			unexpected()
		}

		private fun unexpected(): Nothing = throw AssertionError("unexpected Promise overload")

		companion object {
			val UNSET = Any()
		}
	}

	@Test
	fun nullBooleanAndStringGoThroughUnchanged() {
		val none = RecordingPromise()
		PromiseCompletion(none).resolve(null)
		assertEquals(listOf("resolve"), none.calls)
		assertEquals(null, none.resolved)

		val connected = RecordingPromise()
		PromiseCompletion(connected).resolve(true)
		assertEquals(true, connected.resolved)
		assertEquals<Class<*>?>(java.lang.Boolean::class.java, connected.resolved?.javaClass)

		val path = "/storage/emulated/0/Android/data/x/files/corenext/frames-20261029-083254.jsonl"
		val export = RecordingPromise()
		PromiseCompletion(export).resolve(path)
		assertSame(path, export.resolved)
	}

	@Test
	fun rejectUsesTheCodeAndMessageOverload() {
		val promise = RecordingPromise()
		PromiseCompletion(promise).reject("NO_DATA", "No sleep sessions stored")
		assertEquals(listOf("reject(NO_DATA, No sleep sessions stored)"), promise.calls)
	}
}
