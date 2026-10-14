const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const previous=config.resolver.blockList;
config.resolver.blockList=[...(Array.isArray(previous)?previous:previous?[previous]:[]),
  /[\\/]apps[\\/]native[\\/]dist(?:[\\/]|$)/,
  /[\\/]\.(?:android-sdk|android-runtime|lavish)(?:[\\/]|$)/,
];
module.exports = config;
