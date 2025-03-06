import { oauth2Client } from '../auth/autheticationGoogle.js';
import { google } from 'googleapis';
import moment from 'moment-timezone';
import { setManyChatCustomField } from '../manychat/manyChatset.js';
import { saveUserSchedule } from '../google/handleSaveSheets.js'; // Ajuste o caminho se necessário
import Event from '../../models/eventModels.js';

export async function handleEvent(args) {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    console.log('Dados recebidos:', args);

    // Extração de dados do usuário (incluindo os novos campos: Endereco e PagamentoAntecipado)
    const {
      Name: userName,
      ManyChatID: userID,
      Email: userEmail,
      Horario: userHour,
      Telefone: userTel,
      CPF: userCpf,
      Procedimento: userProced,
      ComoNosConheceu: userComoNosConheceu,
      Nascimento: userNascimento,
      endereco: userEndereco,           // <-- agora em minúsculo
      PagamentoConfirmado: userPagamento, // <-- agora combina
      DraResponsavel: userDraResponsavel,
      modelo: userModel,                // <-- agora em minúsculo
    } = args;
    

    const manyChatSource = userDraResponsavel === 'Marina' ? 'manyChat2' : 'manyChat1';
    const color = userDraResponsavel === 'Marina' ? '1' : '2';

    console.log('Configurando ManyChat');
    const manyChatConfigs = {
      manyChat1: {
        apiKey: process.env.MC_KEY_1,
        customFields: {
          part1: process.env.R1_ID_1,
          part2: process.env.R2_ID_1,
          part3: process.env.R3_ID_1,
          part4: process.env.R4_ID_1,
        },
        draResponsavel: 'Dra Marília Zaneti',
      },
      manyChat2: {
        apiKey: process.env.MC_KEY_2,
        customFields: {
          part1: process.env.R1_ID_2,
          part2: process.env.R2_ID_2,
          part3: process.env.R3_ID_2,
          part4: process.env.R4_ID_2,
        },
        draResponsavel: 'Dra Marina Zaneti',
      },
    };

    const manyChatConfig = manyChatConfigs[manyChatSource];
    if (!manyChatConfig) {
      console.error('Fonte ManyChat inválida');
      res.status(400).send('Fonte ManyChat inválida.');
      return;
    }

    console.log('ManyChat configurado:', manyChatConfig);

    // Definindo localização e dados de conferência com base no modelo do evento
    let location;
    let conferenceData = null;

    if (userModel === 'Presencial') {
      location = "Presencialmente no Espaço Zaneti: Av Angélica, 688, São Paulo - SP.";
    } else if (userModel === 'On-line') {
      location = "Reunião online no Google Meet";
      conferenceData = {
        createRequest: {
          requestId: `meet_${userName}_${Date.now()}`, // ID único para a reunião
          conferenceSolutionKey: {
            type: "hangoutsMeet" // Define o tipo de conferência para Google Meet
          }
        }
      };
    }

    // Função para adicionar 1 hora ao horário do evento
    function addOneHourToISO(isoString) {
      const dateTime = moment.utc(isoString);
      dateTime.add(1, 'hours');
      return dateTime.toISOString();
    }

    // Validação do horário do evento
    if (!userHour) {
      throw new Error("Horário do evento não fornecido.");
    }

    const startDateTime = moment(userHour).toISOString();
    const endDateTime = addOneHourToISO(userHour); // Adiciona 1 hora ao horário de início

    if (moment(startDateTime).isSameOrAfter(endDateTime)) {
      throw new Error("O horário de término do evento deve ser posterior ao horário de início.");
    }

    // Configuração do evento
    const event = {
      summary: `${userDraResponsavel}`,
      description: `
        Consulta agendada no Espaço Zaneti.
        Nome: ${userName}
        CPF: ${userCpf}
        Telefone: ${userTel}
        Nascimento: ${userNascimento}
        Procedimento: ${userProced}
        Como nos conheceu: ${userComoNosConheceu}
      `,
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Sao_Paulo',
      },
      colorId: color,
      attendees: [
        { email: 'espacozaneti@gmail.com' }, // E-mail da clínica
        { email: userEmail },                // E-mail do participante
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },  // Lembrete por e-mail 1 hora antes
          { method: 'popup', minutes: 10 },    // Notificação push 10 minutos antes
        ],
      },
      location: location,
      conferenceData: conferenceData,
    };
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',  // Notifica todos os convidados
    });
    
    console.log('Evento criado:', response.data);

    // Armazenando o eventId no ManyChat (se necessário)
    const eventId = response.data.id;
    const fieldConfirmationID = userDraResponsavel === 'Marina' ? '12279844' : '12208054';
    const fieldEventID = userDraResponsavel === 'Marina' ? '12279897' : '12213807'; // ID correspondente à doutora
    console.log(`ID de campo selecionado: ${fieldConfirmationID} para ${userDraResponsavel}`);
                
    // Verifica a médica responsável para determinar qual ManyChat usar
    const manyChatKey = userDraResponsavel === 'Marina' ? 'manyChat2' : 'manyChat1';
    
    await setManyChatCustomField(userID, fieldEventID, eventId, manyChatConfig);
    await setManyChatCustomField(userID, fieldConfirmationID, 'sim', manyChatConfig);
    
    console.log(`Campo personalizado ${fieldConfirmationID} atualizado para "sim" no ${manyChatKey}`);
    
    // Salvar os dados no MongoDB
    const newEvent = new Event({
      userName,
      userID,
      userEmail,
      userTel,
      userCpf,
      userProced,
      userComoNosConheceu,
      userNascimento,
      userDraResponsavel,
      eventId,
    });

    await newEvent.save();
    console.log('Dados salvos no MongoDB');

    // Chamando a função para salvar os dados do agendamento na planilha do Google
    // Os campos requeridos:
    // - Nome completo: userName
    // - Data de nascimento: userNascimento
    // - CPF: userCpf
    // - Endereço com CEP: userEndereco
    // - E-mail: userEmail
    // - Fez pagamento antecipado? (Sim/Não): userPagamento
    await saveUserSchedule({
      fullName: userName,
      birthDate: userNascimento,
      cpf: userCpf,
      address: userEndereco,
      email: userEmail,
      advancePayment: userPagamento,
    });
    console.log('Dados de agendamento salvos na planilha do Google.');

    return `Evento criado com sucesso. ID do evento: ${eventId}`;
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    return `Erro ao criar evento: ${error.message}`;
  }
}
