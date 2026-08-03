"use strict";

const session = require("express-session");
const { KnexSessionStore } = require("../modules/auth/session-store");

function sessionMiddleware(db, env) {
  return session({
    name: env.SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    store: new KnexSessionStore(db),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  });
}

module.exports = { sessionMiddleware };
