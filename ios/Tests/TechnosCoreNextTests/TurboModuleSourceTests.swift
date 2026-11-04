import Foundation
import XCTest

/// Leitura do fonte do `RCTNativeCoreNext.mm` e do spec (`src/specs/NativeCoreNext.ts`). O shim não compila sem o React
/// Native, então não roda nestes testes; o que dá para conferir sem ele está aqui.
enum TurboModuleSource {
	enum SourceError: Error, CustomStringConvertible {
		case unreadable(String)

		var description: String {
			switch self {
			case let .unreadable(path): return "unreadable source \(path)"
			}
		}
	}

	/// Métodos do `.mm` que não são do spec: o ciclo de vida e o despacho de eventos.
	static let lifecycleMethods: Set<String> = ["hostWillEnterForeground", "invalidate", "emitName"]

	/// Raiz do Repo 2, a partir deste arquivo-fonte (o simulador enxerga o disco do Mac, como em `Fixtures.root`).
	static var repo2: URL {
		URL(fileURLWithPath: #filePath)
			.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
	}

	static func text(_ relativePath: String) throws -> String {
		let url = repo2.appendingPathComponent(relativePath)
		guard let text = try? String(contentsOf: url, encoding: .utf8) else { throw SourceError.unreadable(url.path) }
		return text
	}

	static func shim() throws -> String { try text("ios/CoreNext/turbomodule/RCTNativeCoreNext.mm") }

	static func spec() throws -> String { try text("src/specs/NativeCoreNext.ts") }

	/// Os nomes que o `emitName:payload:` do shim despacha (`isEqualToString:@"onX"`).
	static func dispatchedEvents() throws -> [String] {
		matches(#"isEqualToString:@"(on[A-Za-z0-9]+)""#, in: try shim()).map { $0[0] }
	}

	/// Pares (nome comparado, emissor chamado) de cada ramo do despacho: `onX` → `emitOnX:`.
	static func dispatchBranches() throws -> [(name: String, emitter: String)] {
		matches(#"isEqualToString:@"on([A-Za-z0-9]+)"\]\) \{\s*\[self emitOn([A-Za-z0-9]+):value\];"#, in: try shim()).map { ($0[0], $0[1]) }
	}

	/// Os eventos do spec (`readonly onX: CodegenTypes.EventEmitter<...>`).
	static func specEvents() throws -> [String] {
		matches(#"readonly (on[A-Za-z0-9]+): CodegenTypes\.EventEmitter"#, in: try spec()).map { $0[0] }
	}

	/// Os métodos do spec (uma linha por método, com um tab: `nome(argumentos): Retorno;`).
	static func specMethods() throws -> [String] {
		matches(#"^\t([A-Za-z0-9]+)\(.*\): [^;]+;$"#, in: try spec()).map { $0[0] }
	}

	/// O primeiro pedaço do seletor de cada método `- (void)` do shim, sem os de [lifecycleMethods].
	static func shimMethods() throws -> [String] {
		matches(#"^- \(void\)([A-Za-z0-9]+)"#, in: try shim()).map { $0[0] }.filter { !lifecycleMethods.contains($0) }
	}

	/// Um método do shim: o nome (primeiro pedaço do seletor), os parâmetros de objeto (`NSString *`, `NSDictionary *`,
	/// `NSArray *`), se recebe o `reject` de uma Promise e o corpo.
	struct ShimMethod {
		let name: String
		let objectParameters: [String]
		let hasReject: Bool
		let body: String
	}

	/// Os métodos `- (void)` do shim fora de [lifecycleMethods], com o corpo até o `}` da coluna 0 (cada declaração cabe
	/// numa linha).
	static func shimMethodImplementations() throws -> [ShimMethod] {
		let lines = try shim().components(separatedBy: "\n")
		var result: [ShimMethod] = []
		var index = 0
		while index < lines.count {
			let line = lines[index]
			index += 1
			guard let name = matches(#"^- \(void\)([A-Za-z0-9]+)"#, in: line).first?[0], !lifecycleMethods.contains(name) else { continue }
			var body: [String] = []
			while index < lines.count, lines[index] != "}" {
				body.append(lines[index])
				index += 1
			}
			result.append(ShimMethod(
				name: name,
				objectParameters: matches(#"\((?:NSString|NSDictionary|NSArray) \*\)([A-Za-z0-9]+)"#, in: line).map { $0[0] },
				hasReject: line.contains("reject:(RCTPromiseRejectBlock)reject"),
				body: body.joined(separator: "\n")
			))
		}
		return result
	}

	private static func matches(_ pattern: String, in text: String) -> [[String]] {
		guard let regex = try? NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines]) else {
			preconditionFailure("bad pattern \(pattern)")
		}
		let source = text as NSString
		return regex.matches(in: text, range: NSRange(location: 0, length: source.length)).map { match in
			(1..<match.numberOfRanges).map { source.substring(with: match.range(at: $0)) }
		}
	}
}

/// O que o compilador não garante no shim: um método do protocolo do codegen sem implementação é só um aviso (e um
/// crash quando o JS o chama), um evento sem ramo no `emitName:payload:` cai no `NSLog`, perdido para o JS, e um
/// argumento `nil` passado ao framework encerra o processo.
final class TurboModuleSourceTests: XCTestCase {
	func testTheShimImplementsEverySpecMethodAndEachCallsTheCoreBridge() throws {
		let spec = try TurboModuleSource.specMethods()
		let shim = try TurboModuleSource.shimMethods()
		XCTAssertEqual(spec.count, 56, "23 from phase 1, 24 from phase 2 and 9 from phase 3: \(spec)")
		XCTAssertEqual(Set(spec).count, spec.count, "duplicated method in the spec")
		XCTAssertEqual(shim.sorted(), spec.sorted())
		let calls = try TurboModuleSource.shim().components(separatedBy: "[[self coreBridgeFor:_cmd] ").count - 1
		XCTAssertEqual(calls, spec.count, "each method is one call to the CoreBridge")
	}

	/// Um `null` do JS no lugar do argumento inteiro chega `nil`, e o framework encerraria o processo com um
	/// `kotlin.NullPointerException` (DP-100): todo argumento de objeto passa pelo `CNRejectNil` antes do `CoreBridge`.
	func testEveryObjectArgumentIsCheckedForNilBeforeTheCoreBridge() throws {
		let methods = try TurboModuleSource.shimMethodImplementations()
		XCTAssertEqual(methods.count, 56)
		var checked = 0
		for method in methods {
			let call = method.body.range(of: "[[self coreBridgeFor:_cmd] ")
			XCTAssertNotNil(call, method.name)
			for parameter in method.objectParameters {
				let check = "CNRejectNil(\(parameter), @\"\(parameter)\", _cmd, \(method.hasReject ? "reject" : "nil"))"
				guard let found = method.body.range(of: check) else {
					XCTFail("\(method.name): \(check) missing")
					continue
				}
				XCTAssertTrue(call.map { found.lowerBound < $0.lowerBound } ?? false, "\(method.name): \(parameter) checked after the call")
				checked += 1
			}
		}
		XCTAssertEqual(checked, 24, "2 strings of pairDevice, startPairingAttempt and setHeartRateAutomaticCheck, 16 from phase 1 and 2, 2 options from phase 3")
	}

	func testEverySpecEventHasItsBranchInEmitName() throws {
		let spec = try TurboModuleSource.specEvents()
		XCTAssertEqual(spec.count, 27, "13 from phase 1, 4 from phase 2 and 10 from phase 3: \(spec)")
		XCTAssertEqual(try TurboModuleSource.dispatchedEvents().sorted(), spec.sorted())
		let branches = try TurboModuleSource.dispatchBranches()
		XCTAssertEqual(branches.count, spec.count, "each branch calls one emitOnX:")
		for branch in branches {
			XCTAssertEqual(branch.name, branch.emitter, "on\(branch.name) must call emitOn\(branch.name):")
		}
		for name in ["onFindPhone", "onTakeAPicture", "onOpenCameraMode", "onDeviceRequestedCameraMode"] {
			XCTAssertTrue(spec.contains(name), name)
		}
	}

	/// Os 10 eventos e os 9 métodos da fase 3 (S0h): sem o ramo, o `onActivityError` do stub do início se perderia no
	/// `NSLog`, e o JS esperaria o `onActivityStartedV2` para sempre.
	func testThePhase3EventsAndMethodsAreInTheShim() throws {
		let events = [
			"onHistoryHeartRate", "onHistoryStress", "onHistorySpo2", "onHistoryActivityV2", "onActivityStartedV2",
			"onActivityStatusV2", "onActivityUpdateV2", "onActivityCompletedV2", "onActivityError", "onActivityRealTimeSpeed",
		]
		let dispatched = Set(try TurboModuleSource.dispatchedEvents())
		XCTAssertEqual(events.filter { !dispatched.contains($0) }, [], "phase 3 events without a branch in emitName:payload:")
		let methods = [
			"getHistoryHeartRate", "getHistoryStress", "getHistorySpO2", "getHistoryActivityV2", "startActivityByTypeV2",
			"pauseActivityV2", "resumeActivityV2", "stopActivityV2", "checkIosBackgroundLocationPermission",
		]
		let shim = Set(try TurboModuleSource.shimMethods())
		XCTAssertEqual(methods.filter { !shim.contains($0) }, [], "phase 3 methods missing in the shim")
	}
}
