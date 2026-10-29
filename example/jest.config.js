const path = require("path");

const libraryRoot = path.resolve(__dirname, "..");
const exampleModules = path.join(__dirname, "node_modules");

/**
 * O nome do pacote aponta para o mock oficial (o TurboModule não existe no Jest). Imports profundos
 * ("react-native-technos-core-next/src/...") apontam para os arquivos reais, para testar o wrapper e usar os
 * helpers do mock. `modulePaths` deixa os arquivos de ../src acharem o react-native deste exemplo.
 * Os caminhos são absolutos para a config continuar valendo quando o Jest roda com outro `--rootDir`.
 *
 * @type {import("jest").Config}
 */
module.exports = {
	preset: path.join(exampleModules, "react-native"),
	moduleNameMapper: {
		"^react-native-technos-core-next$": path.join(libraryRoot, "src/__mocks__/react-native-technos-core-next.ts"),
		"^react-native-technos-core-next/(.*)$": path.join(libraryRoot, "$1"),
	},
	modulePaths: [exampleModules],
	testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
};
