package br.com.grupotechnos.corenext

import org.junit.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * O roteamento do [NativeCoreNextModule.emit]. Um nome sem ramo no `when` lança `IllegalArgumentException`, o
 * `CoreBridge` devolve o evento à fila e o JS nunca o recebe; um ramo que chama o emissor de outro nome entrega o
 * payload no evento errado. O compilador não pega nenhum dos dois.
 *
 * O módulo não roda na JVM (o `emitOnX` gerado chama um `CxxCallbackImpl` e o `WritableConverter` cria mapas nativos
 * do RN), então o teste lê o fonte do módulo e o compara com os `emitOnX` que o codegen gerou do spec
 * (`NativeCoreNextSpec`, por reflexão) e com os `EventEmitter` de `src/specs/NativeCoreNext.ts`, como o
 * `TurboModuleSourceTests` do iOS faz com o `RCTNativeCoreNext.mm`.
 */
class NativeCoreNextEmitRoutingTest {
	/** Raiz do Repo 2, procurada a partir da pasta do teste (o Gradle roda os testes em `android/`). */
	private val repo2: File = generateSequence(File("").absoluteFile) { it.parentFile }
		.firstOrNull { File(it, SPEC).isFile }
		?: error("Repo 2 root (with $SPEC) not found above ${File("").absolutePath}")

	/** Os `emitOnX` que o codegen gerou no `NativeCoreNextSpec`, um por `EventEmitter` do spec. */
	private fun generatedEmitters(): Set<String> =
		NativeCoreNextSpec::class.java.declaredMethods.map { it.name }.filter { it.startsWith("emitOn") }.toSet()

	/** Os eventos do spec (`readonly onX: CodegenTypes.EventEmitter<...>`), na ordem do arquivo. */
	private fun specEvents(): List<String> =
		Regex("""readonly (on[A-Za-z0-9]+): CodegenTypes\.EventEmitter""")
			.findAll(File(repo2, SPEC).readText())
			.map { it.groupValues[1] }
			.toList()

	/** O corpo do `emit` do módulo, da assinatura até o `}` que fecha o método. */
	private fun emitBody(): String {
		val source = File(repo2, MODULE).readText()
		val start = source.indexOf(EMIT_SIGNATURE)
		check(start >= 0) { "$EMIT_SIGNATURE not found in $MODULE" }
		val end = source.indexOf("\n\t}\n", start)
		check(end > start) { "end of emit not found in $MODULE" }
		return source.substring(start, end)
	}

	/** Cada ramo do `when (name)`: o nome comparado e o emissor chamado (`"onX" -> emitOnY(map)`). */
	private fun branches(): List<Pair<String, String>> =
		Regex("""^\s*"(on[A-Za-z0-9]+)" -> (emitOn[A-Za-z0-9]+)\(map\)$""", RegexOption.MULTILINE)
			.findAll(emitBody())
			.map { it.groupValues[1] to it.groupValues[2] }
			.toList()

	@Test
	fun everySpecEventHasOneBranchThatCallsItsOwnGeneratedEmitter() {
		val spec = specEvents()
		assertEquals(27, spec.size, "13 from phase 1, 4 from phase 2 and 10 from phase 3: $spec")
		assertEquals(spec.size, spec.toSet().size, "duplicated event in the spec: $spec")
		assertEquals(spec.map { "emit" + it.replaceFirstChar(Char::uppercaseChar) }.toSet(), generatedEmitters(), "codegen out of date")

		val branches = branches()
		assertEquals(spec.sorted(), branches.map { it.first }.sorted(), "one branch per spec event")
		for ((name, emitter) in branches) {
			assertEquals("emit" + name.replaceFirstChar(Char::uppercaseChar), emitter, "$name must call its own emitter")
		}
	}

	@Test
	fun thePhase3EventsAreRouted() {
		val routed = branches().map { it.first }.toSet()
		val missing = PHASE3_EVENTS.filterNot(routed::contains)
		assertEquals(emptyList(), missing, "phase 3 events without a branch in emit")
		assertTrue(PHASE3_EVENTS.all(specEvents()::contains), "phase 3 events must be in the spec")
	}

	@Test
	fun anUnknownNameThrowsSoTheCoreBridgeKeepsTheEvent() {
		// O CoreEventSink do Repo 1 pede uma RuntimeException para um nome desconhecido: o evento volta à fila.
		val body = emitBody()
		assertTrue(Regex("""^\s*else -> throw IllegalArgumentException\("Unknown event \${'$'}name"\)$""", RegexOption.MULTILINE).containsMatchIn(body), body)
	}

	companion object {
		const val SPEC = "src/specs/NativeCoreNext.ts"
		const val MODULE = "android/src/main/java/br/com/grupotechnos/corenext/NativeCoreNextModule.kt"
		const val EMIT_SIGNATURE = "override fun emit(name: String, payload: Map<String, Any?>) {"

		val PHASE3_EVENTS = listOf(
			"onHistoryHeartRate",
			"onHistoryStress",
			"onHistorySpo2",
			"onHistoryActivityV2",
			"onActivityStartedV2",
			"onActivityStatusV2",
			"onActivityUpdateV2",
			"onActivityCompletedV2",
			"onActivityError",
			"onActivityRealTimeSpeed",
		)
	}
}
