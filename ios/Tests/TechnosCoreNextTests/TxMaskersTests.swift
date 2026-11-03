import XCTest

/// A `CrpTxMasker` com os TX privados da fase 2 (D14; ADR 36 do Repo 1): a gravação tem o payload zerado depois do
/// prefixo mantido e o replay escreve os bytes reais, então os dois têm de ficar iguais depois da máscara, e só eles.
/// Todos os valores são fictícios.
final class TxMaskersTests: XCTestCase {
	/// Frame CRP inteiro, como o `CrpFrameCodec.encode` do Repo 1 (bloco 244: `b2 = 0x20`; bloco 20: `b2 = 0x10`).
	private func crpFrame(_ cmd: UInt8, _ payload: [UInt8], block20: Bool = false) -> [UInt8] {
		let total = payload.count + 5
		let b2 = block20 ? UInt8(0x10) : UInt8(0x20 + (total >> 8))
		return [0xFE, 0xEA, b2, UInt8(total & 0xFF), cmd] + payload
	}

	/// A cópia que o driver grava (`CrpFrameCodec.redact`): cabeçalho, `cmd` e `keep` bytes do payload; o resto zerado.
	private func redacted(_ frame: [UInt8], keep: Int) -> [UInt8] {
		frame.enumerated().map { $0.offset >= 5 + keep ? 0 : $0.element }
	}

	/// Os pedaços de cada escrita (`CrpFrameCodec.fragments`): só o primeiro tem cabeçalho.
	private func fragments(_ frame: [UInt8], block: Int) -> [[UInt8]] {
		stride(from: 0, to: frame.count, by: block).map { Array(frame[$0..<min(frame.count, $0 + block)]) }
	}

	/// Compara pacote a pacote com um masker de cada lado, como o `ReplayTransport` (que mascara todos os pacotes, mesmo
	/// depois de uma divergência).
	private func sameAfterMask(recorded: [[UInt8]], sent: [[UInt8]]) -> Bool {
		guard recorded.count == sent.count else { return false }
		let expected = CrpTxMasker()
		let actual = CrpTxMasker()
		var same = true
		for (recordedPacket, sentPacket) in zip(recorded, sent) {
			let left = expected.mask(recordedPacket)
			let right = actual.mask(sentPacket)
			if left != right { same = false }
		}
		return same
	}

	/// Um frame de cada comando privado, com o prefixo que a redação mantém (`CrpCommand.privatePrefix` do Repo 1).
	private var privateFrames: [(name: String, frame: [UInt8], keep: Int)] {
		[
			("12 profile", crpFrame(0x12, [0xAF, 0x46, 0x24, 0x00]), 0),
			("75 menstrual", crpFrame(0x75, [0xF7, 0x0F, 0x1C, 0x05, 0x02, 0x09, 0x08, 0x1E, 0x08, 0x1E, 0x08, 0x1E, 0x08, 0x1E]), 0),
			("42 forecast", crpFrame(0x42, (0..<21).map { UInt8(0x10 + $0) }), 0),
			("43 today", crpFrame(0x43, [0x01, 0x19, 0x00, 0x43, 0x00, 0x69, 0x00, 0x64]), 0),
			("41 notification", crpFrame(0x41, [0x08, 0x54, 0x65, 0x73, 0x74, 0x65]), 0),
			("B5 00 weather", crpFrame(0xB5, [0x00, 0x01, 0x19, 0x12, 0x1B, 0x43, 0x69, 0x64]), 1),
			("F2 02 contact", crpFrame(0xF2, [0x02, 0x03, 0x41, 0x6E, 0x61, 0x00, 0x30, 0x30, 0x39, 0x39]), 2),
		]
	}

	func testEachPrivateFrameMatchesItsRedactedRecordingByCommandSubAndSize() {
		for (name, frame, keep) in privateFrames {
			let recording = redacted(frame, keep: keep)
			XCTAssertNotEqual(recording, frame, "\(name): the fixture must really be redacted")
			XCTAssertTrue(sameAfterMask(recorded: [recording], sent: [frame]), name)
			// Um byte a mais no payload real muda o tamanho: divergência.
			let longer = crpFrame(frame[4], Array(frame[5...]) + [0x01])
			XCTAssertFalse(sameAfterMask(recorded: [recording], sent: [longer]), "\(name): a different size must not match")
		}
	}

	func testTheKeptPrefixIsStillCompared() {
		let contact = crpFrame(0xF2, [0x02, 0x03, 0x41, 0x6E, 0x61, 0x00])
		let otherId = crpFrame(0xF2, [0x02, 0x04, 0x41, 0x6E, 0x61, 0x00])
		XCTAssertFalse(sameAfterMask(recorded: [redacted(contact, keep: 2)], sent: [otherId]), "F2 02 keeps the contact id")
		let todayWeather = crpFrame(0xB5, [0x00, 0x01, 0x19])
		let sosMessages = crpFrame(0xB5, [0x01, 0x01, 0x19])
		XCTAssertFalse(sameAfterMask(recorded: [redacted(todayWeather, keep: 1)], sent: [sosMessages]), "B5 keeps the sub")
		let profile = crpFrame(0x12, [0xAF, 0x46, 0x24, 0x00])
		let menstrualSameSize = crpFrame(0x75, [0xAF, 0x46, 0x24, 0x00])
		XCTAssertFalse(sameAfterMask(recorded: [redacted(profile, keep: 0)], sent: [menstrualSameSize]), "the cmd is compared")
	}

