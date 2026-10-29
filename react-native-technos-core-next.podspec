require "json"

# Esqueleto do pod iOS. O iOS NÃO está implementado nesta PoC: não há fontes em ios/ além do README.
# O que falta e as armadilhas já mapeadas estão em ios/README.md e docs/ios-pendente.md.
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

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

	s.source_files = "ios/**/*.{h,m,mm,swift}"
	s.swift_version = "5.9"

	# Módulo de protocolo (Repo 1) gerado por `./gradlew :protocol:assembleTechnosWatchProtocolXCFramework`
	# e copiado para ios/Frameworks/ (ver ios/README.md). É estático (`isStatic = true` no Repo 1).
	s.vendored_frameworks = "ios/Frameworks/TechnosWatchProtocol.xcframework"

	# Dependências do React Native e da arquitetura nova (codegen do NativeCoreNextSpec).
	install_modules_dependencies(s)
end
