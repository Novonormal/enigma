const http = require("http");
const fs = require("fs");
const path = require("path");

const base = process.cwd();
const port = 8091;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "enigma2026";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const serve = (res, file) => {
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
};

const emptyAgenda = () => ({
  updatedAt: null,
  days: {
    terca: null,
    quarta: null,
    quinta: null,
    sexta: null,
    sabado: null,
    domingo: null,
  },
});

const agendaFile = path.join(base, "uploads", "agenda", "agenda.json");
const uploadsDir = path.join(base, "uploads", "agenda");

const ensureUploads = () => {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
};

const loadAgenda = () => {
  ensureUploads();
  if (!fs.existsSync(agendaFile)) return emptyAgenda();
  try {
    return { ...emptyAgenda(), ...JSON.parse(fs.readFileSync(agendaFile, "utf8")) };
  } catch {
    return emptyAgenda();
  }
};

const saveAgenda = (agenda) => {
  ensureUploads();
  fs.writeFileSync(agendaFile, JSON.stringify(agenda, null, 2));
};

const extFromMime = (mime, name) => {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  const ext = path.extname(name).toLowerCase().replace(".", "");
  return ["jpg", "jpeg", "png", "webp"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : null;
};

const readBody = async (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });

const authOk = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [user, pass] = decoded.split(":");
  return user === ADMIN_USER && pass === ADMIN_PASS;
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/api/agenda") {
      if (req.method === "GET") {
        const file = path.join(base, "uploads/agenda/agenda.json");
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(fs.readFileSync(file, "utf8"));
      }
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "method not allowed" }));
      }
      if (!authOk(req)) {
        res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "login invalid" }));
      }
      return (async () => {
        const body = await readBody(req);
        if (body.action === "login") {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify({ ok: true }));
        }

        const days = ["terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
        if (!days.includes(body.day)) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify({ error: "dia invalido" }));
        }

        const agenda = loadAgenda();
        if (body.action === "remove") {
          const old = agenda.days[body.day];
          if (old?.filename) {
            const oldPath = path.join(uploadsDir, old.filename);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
          agenda.days[body.day] = null;
          agenda.updatedAt = new Date().toISOString();
          saveAgenda(agenda);
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify(agenda));
        }

        if (body.action === "upload") {
          const ext = extFromMime(body.mime, body.filename || "");
          if (!ext || !body.base64) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            return res.end(JSON.stringify({ error: "imagem invalida" }));
          }
          ensureUploads();
          const filename = `${body.day}.${ext}`;
          const target = path.join(uploadsDir, filename);
          fs.writeFileSync(target, Buffer.from(body.base64, "base64"));
          const old = agenda.days[body.day];
          if (old?.filename && old.filename !== filename) {
            const oldPath = path.join(uploadsDir, old.filename);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
          agenda.days[body.day] = {
            filename,
            mime: body.mime,
            updatedAt: new Date().toISOString(),
            src: `/uploads/agenda/${filename}`,
          };
          agenda.updatedAt = new Date().toISOString();
          saveAgenda(agenda);
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          return res.end(JSON.stringify(agenda));
        }

        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "action invalid" }));
      })();
    }

    if (urlPath === "/index.html") {
      res.writeHead(301, { Location: "/" });
      return res.end();
    }
    if (urlPath.endsWith(".html")) {
      res.writeHead(301, { Location: urlPath.replace(/\.html$/, "") });
      return res.end();
    }

    if (urlPath === "/") return serve(res, path.join(base, "index.html"));
    if (urlPath === "/sobre" || urlPath === "/sobre/") return serve(res, path.join(base, "sobre.html"));
    if (urlPath === "/servicos" || urlPath === "/servicos/") return serve(res, path.join(base, "servicos.html"));
    if (urlPath === "/contato" || urlPath === "/contato/") return serve(res, path.join(base, "contato.html"));
    if (urlPath === "/agenda" || urlPath === "/agenda/") return serve(res, path.join(base, "agenda.html"));
    if (urlPath === "/adm" || urlPath === "/adm/") return serve(res, path.join(base, "adm/index.html"));
    if (urlPath === "/adm/index.html") return serve(res, path.join(base, "adm/index.html"));

    const clean = urlPath.replace(/^\//, "");
    const file = path.join(base, clean);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return serve(res, file);

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  })
  .listen(port, () => console.log(`http://127.0.0.1:${port}`));
