const fs = require("fs");
const path = require("path");

const DAYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
const OWNER = process.env.GITHUB_OWNER || "Novonormal";
const REPO = process.env.GITHUB_REPO || "enigma";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN || "";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "enigma2026";
const MANIFEST_PATH = "uploads/agenda/agenda.json";

const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
};

const emptyAgenda = () => ({
  updatedAt: null,
  days: Object.fromEntries(DAYS.map((day) => [day, null]))
});

const authOk = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [user, pass] = decoded.split(":");
  return user === ADMIN_USER && pass === ADMIN_PASS;
};

const github = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {})
    }
  });
  if (response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "GitHub error");
  return data;
};

const contentUrl = (filePath) =>
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`;

const getContent = (filePath) => github(`${contentUrl(filePath)}?ref=${BRANCH}`);

const putContent = async (filePath, content, message, sha) =>
  github(contentUrl(filePath), {
    method: "PUT",
    body: JSON.stringify({
      message,
      content,
      branch: BRANCH,
      ...(sha ? { sha } : {})
    })
  });

const deleteContent = async (filePath, message, sha) =>
  github(contentUrl(filePath), {
    method: "DELETE",
    body: JSON.stringify({ message, sha, branch: BRANCH })
  });

const readManifest = async () => {
  if (TOKEN) {
    const file = await getContent(MANIFEST_PATH);
    if (!file?.content) return emptyAgenda();
    return JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  }
  const local = path.join(process.cwd(), MANIFEST_PATH);
  if (!fs.existsSync(local)) return emptyAgenda();
  return JSON.parse(fs.readFileSync(local, "utf8"));
};

const publicAgenda = (agenda) => {
  const clone = emptyAgenda();
  clone.updatedAt = agenda.updatedAt || null;
  for (const day of DAYS) {
    const item = agenda.days?.[day];
    if (!item?.path) continue;
    clone.days[day] = {
      ...item,
      src: item.src || `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${item.path}?v=${encodeURIComponent(item.updatedAt || Date.now())}`
    };
  }
  return clone;
};

const extFromMime = (mime, filename = "") => {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  return null;
};

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") return json(res, 200, publicAgenda(await readManifest()));
    if (req.method !== "POST") return json(res, 405, { error: "Método inválido." });
    if (!authOk(req)) return json(res, 401, { error: "Login inválido." });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (body.action === "login") return json(res, 200, { ok: true });
    if (!TOKEN) return json(res, 500, { error: "Configure GITHUB_TOKEN na Vercel." });

    const agenda = await readManifest();
    const now = new Date().toISOString();
    const day = body.day;
    if (!DAYS.includes(day)) return json(res, 400, { error: "Dia inválido." });

    if (body.action === "remove") {
      const old = agenda.days?.[day];
      if (old?.path) {
        const oldFile = await getContent(old.path);
        if (oldFile?.sha) await deleteContent(old.path, `Remove agenda flyer ${day}`, oldFile.sha);
      }
      agenda.days[day] = null;
      agenda.updatedAt = now;
    } else if (body.action === "upload") {
      const ext = extFromMime(body.mime, body.filename);
      if (!ext || !body.base64) return json(res, 400, { error: "Imagem inválida." });
      const filePath = `uploads/agenda/${day}.${ext}`;
      const old = agenda.days?.[day];
      if (old?.path && old.path !== filePath) {
        const oldFile = await getContent(old.path);
        if (oldFile?.sha) await deleteContent(old.path, `Replace agenda flyer ${day}`, oldFile.sha);
      }
      const file = await getContent(filePath);
      await putContent(filePath, body.base64, `Update agenda flyer ${day}`, file?.sha);
      agenda.days[day] = {
        path: filePath,
        filename: body.filename || `${day}.${ext}`,
        mime: body.mime,
        updatedAt: now
      };
      agenda.updatedAt = now;
    } else {
      return json(res, 400, { error: "Ação inválida." });
    }

    const manifest = await getContent(MANIFEST_PATH);
    await putContent(
      MANIFEST_PATH,
      Buffer.from(JSON.stringify(agenda, null, 2)).toString("base64"),
      "Update agenda manifest",
      manifest?.sha
    );
    return json(res, 200, publicAgenda(agenda));
  } catch (error) {
    return json(res, 500, { error: error.message || "Erro interno." });
  }
};
