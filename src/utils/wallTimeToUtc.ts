/**
 * Converte data/hora "de parede" em um fuso IANA para instante UTC (ISO).
 * Usado para agendamentos respeitarem o fuso da configuração do usuário.
 */
export function wallTimeInTimezoneToUtcIso(dateYmd: string, hm: string, timeZone: string): string {
  const [year, month, day] = dateYmd.split('-').map(Number);
  const [hour, minute] = hm.split(':').map(Number);
  if (!year || !month || !day || hour === undefined || Number.isNaN(minute)) {
    throw new Error('Data ou hora inválida');
  }
  let tz = timeZone?.trim() || 'America/Sao_Paulo';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    tz = 'America/Sao_Paulo';
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const read = (ms: number) => {
    const parts = formatter.formatToParts(new Date(ms));
    const o: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10);
    }
    return {
      y: o.year,
      mo: o.month,
      d: o.day,
      h: o.hour,
      mi: o.minute,
    };
  };

  let time = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let i = 0; i < 48; i++) {
    const loc = read(time);
    if (
      loc.y === year &&
      loc.mo === month &&
      loc.d === day &&
      loc.h === hour &&
      loc.mi === minute
    ) {
      return new Date(time).toISOString();
    }
    const diff =
      Date.UTC(year, month - 1, day, hour, minute) -
      Date.UTC(loc.y, loc.mo - 1, loc.d, loc.h, loc.mi);
    time += diff;
  }

  return new Date(time).toISOString();
}
