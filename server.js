require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = process.env.DATABASE_PATH || "./data/dn39.sqlite";
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS announcements (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS applications (
 kind TEXT PRIMARY KEY, available INTEGER NOT NULL DEFAULT 0,
 slots INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
const appKinds = [
 ["IPJ", 0, 0, "Inspectoratul de Poliție Județean"],
 ["ISU", 0, 0, "Inspectoratul pentru Situații de Urgență"],
 ["Staff", 0, 0, "Echipa administrativă DN39"]
];
const insertApp = db.prepare("INSERT OR IGNORE INTO applications(kind,available,slots,description) VALUES(?,?,?,?)");
appKinds.forEach(x => insertApp.run(...x));
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)");
insertSetting.run("staffUrl", process.env.STAFF_APPLICATION_URL || "https://discord.gg/ZsZ9QDxuMx");

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "30kb" }));
app.use(express.urlencoded({ extended: false, limit: "30kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: path.dirname(path.resolve(dbPath)) }),
  secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("SESSION_SECRET is required in production"); })() : "local-development-secret-change-me"),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, "public")));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const ownerOnly = (req, res, next) => req.session && req.session.owner ? next() : res.status(401).json({ error: "Autentificare necesară." });
const validText = (s, max) => typeof s === "string" && s.trim().length > 0 && s.trim().length <= max;

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/public", (req, res) => {
  const apps = db.prepare("SELECT kind,available,slots,description FROM applications ORDER BY CASE kind WHEN 'IPJ' THEN 1 WHEN 'ISU' THEN 2 ELSE 3 END").all();
  const announcements = db.prepare("SELECT id,title,body,created_at FROM announcements ORDER BY id DESC LIMIT 30").all();
  const staffUrl = db.prepare("SELECT value FROM settings WHERE key='staffUrl'").get()?.value || "";
  res.json({ apps, announcements, staffUrl });
});
app.get("/api/session", (req, res) => res.json({ authenticated: !!(req.session && req.session.owner), username: process.env.OWNER_USERNAME || "OwnerDn39RomaniaRoleplay" }));
app.post("/api/login", loginLimiter, async (req, res) => {
  const username = process.env.OWNER_USERNAME || "OwnerDn39RomaniaRoleplay";
  const password = process.env.OWNER_PASSWORD;
  if (!password) return res.status(503).json({ error: "Setează OWNER_PASSWORD în variabilele de mediu ale serverului." });
  const suppliedUser = String(req.body.username || "");
  const suppliedPass = String(req.body.password || "");
  const userOk = suppliedUser.length === username.length && suppliedUser === username;
  const passOk = suppliedPass.length === password.length && await bcrypt.compare(suppliedPass, await bcrypt.hash(password, 10));
  if (!userOk || !passOk) return res.status(401).json({ error: "Date de autentificare incorecte." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Nu s-a putut crea sesiunea." });
    req.session.owner = true;
    res.json({ ok: true });
  });
});
app.post("/api/logout", ownerOnly, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.post("/api/announcements", ownerOnly, (req, res) => {
  const { title, body } = req.body || {};
  if (!validText(title, 100) || !validText(body, 2000)) return res.status(400).json({ error: "Titlul (max. 100) și mesajul (max. 2000) sunt obligatorii." });
  const info = db.prepare("INSERT INTO announcements(title,body) VALUES(?,?)").run(title.trim(), body.trim());
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.delete("/api/announcements/:id", ownerOnly, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalid." });
  db.prepare("DELETE FROM announcements WHERE id=?").run(id);
  res.json({ ok: true });
});
app.put("/api/applications/:kind", ownerOnly, (req, res) => {
  const kind = req.params.kind;
  if (!["IPJ", "ISU", "Staff"].includes(kind)) return res.status(404).json({ error: "Categorie invalidă." });
  const available = req.body.available === true || req.body.available === "true";
  const slots = Number(req.body.slots);
  const description = typeof req.body.description === "string" ? req.body.description.trim().slice(0, 300) : "";
  if (!Number.isInteger(slots) || slots < 0 || slots > 999) return res.status(400).json({ error: "Numărul trebuie să fie între 0 și 999." });
  db.prepare("UPDATE applications SET available=?,slots=?,description=? WHERE kind=?").run(available ? 1 : 0, slots, description, kind);
  res.json({ ok: true });
});
app.put("/api/settings/staff-url", ownerOnly, (req, res) => {
  const url = String(req.body.url || "").trim();
  try {
    const parsed = new URL(url);
    if (!["https:"].includes(parsed.protocol)) throw new Error();
  } catch { return res.status(400).json({ error: "Introdu un URL HTTPS valid." }); }
  db.prepare("INSERT INTO settings(key,value) VALUES('staffUrl',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(url);
  res.json({ ok: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`DN39 site listening on ${PORT}`));
