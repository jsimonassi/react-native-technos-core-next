const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const root = path.resolve(__dirname, "..");
const pkg = require("../package.json");

const escape = value => value.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");

/**
 * A biblioteca vive em `..` e não tem node_modules próprio: tudo (react, react-native) vem do node_modules do exemplo.
 *
 * @type {import("@react-native/metro-config").MetroConfig}
 */
const config = {
	watchFolders: [root],
	resolver: {
		extraNodeModules: {
			[pkg.name]: root,
		},
		nodeModulesPaths: [path.resolve(__dirname, "node_modules")],
		blockList: [new RegExp(`^${escape(path.join(root, "node_modules"))}\\/.*$`)],
	},
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
