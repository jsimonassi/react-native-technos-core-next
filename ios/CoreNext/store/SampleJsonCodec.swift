import Foundation
import TechnosWatchProtocol

/// Formato em disco do `FileSampleStore`: o mesmo do `SampleJsonCodec` do Android, `{"version":1,"items":[...]}`, com
/// os nomes das propriedades do domínio. O `version` permite migrar o formato sem perder o histórico.
///
/// Decodificação tolerante: um item inválido é pulado (e contado em `skipped`) em vez de descartar o arquivo inteiro,
/// porque perder o histórico local pode perder passos que o relógio já não devolve.
enum SampleJsonCodec {
	static let version = 1

	struct DecodeResult<T> {
		let items: [T]
		let skipped: Int
	}

	enum CodecError: Error {
		case notAnObject
		case missingItems
	}

	static func encodeSteps(_ samples: [StepsSample]) throws -> Data {
		try wrap(samples.map { sample in
			[
				"atEpochMillis": sample.atEpochMillis,
				"steps": sample.steps,
				"mode": sample.mode,
				"calories": sample.calories,
				"distanceMeters": sample.distanceMeters,
			] as [String: Any]
		})
	}

	static func decodeSteps(_ data: Data) throws -> DecodeResult<StepsSample> {
		try decodeItems(data) { item in
			guard
				let at = int64(item["atEpochMillis"]),
				let steps = int32(item["steps"]),
				let mode = int32(item["mode"]),
				let calories = int32(item["calories"]),
				let distance = double(item["distanceMeters"])
			else { return nil }
			return StepsSample(atEpochMillis: at, steps: steps, mode: mode, calories: calories, distanceMeters: distance)
		}
	}

	static func encodeSleep(_ sessions: [SleepSession]) throws -> Data {
		try wrap(sessions.map { session in
			[
				"dayKey": session.dayKey,
				"startEpochMillis": session.startEpochMillis,
				"endEpochMillis": session.endEpochMillis,
				"startIso": session.startIso,
				"endIso": session.endIso,
				"stages": session.stages.map { stage in
					[
						"type": stage.type.name,
						"startEpochMillis": stage.startEpochMillis,
						"endEpochMillis": stage.endEpochMillis,
						"startIso": stage.startIso,
						"endIso": stage.endIso,
					] as [String: Any]
				},
				"totalMinutes": session.totalMinutes,
				"lightMinutes": session.lightMinutes,
				"deepMinutes": session.deepMinutes,
				"remMinutes": session.remMinutes,
				"awakeMinutes": session.awakeMinutes,
			] as [String: Any]
		})
	}

	static func decodeSleep(_ data: Data) throws -> DecodeResult<SleepSession> {
		try decodeItems(data) { item in
			guard
				let dayKey = item["dayKey"] as? String,
				let start = int64(item["startEpochMillis"]),
				let end = int64(item["endEpochMillis"]),
				let startIso = item["startIso"] as? String,
				let endIso = item["endIso"] as? String,
				let stagesJson = item["stages"] as? [[String: Any]],
				let total = int32(item["totalMinutes"]),
				let light = int32(item["lightMinutes"]),
				let deep = int32(item["deepMinutes"]),
				let rem = int32(item["remMinutes"]),
				let awake = int32(item["awakeMinutes"])
			else { return nil }
			var stages: [SleepStage] = []
			for stage in stagesJson {
				guard
					let typeName = stage["type"] as? String,
					let type = SleepStageType.entries.first(where: { $0.name == typeName }),
					let stageStart = int64(stage["startEpochMillis"]),
					let stageEnd = int64(stage["endEpochMillis"]),
					let stageStartIso = stage["startIso"] as? String,
					let stageEndIso = stage["endIso"] as? String
				else { return nil }
				stages.append(SleepStage(type: type, startEpochMillis: stageStart, endEpochMillis: stageEnd, startIso: stageStartIso, endIso: stageEndIso))
			}
			return SleepSession(
				dayKey: dayKey, startEpochMillis: start, endEpochMillis: end, startIso: startIso, endIso: endIso, stages: stages,
				totalMinutes: total, lightMinutes: light, deepMinutes: deep, remMinutes: rem, awakeMinutes: awake
			)
		}
	}

	static func encodeDayKeys(_ dayKeys: [String]) throws -> Data {
		try wrap(dayKeys)
	}

	static func decodeDayKeys(_ data: Data) throws -> DecodeResult<String> {
		let items = try root(data)
		var result: [String] = []
		var skipped = 0
		for item in items {
			if let value = item as? String, !value.isEmpty {
				result.append(value)
			} else {
				skipped += 1
			}
		}
		return DecodeResult(items: result, skipped: skipped)
	}

	private static func wrap(_ items: [Any]) throws -> Data {
		try JSONSerialization.data(withJSONObject: ["version": version, "items": items], options: [.sortedKeys])
	}

	private static func root(_ data: Data) throws -> [Any] {
		guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw CodecError.notAnObject }
		guard let items = object["items"] as? [Any] else { throw CodecError.missingItems }
		return items
	}

	private static func decodeItems<T>(_ data: Data, decode: ([String: Any]) -> T?) throws -> DecodeResult<T> {
		let items = try root(data)
		var result: [T] = []
		result.reserveCapacity(items.count)
		var skipped = 0
		for item in items {
			if let object = item as? [String: Any], let decoded = decode(object) {
				result.append(decoded)
			} else {
				skipped += 1
			}
		}
		return DecodeResult(items: result, skipped: skipped)
	}

	// O JSONSerialization devolve NSNumber; um booleano (CFBoolean) não vale como número aqui.
	private static func number(_ value: Any?) -> NSNumber? {
		guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
		return number
	}

	private static func int64(_ value: Any?) -> Int64? { number(value)?.int64Value }

	private static func int32(_ value: Any?) -> Int32? {
		guard let raw = number(value)?.int64Value, raw >= Int64(Int32.min), raw <= Int64(Int32.max) else { return nil }
		return Int32(raw)
	}

	private static func double(_ value: Any?) -> Double? { number(value)?.doubleValue }
}
