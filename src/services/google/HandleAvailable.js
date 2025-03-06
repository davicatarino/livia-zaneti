import { oauth2Client } from './../auth/autheticationGoogle.js';
import { google } from 'googleapis';
import moment from 'moment-timezone';

/**
 * Calcula os slots livres (de 1 hora) para os próximos 15 dias úteis (apenas quarta, quinta e sexta)
 * a partir de 15 dias da data atual, considerando eventos de múltiplas agendas e
 * restringindo os horários disponíveis conforme o médico responsável.
 *
 * Os horários de atendimento são definidos da seguinte forma:
 *   - Se o nome do responsável contém "marina" (ex: "Dra Marina Zaneti"):
 *       Quartas e Quintas: 14:00 - 20:00  
 *       Sextas: 09:00 - 14:00  
 *   - Se o nome contém "marilia" (ex: "Dra Marilia ..."):
 *       Quartas e Quintas: 13:30 - 19:30  
 *       Sextas: 09:30 - 14:30
 *
 * Para cada dia útil (quarta, quinta ou sexta) em que haja um slot disponível,
 * o código retorna apenas o primeiro slot (de 1 hora) encontrado.
 *
 * @param {object} param0
 * @param {object} param0.manyChatConfig - Deve conter a propriedade `draResponsavel`
 * @returns {String} Lista formatada dos slots livres (sem informações de depuração)
 */
