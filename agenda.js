const AGENDA_DAYS = [
  ["segunda", "Segunda"],
  ["terca", "Terça"],
  ["quarta", "Quarta"],
  ["quinta", "Quinta"],
  ["sexta", "Sexta"],
  ["sabado", "Sábado"],
  ["domingo", "Domingo"]
];

const agendaGrid = document.getElementById("agenda-grid");

const agendaCard = ([key, label], item) => {
  const image = item?.src;
  return `
    <article class="agenda-card reveal">
      <h2>${label}</h2>
      ${
        image
          ? `<img src="${image}" alt="Flyer da Enigma para ${label}" loading="lazy" decoding="async">`
          : `<div class="agenda-empty"><span>Sem evento</span></div>`
      }
    </article>
  `;
};

const loadAgenda = async () => {
  if (!agendaGrid) return;
  agendaGrid.innerHTML = '<div class="agenda-empty"><span>Carregando agenda</span></div>';
  try {
    const response = await fetch("/api/agenda", { cache: "no-store" });
    const data = response.ok ? await response.json() : await fetch("uploads/agenda/agenda.json").then((r) => r.json());
    agendaGrid.innerHTML = AGENDA_DAYS.map((day) => agendaCard(day, data.days?.[day[0]])).join("");
  } catch {
    agendaGrid.innerHTML = AGENDA_DAYS.map((day) => agendaCard(day, null)).join("");
  }
};

loadAgenda();
