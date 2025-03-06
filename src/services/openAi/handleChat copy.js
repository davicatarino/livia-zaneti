// handleChat.js

import openai from './openAiClient.js';
import transcribeAudio from './handleTranscription.js';
import { VerificationRunStatus } from './verificationStatus.js';
import updateManyChatCustomField from '../manychat/manyChatset.js';
import assistantFunctions from './assistantFunctions.js';
import downloadAudio from './../utilities/handleDownAudio.js';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Objeto para armazenar as mensagens dos usuários
const userMessagesQueue = new Map();

// Set para rastrear usuários que já tiveram sua primeira interação processada
//const processedUsers = new Set();

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
  } = req.body;

  try {
    let transcricao = '';

    // Verifica se há um link de mídia
    if (userMessageMidia && userMessageMidia.startsWith('https://many')) {
      const fileName = `audio_${userID}_${Date.now()}.ogg`;
      const outputPath = path.join(__dirname, '../../audios', fileName);

      console.log(`Iniciando download do áudio em: ${userMessageMidia}`);
      await downloadAudio(userMessageMidia, outputPath);

      console.log('Áudio baixado com sucesso:', outputPath);

      // Transcreve o áudio usando a API do Whisper da OpenAI
      transcricao = await transcribeAudio(outputPath);
      console.log('Transcrição do áudio:', transcricao);
    }

    // Acumula a mensagem e/ou transcrição no objeto userMessagesQueue
    const combinedMessage = `${userMessage || ''}\n${transcricao || ''}`.trim();

    if (userMessagesQueue.has(userID)) {
      // Já existe um timer em andamento para este usuário
      // Adiciona a mensagem à lista existente
      userMessagesQueue.get(userID).messages.push(combinedMessage);
    } else {
      // Cria uma nova entrada para o usuário e inicia o timer
      const userData = {
        messages: [combinedMessage],
        timeout: setTimeout(async () => {
          // Quando o timeout expirar, processa as mensagens acumuladas
          const userData = userMessagesQueue.get(userID);
          const accumulatedMessage = userData.messages.join(' ');

          console.log('Mensagens acumuladas para processamento:', accumulatedMessage);

          // Remove o usuário do mapa
        //  userMessagesQueue.delete(userID);
          const currentDate = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD');
          const currentDayOfWeek = moment().tz('America/Sao_Paulo').format('dddd'); // Adicionando o dia da semana
          
          // Processa a mensagem acumulada
          try {

            /*
            const firstMessage = `Olá! 
Seja muito bem-vinda à nossa clínica! Meu nome é Alicia, faço parte da equipe da Dra. Raphaella Martins e estou aqui para cuidar de você com todo o carinho.

Trabalhamos com:
    • Tratamento anti-rugas e marcas de expressão através do botox, para um rosto mais jovem e descansado.
    • Reestruturação facial com ácido hialurônico incluindo a técnica exclusiva PERFECT LIPS para lábios mais definidos e harmônicos, além de tratamentos para contorno facial, olheiras e maçãs do rosto, devolvendo os contornos naturais.
    • Remoção de gordura na papada destacando a definição do rosto e dando um aspecto mais jovem e magro ao rosto.
    • Tratamento anti-envelhecimento através do bioestimulador de colágeno como o Sculptra, revitalizando a pele e recuperando a firmeza.

Me conta, o mais te incomoda?
Posso te passar mais informações sobre qual procedimento?`;

            const isFirstInteraction = !processedUsers.has(userID);

            // Salva a mensagem do usuário na thread
            console.log('Criando mensagem do usuário no thread');
            await openai.beta.threads.messages.create(userThread, {
              role: 'user',
              content: accumulatedMessage,
            });
            console.log('Mensagem do usuário criada no thread.');

            if (isFirstInteraction) {
              console.log('Primeira interação detectada. Atualizando apenas o ManyChat com a primeira mensagem.');

              // Envia a firstMessage para ManyChat como part1
              await updateManyChatCustomField(userID, null, firstMessage, null, null, null);
              console.log('Primeira mensagem enviada para ManyChat como First Message.');

              // Envia a firstMessage para a thread como assistant
              console.log('Enviando a primeira mensagem para a thread');
              await openai.beta.threads.messages.create(userThread, {
                role: 'assistant',
                content: firstMessage,
              });
              console.log('Primeira mensagem enviada para a thread.');

              // Marca o usuário como processado
              processedUsers.add(userID);
              return;
            }
*/
            // Configura a busca na vector store
            console.log('Criando mensagem do usuário no thread');
            await openai.beta.threads.messages.create(userThread, {
              role: 'user',
              content: accumulatedMessage,
            });
            console.log('Mensagem do usuário criada no thread.');

            console.log('Configurando busca na vector store');
            const run = await openai.beta.threads.runs.create(userThread, {
              assistant_id: 'asst_iCOIuT77nPvLNFQxLhaHpPqG',
              tools: assistantFunctions,
              additional_instructions: `Essa é a data de hoje: ${currentDate}, e hoje é ${currentDayOfWeek}. Leve isso em consideração ao receber a data de agendamento do usuário. utilize a Mensagem Inicial de Saudação  na primeira interação`,
            });

            const runId = run.id;
            let runStatus = run.status;

            console.log(`data de hoje:  ${currentDate}, ${currentDayOfWeek}. `);
            console.log(`Run ID: ${runId}, Status inicial do run: ${runStatus}`);

            const finalRunStatus = await VerificationRunStatus(
              userThread,
              runId,
              runStatus,
              userID, // Passando userID aqui
            );
            console.log('Status final do run:', finalRunStatus);

            const messages = await openai.beta.threads.messages.list(userThread);
            const lastMessage = messages.data[0].content[0].text.value;
            console.log('Resposta da Alice:', lastMessage);
            let finalMessage = lastMessage.replace(/【.*?†.*?】/g, '');

            console.log('Mensagem final processada:', finalMessage);

            const parts = finalMessage.split(/(?<=[.?])\s+/);

            const filteredParts = parts.filter(
              (part) => part && part.trim() !== '',
            );

            const part1 = filteredParts.length > 0 ? filteredParts[0] : null;
            const part2 = filteredParts.length > 1 ? filteredParts[1] : null;
            const part3 = filteredParts.length > 2 ? filteredParts[2] : null;
            const part4 = filteredParts.length > 3 ? filteredParts[3] : null;

            // Envia a resposta para o ManyChat
            await updateManyChatCustomField(userID, null, part1, part2, part3, part4);
            console.log('Resposta enviada para ManyChat');

          } catch (error) {
            console.error('Erro ao processar a mensagem acumulada:', error);
          }
        }, 8000), // Delay de 8 segundos
      };

      userMessagesQueue.set(userID, userData);
    }

    // Retorna uma resposta imediata para não deixar a requisição pendente
    res.status(200).send('Sua mensagem foi recebida e está sendo processada.');

  } catch (error) {
    console.error('Erro na API do GPT:', error);
    res.status(500).send('Erro ao processar a mensagem');
  }
}
