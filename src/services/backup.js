import openai from './openAiClient.js';
import transcribeAudio from './handleTranscription.js';
import { VerificationRunStatus } from './verificationStatus.js';
import updateManyChatCustomField from '../manychat/manyChatset.js';
import assistantFunctions from './assistantFunctions.js';
import downloadAudio from './../utilities/handleDownAudio.js';
import {GetUserInfo} from './../google/handleSaveSheets.js';
import pdfParse from 'pdf-parse';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import { isFirstContact } from './../utilities/userStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Objeto para armazenar a fila de mensagens por usuário
const userMessagesQueue = new Map();

// Função de delay (caso necessário para simulações)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Processa a fila de mensagens de um usuário específico.
 * Se for a primeira interação, não gera resposta via assistant,
 * apenas envia uma mensagem pré-definida de boas-vindas e a adiciona na thread.
 * Caso contrário, gera a resposta do assistant continuando a conversa.
 */
async function processUserQueue(userID, userThread, manyChatConfig) {
  const userData = userMessagesQueue.get(userID);
  if (!userData) return;

  // Junta todas as mensagens acumuladas
  const accumulatedMessage = userData.messages.join(' ');
  // Remove a fila do usuário após iniciar o processamento
  userMessagesQueue.delete(userID);

  // Verifica se é o primeiro contato do usuário
  const primeiroContato = await isFirstContact(userID);
  if (primeiroContato) {
    // Armazena a mensagem do usuário na thread
    await openai.beta.threads.messages.create(userThread, {
      role: 'user',
      content: accumulatedMessage,
    });
    await GetUserInfo(userID, manyChatConfig);
    const readyMessage = `Olá, é um prazer ter você por aqui! 💚 O Tirze Slim combina a Tirzepatida com um acompanhamento multiprofissional para garantir um emagrecimento seguro e eficaz. Ele atua no controle do apetite, metabolismo e na melhora dos hábitos de forma sustentável! Para entendermos melhor o seu caso, qual sua meta de perda de peso? Vamos conversar! 😉`;
    await openai.beta.threads.messages.create(userThread, {
      role: 'assistant',
      content: readyMessage,
    });
    await updateManyChatCustomField(userID, null, readyMessage, null, null, null, manyChatConfig);
    return; // Interrompe o processamento para a primeira interação
  }
  

  // Se não for o primeiro contato, continua com o processamento normal:
  const currentDate = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD');
  const currentDayOfWeek = moment().tz('America/Sao_Paulo').format('dddd');

  try {
    const draResponsavel = manyChatConfig.draResponsavel;

    const horario = `- Horário de atendimento
Dra Marina:
Quartas/ Quintas: 14h às 20h presencial ou online
Sextas: 9-14h presencial ou online

Dra Marilia:
Quartas/ Quintas: 13h30 às 19h30 presencial ou online
Sextas: 9h30-14h30 presencial ou online
`;

    const additionalInstructions = `
A médica responsável por este atendimento e agendamento é a ${draResponsavel}.
Essa é a data de hoje: ${currentDate}, e hoje é ${currentDayOfWeek}. / Sempre pergunte o nome do paciente e se apresente no primeiro contato / ao listar horários livres retorne somente 1 horário para cada 3 dias. / retorne somente horários que estejam dentro do ${horario}. Leve em consideração a ${draResponsavel} e seus horários para disponibilizar horários livres / Ao ser perguntado sobre tirzeslim fale sobre sem falar o preço.
`;

    console.log(`Enviando mensagem acumulada para o OpenAI no ThreadID: ${userThread}`);
    await openai.beta.threads.messages.create(userThread, {
      role: 'user',
      content: accumulatedMessage,
    });

    console.log('Criando execução de run no OpenAI');
    const run = await openai.beta.threads.runs.create(userThread, {
      assistant_id: process.env.ASSISTANT,
      tools: [
        {
          type: 'file_search',
          file_search: {
            max_num_results: 3,
            ranking_options: { score_threshold: 0.6 },
          },
        },
        ...assistantFunctions,
      ],
      tool_choice: { type: "file_search" },
      additional_instructions: additionalInstructions,
    });

    const runId = run.id;
    let runStatus = run.status;
    console.log('Run iniciado:', runId, 'Status inicial:', runStatus);

    const finalRunStatus = await VerificationRunStatus(
      userThread,
      runId,
      runStatus,
      userID,
      manyChatConfig
    );
    console.log('Status final do run:', finalRunStatus);

    // Obtém as mensagens do OpenAI
    const messages = await openai.beta.threads.messages.list(userThread);
    if (!messages || messages.data.length === 0) {
      console.error("Nenhuma mensagem retornada pelo OpenAI!");
      return;
    }
    let lastMessage = messages.data[0].content[0].text.value;
    console.log("Última mensagem do OpenAI antes do filtro:", lastMessage);

    // Remove menções a documentos (p.ex.: 【18:0†arquivo.docx】) e realiza trim
    const finalMessage = lastMessage.replace(/【.*?】/g, '').trim();

    // Divide a mensagem em partes
    const parts = finalMessage.split(/(?<=[?])\s+/).filter(part => part && part.trim() !== '');
    let part1 = parts.length > 0 ? parts[0] : null;
    let part2 = parts.length > 1 ? parts[1] : null;
    let part3 = parts.length > 2 ? parts[2] : null;
    let part4 = parts.length > 3 ? parts[3] : null;

    console.log('Partes da mensagem filtradas:', { part1, part2, part3, part4 });
    await updateManyChatCustomField(userID, null, part1, part2, part3, part4, manyChatConfig);
  } catch (error) {
    console.error('Erro ao processar a mensagem acumulada:', error);
  }
}

