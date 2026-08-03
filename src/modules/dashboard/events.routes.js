"use strict";
const express = require("express");
const { requireAuth } = require("../../middlewares/auth");

async function fetchEvents(db, lastId, limit = 100) {
  return db("dashboard_events")
    .where("id", ">", Number(lastId) || 0)
    .where("expires_at", ">", db.fn.now())
    .orderBy("id")
    .limit(limit);
}

async function latestEventId(db) {
  const row = await db("dashboard_events").max({ id: "id" }).first();
  return Number(row?.id || 0);
}

function eventsRouter({ db }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/cursor", async (req, res, next) => {
    try {
      res.json({ ok: true, data: { lastId: await latestEventId(db) } });
    } catch (error) {
      next(error);
    }
  });
  router.get("/poll", async (req, res, next) => {
    try {
      res.json({ ok: true, data: await fetchEvents(db, req.query.after, 100) });
    } catch (error) {
      next(error);
    }
  });
  router.get("/", async (req, res, next) => {
    let closed = false;
    let timer;
    let heartbeat;
    try {
      res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      let lastId = Number(req.get("last-event-id") || req.query.after) || 0;
      const send = async () => {
        if (closed) return;
        const rows = await fetchEvents(db, lastId, 100);
        for (const row of rows) {
          lastId = Number(row.id);
          const payload =
            typeof row.payload === "string"
              ? JSON.parse(row.payload)
              : row.payload;
          res.write(
            `id: ${row.id}\nevent: ${row.type}\ndata: ${JSON.stringify(payload)}\n\n`,
          );
        }
      };
      await send();
      timer = setInterval(
        () =>
          send().catch(() => {
            clearInterval(timer);
            res.end();
          }),
        3000,
      );
      heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20000);
      req.on("close", () => {
        closed = true;
        clearInterval(timer);
        clearInterval(heartbeat);
      });
    } catch (error) {
      if (!res.headersSent) next(error);
      else res.end();
    }
  });
  return router;
}

module.exports = { eventsRouter, fetchEvents, latestEventId };
