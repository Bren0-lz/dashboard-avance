"use strict";

const session = require("express-session");

class KnexSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }
  get(sid, callback) {
    this.db("sessions")
      .where({ sid })
      .where("expired_at", ">", Date.now())
      .first()
      .then((row) => callback(null, row ? JSON.parse(row.sess) : null))
      .catch(callback);
  }
  set(sid, value, callback = () => {}) {
    const expiredAt = value.cookie?.expires
      ? new Date(value.cookie.expires).getTime()
      : Date.now() + 8 * 60 * 60 * 1000;
    const record = { sid, expired_at: expiredAt, sess: JSON.stringify(value) };
    this.db("sessions")
      .insert(record)
      .onConflict("sid")
      .merge({ expired_at: expiredAt, sess: record.sess })
      .then(() => callback())
      .catch(callback);
  }
  destroy(sid, callback = () => {}) {
    this.db("sessions")
      .where({ sid })
      .delete()
      .then(() => callback())
      .catch(callback);
  }
  touch(sid, value, callback = () => {}) {
    const expiredAt = value.cookie?.expires
      ? new Date(value.cookie.expires).getTime()
      : Date.now() + 8 * 60 * 60 * 1000;
    this.db("sessions")
      .where({ sid })
      .update({ expired_at: expiredAt })
      .then(() => callback())
      .catch(callback);
  }
  clearExpired() {
    return this.db("sessions").where("expired_at", "<=", Date.now()).delete();
  }
}

module.exports = { KnexSessionStore };
