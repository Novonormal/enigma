const DAYS = [
  ["segunda", "Segunda"],
  ["terca", "Terça"],
  ["quarta", "Quarta"],
  ["quinta", "Quinta"],
  ["sexta", "Sexta"],
  ["sabado", "Sábado"],
  ["domingo", "Domingo"]
];

let auth = JSON.parse(sessionStorage.getItem("enigmaAdm") || "null");
let agenda = { days: {} };
let currentDay = "segunda";
const ADMIN_USER = "admin";
const ADMIN_PASS = "enigma2026";

const $ = (id) => document.getElementById(id);
const basicAuth = () => `Basic ${btoa(`${auth.user}:${auth.pass}`)}`;

const setStatus = (text) => {
  $("panel-status").textContent = text || "";
};

const renderTabs = () => {
  $("day-tabs").innerHTML = DAYS.map(([key, label]) =>
    `<button class="adm-tab ${key === currentDay ? "is-active" : ""}" data-day="${key}" type="button">${label}</button>`
  ).join("");
  document.querySelectorAll(".adm-tab").forEach((button) => {
    button.addEventListener("click", () => {
      currentDay = button.dataset.day;
      renderPanel();
    });
  });
};

const renderPreview = () => {
  const item = agenda.days?.[currentDay];
  $("preview").innerHTML = item?.src ? `<img src="${item.src}" alt="Preview do flyer">` : "<span>Sem evento</span>";
};

const renderPanel = () => {
  $("current-day").textContent = DAYS.find(([key]) => key === currentDay)?.[1] || "Dia";
  renderTabs();
  renderPreview();
};

const loadAgenda = async () => {
  const response = await fetch("/api/agenda", { cache: "no-store" });
  agenda = response.ok ? await response.json() : { days: {} };
  renderPanel();
};

const showPanel = async () => {
  $("login-view").hidden = true;
  $("panel-view").hidden = false;
  await loadAgenda();
};

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  auth = { user: $("adm-user").value.trim(), pass: $("adm-pass").value };
  if (auth.user !== ADMIN_USER || auth.pass !== ADMIN_PASS) {
    $("login-status").textContent = "Login inválido.";
    return;
  }
  const response = await fetch("/api/agenda", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    body: JSON.stringify({ action: "login" })
  });
  if (!response.ok) {
    $("login-status").textContent = "Login inválido.";
    return;
  }
  sessionStorage.setItem("enigmaAdm", JSON.stringify(auth));
  await showPanel();
});

$("logout-button").addEventListener("click", () => {
  sessionStorage.removeItem("enigmaAdm");
  location.reload();
});

$("flyer-file").addEventListener("change", () => {
  const file = $("flyer-file").files[0];
  if (!file) return renderPreview();
  const url = URL.createObjectURL(file);
  $("preview").innerHTML = `<img src="${url}" alt="Preview do flyer">`;
});

$("upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = $("flyer-file").files[0];
  if (!file) {
    setStatus("Escolha uma imagem.");
    return;
  }
  setStatus("Salvando...");
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const response = await fetch("/api/agenda", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    body: JSON.stringify({ action: "upload", day: currentDay, filename: file.name, mime: file.type, base64 })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(data.error || "Erro ao salvar.");
    return;
  }
  agenda = data;
  $("flyer-file").value = "";
  renderPanel();
  setStatus("Flyer salvo.");
});

$("remove-button").addEventListener("click", async () => {
  setStatus("Removendo...");
  const response = await fetch("/api/agenda", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: basicAuth() },
    body: JSON.stringify({ action: "remove", day: currentDay })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(data.error || "Erro ao remover.");
    return;
  }
  agenda = data;
  renderPanel();
  setStatus("Flyer removido.");
});

if (auth) showPanel();
