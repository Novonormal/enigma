const WHATSAPP_NUMBER = "5565999999999";
const DEFAULT_MESSAGE = "Olá, vim pelo site e quero mais informações sobre a Enigma.";

const buildWhatsAppUrl = (message = DEFAULT_MESSAGE) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

document.querySelectorAll("[data-whatsapp]").forEach((link) => {
  const message = link.getAttribute("data-message") || DEFAULT_MESSAGE;
  link.setAttribute("href", buildWhatsAppUrl(message));
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener noreferrer");
});

const header = document.querySelector("[data-header]");
const menu = document.querySelector("[data-menu]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const currentPage = document.body.getAttribute("data-page");

document.querySelector(`[data-nav="${currentPage}"]`)?.classList.add("is-active");

const closeMenu = () => {
  menu?.classList.remove("is-open");
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Abrir menu");
};

const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 24);
syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = menu?.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
  menuToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
});

menu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("click", (event) => {
  if (!menu?.classList.contains("is-open")) return;
  if (!menu.contains(event.target) && !menuToggle?.contains(event.target)) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

document.querySelector(".form-contato")?.addEventListener("submit", function (event) {
  event.preventDefault();
  const nome = this.querySelector('[aria-label="Nome"]')?.value || "";
  const telefone = this.querySelector('[aria-label="Telefone"]')?.value || "";
  const interesse = this.querySelector('[aria-label="Interesse"]')?.value || "";
  const mensagem = this.querySelector("textarea")?.value || "";
  const texto = `Olá! Vim pelo site da Enigma.\n\nNome: ${nome}\nTelefone: ${telefone}\nInteresse: ${interesse}\nMensagem: ${mensagem}`;
  window.open(buildWhatsAppUrl(texto), "_blank", "noopener");
});

(() => {
  const modal = document.getElementById("modal-maioridade");
  if (!modal) return;
  const verified = sessionStorage.getItem("idade_verificada");
  if (!verified) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
  document.getElementById("btn-sim")?.addEventListener("click", () => {
    sessionStorage.setItem("idade_verificada", "1");
    modal.style.display = "none";
    document.body.style.overflow = "";
  });
  document.getElementById("btn-nao")?.addEventListener("click", () => {
    window.location.href = "https://www.google.com.br";
  });
})();