export async function handleAvailable({ manyChatConfig }) {
  const draResponsavel = manyChatConfig.draResponsavel;
  console.log(`Médica responsável recebida: ${draResponsavel}`);

  const calendarIds = [
    'o20bhh9d9mlauoto2it46llncvdn7aao@import.calendar.google.com',
    'primary'
  ];
  if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
    console.error("Erro: calendarIds não é um array válido.", calendarIds);
    throw new Error("Os IDs dos calendários devem ser passados como um array válido e não vazio.");
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const timezone = 'America/Sao_Paulo';

  // Define o ponto de partida: 15 dias a partir de hoje
  const today = moment().tz(timezone).startOf('day');
  const startingDay = today.clone().add(15, 'days');
  const timeMin = startingDay.clone().startOf('day');
  const timeMax = startingDay.clone().add(60, 'days').endOf('day');
  console.log(`Intervalo de consulta: ${timeMin.toISOString()} a ${timeMax.toISOString()}`);

  try {
    // Consulta a disponibilidade de cada calendário em paralelo
    const responses = await Promise.all(
      calendarIds.map(async (calendarId) => {
        try {
          console.log(`Consultando disponibilidade para o calendário: ${calendarId}`);
          const response = await calendar.freebusy.query({
            requestBody: {
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              timeZone: timezone,
              items: [{ id: calendarId }],
            },
          });
          console.log(`Resposta recebida para o calendário: ${calendarId}`, response.data);
          const busy = (response.data.calendars[calendarId]?.busy || [])
            .map(interval => {
              if (!interval.start || !interval.end) {
                console.warn(`Evento sem start/end em ${calendarId}:`, interval);
                return null;
              }
              return {
                start: moment(interval.start).tz(timezone),
                end: moment(interval.end).tz(timezone)
              };
            })
            .filter(item => item);
          return { calendarId, busy };
        } catch (err) {
          console.error(`Erro ao consultar calendário ${calendarId}:`, err);
          return { calendarId, busy: [] };
        }
      })
    );

    // Combina e ordena os intervalos ocupados
    let combinedBusyTimes = responses.flatMap(res => res.busy);
    combinedBusyTimes.sort((a, b) => a.start - b.start);

    // Array que armazenará o primeiro slot (de 1 hora) de cada dia útil processado
    const availableSlotsPerDay = [];

    // Processa dia a dia, a partir de startingDay, até obter 15 dias úteis (quarta, quinta ou sexta)
    let workingDaysCount = 0;
    let currentDay = startingDay.clone();
    while (workingDaysCount < 15) {
      const dayOfWeek = currentDay.day(); // 0=Dom, 1=Seg, ..., 6=Sáb
      if ([3, 4, 5].includes(dayOfWeek)) {  // Apenas quarta (3), quinta (4) e sexta (5)
        workingDaysCount++;

        // Define o horário de atendimento conforme o médico responsável
        let dayStart, dayEnd;
        const normalizedDra = draResponsavel.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const lowerDra = normalizedDra.toLowerCase();
        if (lowerDra.includes("marina")) {
          if (dayOfWeek === 3 || dayOfWeek === 4) { // Quartas e Quintas
            dayStart = currentDay.clone().set({ hour: 14, minute: 0, second: 0, millisecond: 0 });
            dayEnd   = currentDay.clone().set({ hour: 20, minute: 0, second: 0, millisecond: 0 });
          } else if (dayOfWeek === 5) { // Sextas
            dayStart = currentDay.clone().set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
            dayEnd   = currentDay.clone().set({ hour: 14, minute: 0, second: 0, millisecond: 0 });
          }
        } else if (lowerDra.includes("marilia")) {
          if (dayOfWeek === 3 || dayOfWeek === 4) { // Quartas e Quintas
            dayStart = currentDay.clone().set({ hour: 13, minute: 30, second: 0, millisecond: 0 });
            dayEnd   = currentDay.clone().set({ hour: 19, minute: 30, second: 0, millisecond: 0 });
          } else if (dayOfWeek === 5) { // Sextas
            dayStart = currentDay.clone().set({ hour: 9, minute: 30, second: 0, millisecond: 0 });
            dayEnd   = currentDay.clone().set({ hour: 14, minute: 30, second: 0, millisecond: 0 });
          }
        }
        if (!dayStart || !dayEnd) {
          currentDay.add(1, 'day');
          continue;
        }

        // Filtra os eventos ocupados que se sobrepõem ao período de atendimento
        let dayBusy = combinedBusyTimes.filter(interval =>
          interval.end.isAfter(dayStart) && interval.start.isBefore(dayEnd)
        )
        .map(interval => {
          const busyStart = moment.max(interval.start, dayStart);
          const busyEnd = moment.min(interval.end, dayEnd);
          return { start: busyStart, end: busyEnd };
        })
        .filter(interval => interval.start && interval.end && interval.start.isBefore(interval.end));

        // Ordena e mescla os intervalos ocupados
        dayBusy.sort((a, b) => a.start - b.start);
        let mergedBusy = [];
        dayBusy.forEach(interval => {
          if (mergedBusy.length === 0) {
            mergedBusy.push(interval);
          } else {
            let last = mergedBusy[mergedBusy.length - 1];
            if (interval.start.isSameOrBefore(last.end)) {
              last.end = moment.max(last.end, interval.end);
            } else {
              mergedBusy.push(interval);
            }
          }
        });

        // Calcula os gaps (intervalos livres) dentro do período de atendimento
        let freeIntervals = [];
        if (mergedBusy.length === 0) {
          freeIntervals.push({ start: dayStart.clone(), end: dayEnd.clone() });
        } else {
          if (dayStart.isBefore(mergedBusy[0].start)) {
            freeIntervals.push({ start: dayStart.clone(), end: mergedBusy[0].start.clone() });
          }
          for (let j = 0; j < mergedBusy.length - 1; j++) {
            if (mergedBusy[j].end.isBefore(mergedBusy[j + 1].start)) {
              freeIntervals.push({ start: mergedBusy[j].end.clone(), end: mergedBusy[j + 1].start.clone() });
            }
          }
          if (mergedBusy[mergedBusy.length - 1].end.isBefore(dayEnd)) {
            freeIntervals.push({ start: mergedBusy[mergedBusy.length - 1].end.clone(), end: dayEnd.clone() });
          }
        }

        // Subdivide cada gap em slots de 1 hora e retorna apenas o primeiro slot deste dia
        let slots = [];
        freeIntervals.forEach(interval => {
          let slotStart = interval.start.clone();
          while (slotStart.clone().add(60, 'minutes').isSameOrBefore(interval.end)) {
            let slotEnd = slotStart.clone().add(60, 'minutes');
            slots.push({
              day: currentDay.format('dddd, DD/MM/YYYY'),
              start: slotStart.format('HH:mm'),
              end: slotEnd.format('HH:mm')
            });
            slotStart.add(60, 'minutes');
          }
        });

        // Retorna somente o primeiro slot do dia
        const limitedSlots = slots.slice(0, 1);
        if (limitedSlots.length > 0) {
          availableSlotsPerDay.push(...limitedSlots);
        }
      }
      currentDay.add(1, 'day');
    }

    const formattedSlots = availableSlotsPerDay
      .map(slot => `- ${slot.day}: ${slot.start} - ${slot.end}`)
      .join('\n');

    return `Horários Livres para ${draResponsavel}:\n${formattedSlots}`;
  } catch (error) {
    console.error('Erro ao recuperar horários disponíveis:', error);
    throw new Error('Erro ao recuperar horários disponíveis: ' + error.message);
  }
}
