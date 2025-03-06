// services/google/handleDelete.js
import { oauth2Client } from '../auth/autheticationGoogle.js';
import { google } from 'googleapis';
import updateManyChatCustomField from '../manychat/manyChatset.js'; // Importa a função para atualizar o ManyChat

/**
 * Cancela um evento no Google Calendar.
 * @param {Object} args - Argumentos necessários para cancelar o evento.
 * @returns {Object} Resultado do cancelamento ou erro.
 */
export async function handleDelete(args) {
  const { EventID: eventId } = args;

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log('Dados recebidos para deleção:', args);

    // Verifica se o EventID foi passado
    if (!eventId) {
      throw new Error('Event ID não encontrado para o usuário especificado.');
    }

    // Deletar o evento do Google Calendar
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId, // Usa o eventId passado nos argumentos
    });

    console.log(`Evento deletado com sucesso: ${eventId}`);

    // Retorna sucesso
    return {
      message: 'Evento deletado com sucesso.',
    };
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    throw new Error('Erro ao deletar evento: ' + error.message);
  }
}
