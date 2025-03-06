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
import { db } from './../utilities/userStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1) SCRIPT: Definição dos passos (exemplo baseado no seu roteiro)
// ============================================================================
const scriptSteps = {
  1: {
    id: 1,
    question: `Olá, é um prazer ter você por aqui! 💚 O Tirze Slim combina a Tirzepatida com um acompanhamento multiprofissional para garantir um emagrecimento seguro e eficaz. Ele atua no controle do apetite, metabolismo e na melhora dos hábitos de forma sustentável! Para entendermos melhor o seu caso, qual o seu nome completo ? Vamos conversar! 😉`,
    requiredInfo: "fullName"
  },
  2: {
    id: 2,
    question: "Agora, para que a Dra. Marina e a Dra. Marília possam te atender melhor, poderia me contar um pouco sobre o que te motiva a buscar o Espaço Zaneti?",
    requiredInfo: "motivation"
  },
  3: {
    id: 3,
    question: "Entendo perfeitamente. E qual é a sua meta de perda de peso?",
    requiredInfo: "weightGoal"
  },
  4: {
    id: 4,
    question: "De 0 a 10, quanto o seu peso impacta na sua qualidade de vida?",
    requiredInfo: "impact"
  },
  5: {
    id: 5,
    question: `Obrigada por compartilhar! Vou te explicar como o Espaço Zaneti pode fazer a diferença na sua jornada:
    
- Tratamentos individualizados: As Dras. Marina e Marília são especialistas em Nutrologia e Psiquiatria, e irão te ajudar a traçar um plano personalizado.
- Abordagem completa: Cuidamos da sua saúde de forma integral, considerando aspectos físicos e emocionais.
- Tecnologia de ponta: Utilizamos equipamentos modernos, como o exame de bioimpedância, para avaliar e monitorar seu progresso.
- Equipe multidisciplinar: Nutricionistas, psicólogos e outros profissionais dando todo suporte.
- Foco em resultados: Emagrecer de forma saudável e sustentável, para que você conquiste o corpo e a saúde que sempre quis!

Em que mais posso te ajudar?`,
    requiredInfo: null
  }
};

///////////////////////////////////////////////////////////////////////////////
// 1) userStateMap e funções getUserStep / setUserStep
///////////////////////////////////////////////////////////////////////////////
// Agora, ao invés de armazenar no userStateMap, vamos buscar e salvar o step
// diretamente no arquivo users.json (via lowdb). Supondo que você exporte db de userStatus.js
// Exemplo de ajuste nos métodos getUserStep / setUserStep, agora usando db.data.processedUsers:


export async function getUserStep(userID) {
  console.log(`[getUserStep] Buscando step para userID: ${userID}`);
  await db.read();

  // Se não existir no JSON, criamos com step = 1
  if (!db.data.processedUsers[userID]) {
    console.log(`[getUserStep] userID: ${userID} não encontrado no JSON. Definindo step=1.`);
    db.data.processedUsers[userID] = { step: 1 };
    await db.write();
    return 1;
  }

  const currentStep = db.data.processedUsers[userID].step;
  console.log(`[getUserStep] userID: ${userID} encontrado. Step atual: ${currentStep}`);
  return currentStep;
}

export async function setUserStep(userID, step) {
  console.log(`[setUserStep] Definindo step=${step} para userID: ${userID}`);
  await db.read();

  // Se não existir no JSON, criamos a entrada
  if (!db.data.processedUsers[userID]) {
    console.log(`[setUserStep] userID: ${userID} não encontrado. Criando registro com step=1 e atualizando para ${step}.`);
    db.data.processedUsers[userID] = { step: 1 };
  }

  db.data.processedUsers[userID].step = step;
  await db.write();
  console.log(`[setUserStep] userID: ${userID} atualizado para step=${step} no JSON.`);
}

// ============================================================================
// 3) Verifica se o usuário respondeu o que precisamos em cada passo
// ============================================================================
// Exemplo com a checagem de isUserAskingSomething
function checkIfAnswered(requiredInfo, userMessage) {
  if (!requiredInfo) {
    return true; 
  }

  // Se estiver fazendo pergunta extra, não consideramos como respondido
  if (isUserAskingSomething(userMessage)) {
    return false;
  }

  switch (requiredInfo) {
    case "fullName":
      return /^[A-Za-zÀ-ÖÙ-öù-ž]{2,}(?:\s+[A-Za-zÀ-ÖÙ-öù-ž]{2,})*$/.test(userMessage);
    case "motivation":
      return userMessage.trim().length > 5;
    case "weightGoal":
      return /\d+/.test(userMessage);
    case "impact":
      return /\b([0-9]|10)\b/.test(userMessage);
    default:
      return false;
  }
}




