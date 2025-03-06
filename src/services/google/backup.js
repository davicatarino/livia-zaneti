import { oauth2Client } from './../auth/autheticationGoogle.js';
import { google } from 'googleapis';
import moment from 'moment-timezone';

/**
 * Calcula horários livres nos dias 15 a 30 a partir da data atual em múltiplas agendas.
 * @returns {String} Horários disponíveis formatados ou erro.
 */
export async function handleAvailable() {
  const calendarIds = [
    'o20bhh9d9mlauoto2it46llncvdn7aao@import.calendar.google.com',
    'primary'
  ];
  // Garante que calendarIds seja um array
  if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
    console.error("Erro: calendarIds não é um array válido.", calendarIds);
    throw new Error("Os IDs dos calendários devem ser passados como um array válido e não vazio.");
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const timezone = 'America/Sao_Paulo';

  // Define o intervalo de 15 a 30 dias a partir de hoje
  const today = moment().tz(timezone).startOf('day');
  const timeMin = today.clone().add(15, 'days').startOf('day').toISOString();
  const timeMax = today.clone().add(30, 'days').endOf('day').toISOString();

  try {
    // Faz a requisição para cada calendário simultaneamente
    const responses = await Promise.all(
      calendarIds.map(async (calendarId) => {
        try {
          const response = await calendar.freebusy.query({
            requestBody: {
              timeMin,
              timeMax,
              timeZone: timezone,
              items: [{ id: calendarId }],
            },
          });
          
          return {
            calendarId,
            busy: response.data.calendars[calendarId]?.busy?.map(interval => ({
              start: moment(interval.start).tz(timezone),
              end: moment(interval.end).tz(timezone),
            })) || [],
          };
        } catch (err) {
          console.error(`Erro ao consultar calendário ${calendarId}:`, err);
          return { calendarId, busy: [] };
        }
      })
    );

    let freeTimes = [];
    let debugInfo = [];

    // Mapeia todos os horários ocupados de todas as agendas e os combina
    let combinedBusyTimes = responses.flatMap(res => res.busy)
      .sort((a, b) => a.start - b.start);

    debugInfo.push('Intervalos Ocupados Combinados:');
    combinedBusyTimes.forEach((interval, index) => {
      debugInfo.push(`  Evento ${index + 1}: ${interval.start.format('DD/MM/YYYY HH:mm')} - ${interval.end.format('DD/MM/YYYY HH:mm')}`);
    });

    // Processa os dias no intervalo de 15 a 30
    for (let day = 0; day < 15; day++) {
      let currentDay = moment(timeMin).add(day, 'days');
      let dayStart = currentDay.clone().set({ hour: 09, minute: 0, second: 0 });
      let dayEnd = currentDay.clone().set({ hour: 20, minute: 0, second: 0 });

      // Filtra os períodos ocupados que intersectam com o dia atual
      const dayBusy = combinedBusyTimes.filter(interval =>
        interval.start.isBefore(dayEnd) && interval.end.isAfter(dayStart)
      );

      debugInfo.push(`\nDia: ${currentDay.format('DD/MM/YYYY')}`);
      if (dayBusy.length === 0) {
        debugInfo.push('Nenhum evento ocupado neste dia.');
        freeTimes.push({
          start: dayStart.format('dddd, DD/MM HH:mm'),
          end: dayEnd.format('dddd, DD/MM HH:mm'),
        });
        continue;
      }

      let lastEndTime = dayStart;
      dayBusy.forEach(interval => {
        if (lastEndTime.isBefore(interval.start)) {
          addFreeTime(lastEndTime, interval.start);
          debugInfo.push(`  Livre: ${lastEndTime.format('HH:mm')} - ${interval.start.format('HH:mm')}`);
        }
        if (lastEndTime.isBefore(interval.end)) {
          lastEndTime = interval.end;
        }
      });

      if (lastEndTime.isSameOrBefore(dayEnd)) {
        addFreeTime(lastEndTime, dayEnd);
        debugInfo.push(`  Livre: ${lastEndTime.format('HH:mm')} - ${dayEnd.format('HH:mm')}`);
      }
    }

    function addFreeTime(startTime, endTime) {
      const adjustedEndTime = moment(endTime).subtract(1, 'hours');
      if (startTime.isBefore(adjustedEndTime)) {
        freeTimes.push({
          start: startTime.format('dddd, DD/MM HH:mm'),
          end: adjustedEndTime.format('dddd, DD/MM HH:mm'),
        });
      }
    }

    function formatFreeTimes(freeTimes) {
      return freeTimes.map(ft => `${ft.start} - ${ft.end}`).join(', ');
    }

    function formatDebugInfo(debugInfo) {
      return debugInfo.join('\n');
    }

    const formattedFreeTimes = formatFreeTimes(freeTimes);
    const formattedDebugInfo = formatDebugInfo(debugInfo);

    return `Horários Livres:\n${formattedFreeTimes}\n\nInformações de Depuração:\n${formattedDebugInfo}`;
  } catch (error) {
    console.error('Erro ao recuperar horários disponíveis:', error);
    throw new Error('Erro ao recuperar horários disponíveis: ' + error.message);
  }
}