	/// Com bloco de 20 (MTU 23), um `F2 02` de 50 bytes sai em três escritas e a gravação tem os três pedaços redigidos;
	/// o frame seguinte volta a ser comparado inteiro.
	func testAFragmentedContactIsMaskedAcrossItsContinuations() {
		let payload: [UInt8] = [0x02, 0x00] + (0..<43).map { UInt8(0x41 + $0 % 26) }
		let frame = crpFrame(0xF2, payload, block20: true)
		XCTAssertEqual(frame.count, 50)
		let sent = fragments(frame, block: 20)
		let recorded = fragments(redacted(frame, keep: 2), block: 20)
		XCTAssertEqual(sent.map(\.count), [20, 20, 10])
		XCTAssertTrue(sameAfterMask(recorded: recorded, sent: sent))

		let heartRate = crpFrame(0x1F, [0x01], block20: true)
		let otherHeartRate = crpFrame(0x1F, [0x02], block20: true)
		XCTAssertTrue(sameAfterMask(recorded: recorded + [heartRate], sent: sent + [heartRate]))
		XCTAssertFalse(sameAfterMask(recorded: recorded + [heartRate], sent: sent + [otherHeartRate]), "the state ends with the frame")

		var shorterTail = sent
		shorterTail[2].removeLast()
		XCTAssertFalse(sameAfterMask(recorded: recorded, sent: shorterTail), "a continuation of another size must not match")
	}

	func testPublicFramesAndTheCallEndAreComparedWhole() {
		let callEnd = crpFrame(0x41, [0xFF])
		XCTAssertTrue(sameAfterMask(recorded: [callEnd], sent: [callEnd]))
		XCTAssertFalse(sameAfterMask(recorded: [callEnd], sent: [crpFrame(0x41, [0x00])]), "41 FF has no data and stays whole")
		XCTAssertFalse(sameAfterMask(recorded: [crpFrame(0xF2, [0x00])], sent: [crpFrame(0xF2, [0xEF])]), "F2 00 is not private")
		XCTAssertFalse(sameAfterMask(recorded: [crpFrame(0x1A, [0x00])], sent: [crpFrame(0x1A, [0x01])]))
		XCTAssertFalse(sameAfterMask(recorded: [crpFrame(0x53, [0x0E])], sent: [crpFrame(0x53, [0x0F])]))
		XCTAssertTrue(sameAfterMask(recorded: [crpFrame(0x61, [])], sent: [crpFrame(0x61, [])]))
	}

	func testTheSetTimeStillMasksOnlyTheSeconds() {
		let recorded = crpFrame(0x31, [0x6A, 0xE5, 0x9C, 0x10, 0x08])
		XCTAssertTrue(sameAfterMask(recorded: [recorded], sent: [crpFrame(0x31, [0x11, 0x22, 0x33, 0x44, 0x08])]))
		XCTAssertFalse(sameAfterMask(recorded: [recorded], sent: [crpFrame(0x31, [0x6A, 0xE5, 0x9C, 0x10, 0x09])]))
	}

	func testTheFrameKeyNeverShowsPrivateBytes() {
		let masker = CrpTxMasker()
		XCTAssertEqual(masker.frameKey(crpFrame(0x12, [0xAF, 0x46, 0x24, 0x00])), "12")
		XCTAssertEqual(masker.frameKey(crpFrame(0x75, [0xF7, 0x0F])), "75")
		XCTAssertEqual(masker.frameKey(crpFrame(0x41, [0x08, 0x54])), "41")
		XCTAssertEqual(masker.frameKey(crpFrame(0x41, [0xFF])), "41/FF")
		XCTAssertEqual(masker.frameKey(crpFrame(0xB5, [0x00, 0x01])), "B5/00")
		XCTAssertEqual(masker.frameKey(crpFrame(0xF2, [0x02, 0x03, 0x4A])), "F2/02")
		XCTAssertEqual(masker.frameKey(crpFrame(0xF2, [0x00])), "F2/00")
		XCTAssertEqual(masker.frameKey(crpFrame(0x53, [0x0E])), "53/0E")
		XCTAssertEqual(masker.frameKey(crpFrame(0x61, [])), "61")
		XCTAssertEqual(masker.frameKey(crpFrame(0x31, [0x6A, 0xE5, 0x9C, 0x10, 0x08])), "31")
		let continuation = fragments(crpFrame(0xF2, [0x02, 0x00] + Array(repeating: 0x41, count: 30), block20: true), block: 20)[1]
		XCTAssertNil(masker.frameKey(continuation))
	}
}
