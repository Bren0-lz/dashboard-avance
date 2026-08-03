"use strict";

const crypto = require("node:crypto");

function requestContext(req, res, next) {
  req.id = req.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  res.setHeader("X-Request-ID", req.id);
  res.locals.requestId = req.id;
  next();
}

module.exports = { requestContext };
