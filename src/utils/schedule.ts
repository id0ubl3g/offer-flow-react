import type { Schedule } from "../api/types";

export function nextRun(schedules: Schedule[], from = new Date()): Date | null {
  let best: Date | null = null;

  for (const schedule of schedules.filter((item) => item.active)) {
    const [hour, minute] = schedule.send_time.split(":").map(Number);

    for (let offset = 0; offset < 8; offset++) {
      const candidate = new Date(from);
      candidate.setDate(from.getDate() + offset);
      candidate.setHours(hour, minute, 0, 0);

      const weekday = candidate.getDay() === 0 ? 7 : candidate.getDay();

      if (candidate > from && schedule.days_of_week.includes(weekday)) {
        if (!best || candidate < best) {
          best = candidate;
        }

        break;
      }
    }
  }

  return best;
}

export function describeNextRun(date: Date | null): string {
  if (!date) {
    return "Nenhum horário ativo";
  }

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (date.toDateString() === today.toDateString()) {
    return `Hoje às ${time}`;
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return `Amanhã às ${time}`;
  }

  const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });

  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} às ${time}`;
}
