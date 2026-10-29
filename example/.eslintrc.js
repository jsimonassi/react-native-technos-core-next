module.exports = {
	root: true,
	extends: "@react-native",
	rules: {
		quotes: ["error", "double", { avoidEscape: true }],
		indent: ["error", "tab", { SwitchCase: 1, ignoredNodes: ["TemplateLiteral *"] }],
		"no-tabs": "off",
	},
};