///////////////////////////////////////////////////////////////////////////////
// 3) isUserAskingSomething - para detectar perguntas extras
///////////////////////////////////////////////////////////////////////////////
function isUserAskingSomething(userMessage) {
  const text = userMessage.toLowerCase();

  const questionIndicators = [
    'valor',
    'preço',
    'preco',     // Pode incluir sem acento
    'custa',
    'quanto',
    'pode me dizer',
    'pode informar',
    'gostaria de saber',
    'poderia me falar',
    'onde',
    'onde fica',
    'localiza',
    'localização',
    'localizaçao',
    'localizacao',
    'localizacão',
    'Tirze',
    'plano',
    'tirze',
    'plano 1',
  ];

  if (text.includes('?')) {
    return true;
  }

  for (let indicator of questionIndicators) {
    if (text.includes(indicator)) {
      return true;
    }
  }
  return false;
}


///////////////////////////////////////////////////////////////////////////////
// 4) handleScript - AGORA com guarda para passo > 5
///////////////////////////////////////////////////////////////////////////////
async function handleScript(userID, userMessage, userThread) {
  let currentStep = await getUserStep(userID);

  // Se já passou do último passo (5), não há scriptSteps[6].
  if (currentStep > 5) {
    console.log(`[handleScript] Passo ${currentStep} > 5. Roteiro concluído. Conversa livre.`);
    return "Roteiro concluído. Agora podemos conversar livremente. Como posso ajudar?";
  }

  const stepData = scriptSteps[currentStep];
  console.log(`[handleScript] Usuário ${userID} está no passo ${currentStep}. Mensagem: "${userMessage}"`);

  // ─────────────────────────────────────────────────────────────────────────
  // PASSO 1: NÃO REPETIR O SCRIPT SE HOUVER PERGUNTA EXTRA; SÓ ENVIAR A RESPOSTA
  // ─────────────────────────────────────────────────────────────────────────
  if (currentStep === 1) {
    console.log(`[handleScript] Passo 1: verificando pergunta extra e nome completo.`);
  
    let gptAnswer = ""; // <-- LINHA ADICIONADA PARA EVITAR ReferenceError
  
    // 1) Se o usuário perguntou algo (ex.: "qual o preço?"), respondemos SOMENTE a resposta curta
    if (isUserAskingSomething(userMessage)) {
      console.log(`[handleScript] Pergunta extra detectada no passo 1. Chamando getShortGPTAnswer...`);
      gptAnswer = await getShortGPTAnswer(userMessage, userID, userThread, currentStep, scriptSteps[currentStep].question);
  
      if (gptAnswer) {
        console.log(`[handleScript] Resposta curta do GPT no passo 1: "${gptAnswer}"`);
        // Envia apenas a resposta curta do GPT sem repetir a pergunta do script
        await openai.beta.threads.messages.create(userThread, {
          role: 'assistant',
          content: gptAnswer.trim(),
        });
        // Não avançamos o passo, o usuário continua no passo 1 aguardando o nome
        return gptAnswer.trim();
      }
    }

    // 2) Se NÃO houve pergunta extra ou getShortGPTAnswer não retornou nada,
    //    verificamos se o usuário forneceu o nome
    const answeredName = checkIfAnswered("fullName", userMessage);
    if (answeredName) {
      // Avançar para o passo 2
      const nextStep = currentStep + 1;
      setUserStep(userID, nextStep);
      console.log(`[handleScript] Nome detectado. Avançando para passo ${nextStep}.`);

      if (scriptSteps[nextStep]) {
        const nextQuestion = scriptSteps[nextStep].question;
        await openai.beta.threads.messages.create(userThread, {
          role: 'assistant',
          content: nextQuestion,
        });
        return nextQuestion;
      } else {
        const finalMsg = "Agradeço suas respostas! Como posso ajudar agora?";
        await openai.beta.threads.messages.create(userThread, {
          role: 'assistant',
          content: finalMsg,
        });
        return finalMsg;
      }
    // Diferenças no bloco do else onde "Nome NÃO detectado no passo 1" era tratado:
} else {
  console.log(`[handleScript] Nome NÃO detectado no passo 1. Se houver gptAnswer, envia só ela; senão, repete pergunta.`);

  if (gptAnswer) {
    await openai.beta.threads.messages.create(userThread, {
      role: 'assistant',
      content: gptAnswer.trim(),
    });
    return gptAnswer.trim();
  } else {
    const repeatMsg = scriptSteps[1].question;
    await openai.beta.threads.messages.create(userThread, {
      role: 'assistant',
      content: repeatMsg,
    });
    return repeatMsg;
  }
}

  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASSOS 2 a 5: LÓGICA NORMAL (PODE MANTER PERGUNTA EXTRA JUNTA OU SEPARAR)
  // ─────────────────────────────────────────────────────────────────────────
  let gptExtraAnswer = "";
  if (isUserAskingSomething(userMessage)) {
    console.log(`[handleScript] Pergunta extra detectada (passo ${currentStep}). Chamando getShortGPTAnswer...`);
    const shortGPTResponse = await getShortGPTAnswer(userMessage, userID, userThread, currentStep, scriptSteps[currentStep].question);

    if (shortGPTResponse) {
      gptExtraAnswer = shortGPTResponse.trim();
      console.log(`[handleScript] Resposta curta do GPT: "${gptExtraAnswer}"`);
    }
  }

  const answered = checkIfAnswered(stepData.requiredInfo, userMessage);
  console.log(`[handleScript] answered? ${answered}. requiredInfo: ${stepData.requiredInfo}`);

// ...
let finalText = "";

// 1) Se answered === true, o usuário respondeu o que precisávamos
if (answered) {
  // Primeiro declare nextStep
  const nextStep = currentStep + 1;

  console.log(`[handleScript] Passo ${currentStep} respondido. Avançando para passo ${nextStep}.`);

  // Se houve gptExtraAnswer, podemos acrescentar aqui (opcional)
  if (gptExtraAnswer) {
    finalText += gptExtraAnswer.trim() + "\n\n";
  }

  // Avançamos o passo e montamos finalText com a próxima pergunta
  await setUserStep(userID, nextStep);
  if (scriptSteps[nextStep]) {
    finalText += scriptSteps[nextStep].question;
  } else {
    finalText += "Agradeço suas respostas! Como posso ajudar agora?";
  }
}

// 2) Se answered === false, a pergunta do roteiro não foi atendida
else {
  console.log(`[handleScript] Pergunta não atendida. Verificando se já temos gptExtraAnswer...`);
  
  // Se já temos gptExtraAnswer, usamos ela apenas uma vez
  if (gptExtraAnswer) {
    finalText += gptExtraAnswer.trim();
  } 
  else {
    // Se não temos, chamamos fallback
    console.log(`[handleScript] gptExtraAnswer vazio. Gerando fallback do GPT...`);
    const shortGPT = await getShortGPTAnswer(
      userMessage,
      userID,
      userThread,
      currentStep,
      scriptSteps[currentStep].question
    );
    finalText += shortGPT
      ? shortGPT.trim()
      : "Poderia repetir sua resposta de forma mais clara, por favor?";
  }
}

  console.log(`[handleScript] Salvando fala do script no thread como role: 'assistant':\n"${finalText}"`);
  await openai.beta.threads.messages.create(userThread, {
    role: 'assistant',
    content: finalText,
  });

  return finalText.trim();
}
// ============================================================================
// 6) Resposta curta do GPT (para perguntas fora do roteiro)
// ============================================================================
// ============================================================================
// 6) Resposta curta do GPT (para perguntas fora do roteiro) - usando thread existente
// ============================================================================
// Em getShortGPTAnswer, você pode receber o step atual como um parâmetro
// e então montar uma instrução contextual:

async function getShortGPTAnswer(
  userMessage,
  userID,
  userThread,
  currentStep,
  scriptQuestion
) {
  try {
    console.log(`[getShortGPTAnswer] Usuário ${userID} perguntou: "${userMessage}" no passo ${currentStep}`);
   switch (currentStep) {
      case 1:
        scriptQuestion = "Qual o seu nome completo?";
        break;
      case 2:
        scriptQuestion = "Poderia me contar um pouco sobre o que te motiva a buscar o Espaço Zaneti?";
        break;
      case 3:
        scriptQuestion = "E qual é a sua meta de perda de peso?";
        break;
      case 4:
        scriptQuestion = "De 0 a 10, quanto o seu peso impacta na sua qualidade de vida?";
        break;
      case 5:
        scriptQuestion = "Em que mais posso te ajudar?";
        break;
    }
        
    
    // Adiciona a pergunta do usuário na thread
    await openai.beta.threads.messages.create(userThread, {
      role: 'user',
      content: userMessage,
    });

    // Constrói as instruções para o Assistant
    let stepInfo = "";
    if (currentStep && scriptQuestion) {
      stepInfo = `\n\n⚠️ IMPORTANTE: Você está no passo ${currentStep} do roteiro. ` +
                 `Após sua resposta curta, **obrigatoriamente** finalize com esta pergunta: "${scriptQuestion}".` +
                 `Certifique-se de que a pergunta do script seja a última coisa dita.`;
    }

    console.log(`[getShortGPTAnswer] Instruções adicionais enviadas ao GPT: ${stepInfo}`);

    // Cria o run do Assistant com as instruções modificadas
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
      additional_instructions: 
        "Após responder, finalize **obrigatoriamente** com a pergunta do roteiro." +
        stepInfo + "priorize os valores parcelados na resposta"
    });

    console.log(`[getShortGPTAnswer] Assistant iniciado com run ID: ${run.id}`);

    // Aguarda a finalização
    const runId = run.id;
    let runStatus = run.status;
    const finalRunStatus = await VerificationRunStatus(userThread, runId, runStatus, userID);

    console.log(`[getShortGPTAnswer] Status final do run: ${finalRunStatus}`);

    // Obtém a resposta do assistant
    const messages = await openai.beta.threads.messages.list(userThread);
    if (!messages || messages.data.length === 0) {
      console.error("[getShortGPTAnswer] Nenhuma mensagem retornada pelo OpenAI!");
      return "";
    }

    // Extrai a resposta

    const lastMessage = messages.data[0].content[0].text.value /*+ scriptQuestion */
    console.log(`[getShortGPTAnswer] Resposta bruta do Assistant: "${lastMessage}"`);
    return lastMessage.replace(/【.*?】/g, '').trim();

  } catch (error) {
    console.error("[getShortGPTAnswer] Erro ao obter resposta curta do GPT:", error);
    return "";
  }
}
// 7) processUserQueue: controla a fila e chama handleScript
// ============================================================================
const userMessagesQueue = new Map();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

