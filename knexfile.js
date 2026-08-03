"use strict";

const { loadEnv } = require("./src/config/env");
const { makeKnexConfig } = require("./src/config/database");

module.exports = makeKnexConfig(loadEnv());