/**
 * Função principal para receber e processar as mensagens.
 * As mensagens são enfileiradas por usuário e processadas de forma assíncrona após um período de inatividade.
 */
export async function handleChat(req, res) {
  console.log('Iniciou handleChat:');
  console.log('Dados recebidos:', req.body);

  const {
    Nome: userName,
    ManychatID: userID,
    ThreadID: userThread,
    Pergunta: userMessage,
    PerguntaMidia: userMessageMidia,
    inter: userMessageInter,
    manyChatSource
  } = req.body;

  try {
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

    let transcricao = '';

    // Verifica se a PerguntaMidia contém imagem, áudio ou PDF
    const imageExtensions = ['png', 'jpeg', 'jpg', 'gif'];
    const audioExtensions = ['ogg', 'mp3', 'wav', 'm4a', 'flac', 'mpga', 'mpeg', 'webm'];
    const pdfExtensions = ['pdf'];

    const isImage = userMessageMidia && imageExtensions.some(ext => userMessageMidia.endsWith(`.${ext}`));
    const isAudio = userMessageMidia && audioExtensions.some(ext => userMessageMidia.endsWith(`.${ext}`));
    const isPDF = userMessageMidia && pdfExtensions.some(ext => userMessageMidia.endsWith(`.${ext}`));

    if (isAudio) {
      const fileName = `audio_${userID}_${Date.now()}.ogg`;
      const outputPath = path.join(__dirname, '../../audios', fileName);

      console.log(`Iniciando download do áudio em: ${userMessageMidia}`);
      await downloadAudio(userMessageMidia, outputPath);
      console.log('Áudio baixado com sucesso:', outputPath);

      // Transcreve o áudio usando a API do Whisper da OpenAI
      transcricao = await transcribeAudio(outputPath);
      console.log('Transcrição do áudio:', transcricao);
    } else if (isImage) {
      console.log('A PerguntaMidia contém uma imagem:', userMessageMidia);
    } else if (isPDF) {
      console.log('A PerguntaMidia contém um PDF:', userMessageMidia);
      try {
        console.log(`Iniciando download do PDF diretamente da URL: ${userMessageMidia}`);
        const response = await fetch(userMessageMidia);
        if (!response.ok) {
          throw new Error(`Erro ao fazer o download do PDF: ${response.statusText}`);
        }
        const pdfBuffer = await response.buffer();
        console.log('PDF carregado na memória com sucesso.');
        const pdfData = await pdfParse(pdfBuffer);
        console.log('Conteúdo extraído do PDF:', pdfData.text);
        transcricao = pdfData.text;
      } catch (error) {
        console.error('Erro ao processar o PDF:', error);
      }
    } else {
      console.log('A PerguntaMidia não é um formato suportado ou está ausente:', userMessageMidia);
    }

    // Prepara o conteúdo da mensagem para enviar ao OpenAI
    console.log('Preparando conteúdo da mensagem');
    const messageContent = [];

    if (userMessage && typeof userMessage === 'string') {
      messageContent.push({
        type: 'text',
        text: `${userMessage || ''}\n${transcricao || ''}`.trim(),
      });
      console.log('Texto adicionado ao conteúdo da mensagem:', `${userMessage || ''}\n${transcricao || ''}`.trim());
    }

    if (isImage) {
      messageContent.push({
        type: 'image_url',
        image_url: { url: userMessageMidia },
      });
      console.log('Imagem adicionada ao conteúdo da mensagem:', userMessageMidia);
    }

    const finalContent = messageContent.length > 0 ? messageContent : 'No content provided';
    console.log('Conteúdo final preparado para o OpenAI:', finalContent);

    // Combina a mensagem e/ou transcrição para enfileiramento
    const combinedMessage = `${userMessage || ''}\n${transcricao || ''}`.trim();
    console.log('Mensagem combinada:', combinedMessage);

    // Armazena a mensagem na fila do usuário
    if (userMessagesQueue.has(userID)) {
      userMessagesQueue.get(userID).messages.push(combinedMessage);
      console.log('Mensagem adicionada à fila do usuário:', userID);
    } else {
      const userData = {
        messages: [combinedMessage],
        timeout: setTimeout(() => {
          console.log('Timeout expirado para o usuário:', userID);
          processUserQueue(userID, userThread, manyChatConfig);
        }, 12000),
      };
      userMessagesQueue.set(userID, userData);
      console.log('Novo usuário adicionado à fila:', userID);
    }

    res.status(200).send('Sua mensagem foi recebida e está sendo processada.');
  } catch (error) {
    console.error('Erro na API do GPT:', error);
    res.status(500).send('Erro ao processar a mensagem');
  }
}
