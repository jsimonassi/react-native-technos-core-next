package br.com.grupotechnos.corenext.bridge

import br.com.grupotechnos.watch.protocol.domain.DataKind
import org.junit.Test
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** `deletedSavedData`: categoria → `DataKind` e `registered_at` → dia local. */
class SavedDataMapperTest {
	private val saoPaulo = ZoneId.of("America/Sao_Paulo")

	@Test
	fun categories() {
		assertEquals(DataKind.STEPS, SavedDataMapper.kindForCategory(5))
		assertEquals(DataKind.SLEEP, SavedDataMapper.kindForCategory(0))
		assertNull(SavedDataMapper.kindForCategory(4))
	}

	@Test
	fun offsetDatesUseTheLocalDay() {
		assertEquals("2026-10-28", SavedDataMapper.dayKey("2026-10-28T00:00:00-03:00", saoPaulo))
		assertEquals("2026-10-28", SavedDataMapper.dayKey("2026-10-28T22:00:00-03:00", saoPaulo))
	}

	@Test
	fun utcDatesAreConvertedBackToTheLocalDay() {
		// Início do dia local que passou por moment().toISOString().
		assertEquals("2026-10-28", SavedDataMapper.dayKey("2026-10-28T03:00:00.000Z", saoPaulo))
		// 22h locais viram o dia seguinte em UTC; cortar a string daria 2026-10-29.
		assertEquals("2026-10-28", SavedDataMapper.dayKey("2026-10-29T01:00:00Z", saoPaulo))
	}

	@Test
	fun legacyAndPartialFormats() {
		assertEquals("2026-10-28", SavedDataMapper.dayKey("2026-10-28T07:00:00-0300", saoPaulo))
		assertEquals("2026-10-28", SavedDataMapper.dayKey("2026-10-28T07:00:00", saoPaulo))
		assertEquals("2026-10-28", SavedDataMapper.dayKey("2026-10-28", saoPaulo))
		assertNull(SavedDataMapper.dayKey("28/10/2026", saoPaulo))
		assertNull(SavedDataMapper.dayKey("", saoPaulo))
	}

	@Test
	fun dayKeysAreDistinctAndKeepOrder() {
		val result = SavedDataMapper.dayKeys(
			listOf(
				"2026-10-27T00:00:00-03:00",
				"2026-10-28T00:00:00-03:00",
				"2026-10-28T03:00:00.000Z",
				"garbage",
			),
			saoPaulo,
		)
		assertEquals(listOf("2026-10-27", "2026-10-28"), result.dayKeys)
		assertEquals(listOf("garbage"), result.rejected)
	}
}
