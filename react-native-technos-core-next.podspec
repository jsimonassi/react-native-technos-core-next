require "json"

# Pod iOS do Core: o host Swift (ios/CoreNext/, sem React) e o shim ObjC++ do TurboModule
# (ios/CoreNext/turbomodule/RCTNativeCoreNext.mm), sobre o framework do Repo 1. Desenho em docs/ios-pendente.md;
# como gerar o framework, rodar no simulador e no iPhone em ios/README.md.
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# O framework do Repo 1 não é versionado aqui (binário de ~22 MB, gerado do código do Repo 1): sem ele o pod install
# para com a instrução, em vez de falhar no link.
xcframework = File.join(__dir__, "ios", "Frameworks", "TechnosWatchProtocol.xcframework")
unless File.exist?(File.join(xcframework, "Info.plist"))
	raise Pod::Informative, "[react-native-technos-core-next] Falta ios/Frameworks/TechnosWatchProtocol.xcframework. " \
		"Rode ios/scripts/sync-xcframework.sh --build (gera no technos-watch-protocol e copia) e repita o pod install"
end

Pod::Spec.new do |s|
	s.name = "react-native-technos-core-next"
	s.version = package["version"]
	s.summary = package["description"]
	s.homepage = package["homepage"] || "https://example.invalid/react-native-technos-core-next"
	s.license = package["license"]
	s.authors = package["author"] || "Grupo Technos"
	# 15.1 é o mínimo do RN 0.81 (`react-native/scripts/cocoapods/helpers.rb:83-85`) e o deployment target do
	# example; com 16.0 o `pod install` do example recusaria este pod. O app Mormaii (16.0) aceita um pod 15.1.
	s.platforms = { :ios => "15.1" }
	# Consumido por :path no Podfile durante a PoC; não há repositório remoto publicado.
	s.source = { :git => "https://example.invalid/react-native-technos-core-next.git", :tag => "v#{s.version}" }

	# Só ios/CoreNext: ios/Package.swift e ios/Tests/ são o pacote Swift dos testes no simulador, fora do app.
	s.source_files = "ios/CoreNext/**/*.{h,m,mm,swift}"
	s.swift_version = "5.9"
	# Nome de módulo sem hífen: o AppDelegate faz `import TechnosCoreNext`, e o shim importa TechnosCoreNext-Swift.h.
	s.module_name = "TechnosCoreNext"
	s.frameworks = "CoreBluetooth", "UIKit"
	s.pod_target_xcconfig = {
		"DEFINES_MODULE" => "YES",
	}

	# Framework guarda-chuva do Repo 1 (o módulo :bridge, com o :protocol exportado), estático (`isStatic = true` lá),
	# copiado de bridge/build/XCFrameworks/release/ por ios/scripts/sync-xcframework.sh.
	s.vendored_frameworks = "ios/Frameworks/TechnosWatchProtocol.xcframework"

	# Dependências do React Native e da arquitetura nova (codegen do NativeCoreNextSpec).
	install_modules_dependencies(s)
end