///////////////////////////////////////////////////////////////////////////////
// 5) processUserQueue - chama handleScript e lida com passos
///////////////////////////////////////////////////////////////////////////////
async function processUserQueue(userID, userThread, manyChatConfig) {
  const userData = userMessagesQueue.get(userID);
  if (!userData) return;

  const accumulatedMessage = userData.messages.join(' ');
  userMessagesQueue.delete(userID);

  console.log(`[processUserQueue] Mensagem acumulada do usuário ${userID}: "${accumulatedMessage}"`);

  // Sempre registramos a mensagem do usuário na thread do OpenAI
  console.log(`[processUserQueue] Salvando fala do usuário no thread como role: 'user'.`);
  await openai.beta.threads.messages.create(userThread, {
    role: 'user',
    content: accumulatedMessage,
  });

  // Verifica se é primeiro contato
  const primeiroContato = await isFirstContact(userID);
  console.log(`[processUserQueue] primeiroContato? ${primeiroContato}`);

  let finalText = "";

  // Se for primeiro contato, define a fala do PASSO 1 do script e encerra
  if (primeiroContato) {
    finalText = scriptSteps[1].question;
    console.log(`[processUserQueue] Primeiro contato do usuário. Enviando passo 1 do script:\n"${finalText}"`);

    // Armazena no OpenAI como 'assistant'
    await openai.beta.threads.messages.create(userThread, {
      role: 'assistant',
      content: finalText,
    });

    await updateManyChatCustomField(userID, null, finalText, null, null, null, manyChatConfig);
    return;
  }

  console.log(`[processUserQueue] Chamando handleScript para passo atual do usuário ${userID}...`);
  finalText = await handleScript(userID, accumulatedMessage, userThread);

  const userStepDepois = await getUserStep(userID);
  console.log(`[processUserQueue] Usuário ${userID} agora está no passo ${userStepDepois}.`);

  // Se ainda está em algum passo do roteiro (<= 5), enviamos
  // finalText diretamente ao ManyChat e ENCERRAMOS. Não chamamos GPT agora.
  if (userStepDepois <= 5) {
    console.log(`[processUserQueue] Ainda no script (passo ${userStepDepois}). Enviando pergunta do script direto ao ManyChat e encerrando.`);
    await updateManyChatCustomField(userID, null, finalText, null, null, null, manyChatConfig);
    return;
  }

  // Se chegou aqui, script finalizado (passo > 5) -> Podemos chamar GPT
  console.log(`[processUserQueue] Script finalizado (passo ${userStepDepois}). Agora podemos chamar GPT livre.`);
  console.log(`[processUserQueue] Enviando finalText ao GPT como 'assistant':\n"${finalText}"`);

  await openai.beta.threads.messages.create(userThread, {
    role: 'assistant',
    content: finalText,
  });

  const currentDate = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD');
  const currentDayOfWeek = moment().tz('America/Sao_Paulo').format('dddd');
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
Essa é a data de hoje: ${currentDate}, e hoje é ${currentDayOfWeek}. 
/ Sempre pergunte o nome do paciente e se apresente no primeiro contato 
/ Ao listar horários livres retorne somente 1 horário para cada 3 dias. 
/ Retorne somente horários que estejam dentro do ${horario}. 
/ Leve em consideração a ${draResponsavel} e seus horários para disponibilizar horários livres 
/ Ao ser perguntado sobre tirzeslim fale sobre sem falar o preço.
`;

  console.log('Run iniciado: preparando a execução de GPT para conversa livre.');
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

  // Obtém a resposta final do GPT
  const messages = await openai.beta.threads.messages.list(userThread);
  if (!messages || messages.data.length === 0) {
    console.error("Nenhuma mensagem retornada pelo OpenAI!");
    return;
  }
  let lastMessage = messages.data[0].content[0].text.value;
  console.log("Última mensagem do OpenAI antes do filtro:", lastMessage);

  const gptResponse = lastMessage.replace(/【.*?】/g, '').trim();

  // Divide a mensagem em partes
  const parts = gptResponse.split(/(?<=[?])\s+/).filter(part => part && part.trim() !== '');
  let part1 = parts.length > 0 ? parts[0] : null;
  let part2 = parts.length > 1 ? parts[1] : null;
  let part3 = parts.length > 2 ? parts[2] : null;
  let part4 = parts.length > 3 ? parts[3] : null;

  console.log('Partes da mensagem filtradas:', { part1, part2, part3, part4 });

  await updateManyChatCustomField(userID, null, part1, part2, part3, part4, manyChatConfig);
}
// ============================================================================
// 8) Função principal (handleChat) - continua praticamente igual
// ============================================================================
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

    // Se for áudio, fazer download e transcrever
    if (isAudio) {
      const fileName = `audio_${userID}_${Date.now()}.ogg`;
      const outputPath = path.join(__dirname, '../../audios', fileName);

      console.log(`Iniciando download do áudio em: ${userMessageMidia}`);
      await downloadAudio(userMessageMidia, outputPath);
      console.log('Áudio baixado com sucesso:', outputPath);

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

    // Monta o texto final a partir da pergunta + transcrição
    const combinedMessage = `${userMessage || ''}\n${transcricao || ''}`.trim();
    console.log('Mensagem combinada:', combinedMessage);

    // Enfileira a mensagem
    if (userMessagesQueue.has(userID)) {
      userMessagesQueue.get(userID).messages.push(combinedMessage);
      console.log(`Mensagem adicionada à fila do usuário: ${userID}`);
    } else {
      const userData = {
        messages: [combinedMessage],
        timeout: setTimeout(() => {
          console.log(`Timeout expirado para o usuário: ${userID}`);
          processUserQueue(userID, userThread, manyChatConfig);
        }, 12000),
      };
      userMessagesQueue.set(userID, userData);
      console.log(`Novo usuário adicionado à fila: ${userID}`);
    }

    res.status(200).send('Sua mensagem foi recebida e está sendo processada.');
  } catch (error) {
    console.error('Erro na API do GPT:', error);
    res.status(500).send('Erro ao processar a mensagem');
  }
}
