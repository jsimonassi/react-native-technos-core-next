// swift-tools-version:5.9
// Pacote Swift só para testar o host iOS no simulador, sem React Native (o app usa o pod do podspec da raiz).
// Compila os fontes Swift de CoreNext/ (o shim ObjC++ fica de fora) contra o XCFramework de ios/Frameworks/ e roda
// Tests/TechnosCoreNextTests com `xcodebuild test` num simulador (ver ios/Tests/README.md).
import PackageDescription

let package = Package(
	name: "TechnosCoreNext",
	platforms: [.iOS("15.1")],
	products: [
		.library(name: "TechnosCoreNext", targets: ["TechnosCoreNext"]),
	],
	targets: [
		.binaryTarget(name: "TechnosWatchProtocol", path: "Frameworks/TechnosWatchProtocol.xcframework"),
		.target(
			name: "TechnosCoreNext",
			dependencies: ["TechnosWatchProtocol"],
			path: "CoreNext",
			exclude: ["turbomodule", "README.md", "ble/README.md", "log/README.md", "store/README.md"]
		),
		.testTarget(
			name: "TechnosCoreNextTests",
			dependencies: ["TechnosCoreNext", "TechnosWatchProtocol"],
			path: "Tests/TechnosCoreNextTests"
		),
	]
)
