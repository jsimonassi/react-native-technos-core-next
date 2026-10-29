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
	s.platforms = { :ios => "16.0" }
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
