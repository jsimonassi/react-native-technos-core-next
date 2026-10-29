const path = require("path");
const pkg = require("../package.json");

// Liga a biblioteca da raiz do repositório sem precisar dela no node_modules.
module.exports = {
	project: {
		ios: {
			automaticPodsInstallation: false,
		},
	},
	dependencies: {
		[pkg.name]: {
			root: path.join(__dirname, ".."),
		},
	},
};
