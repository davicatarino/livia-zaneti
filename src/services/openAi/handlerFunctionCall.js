// handleFunctionCall.js

import openai from './openAiClient.js';
import { handleEventFunction, handleAvailableFunction, handleDeleteFunction } from '../google/eventFunctions.js';
import { sendManyChatFlowWithField, sendManyChatFlowAssignment} from '../manychat/manyChatset.js'; // Importação correta

async function handleFunctionCall(toolCalls, userID, manyChatConfig) { // Adicionado userID
  const toolOutputs = [];
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    let output;

    console.log(`Chamando função: ${functionName} com argumentos:`, args);

    switch (functionName) {

      case 'handleEvent':
        try {
          // handleFunctionCall.js
          const eventResult = await handleEventFunction({
            ...args,
            ManyChatID: userID || args.ManyChatID,  // Se não existir, tenta pegar dos argumentos
          });         
          console.log("ARgumentos handleEvent:" + args) 
          output = eventResult;  // Certifique-se de que seja uma string.
        } catch (error) {
          output = `Erro ao criar evento: ${error.message}`;
        }
        break;

      case 'handleAvailable':
        try {
          // Certifique-se de que `handleAvailableFunction` retorne uma string diretamente
          const availableSlots = await handleAvailableFunction({ ...args, manyChatConfig});
          output = availableSlots;  // Aqui garantimos que seja uma string.
        } catch (error) {
          output = `Erro ao buscar horários disponíveis: ${error.message}`;
        }
        break;

      case 'handleDelete':
        try {
          const deleteResult = await handleDeleteFunction(args);
          output = deleteResult;  // Certifique-se de que seja uma string.
        } catch (error) {
          output = `Erro ao deletar evento: ${error.message}`;
        }
        break;

        case 'sendManyChatFlowWithField':
          try {
            const { procedureName } = args;
            if (!userID) {
              throw new Error('userID é necessário para enviar a imagem.');
            }
            output = await sendManyChatFlowWithField(userID, procedureName, manyChatConfig ); // Passando objeto
          } catch (error) {
            output = `Erro ao obter a imagem do procedimento: ${error.message}`;
          }
          break;

          case 'sendManyChatFlowAssignment':
            try {
              if (!userID) {
                throw new Error('userID é necessário para enviar a imagem.');
              }
              output = await sendManyChatFlowAssignment(userID, manyChatConfig); // Passando objeto
            } catch (error) {
              output = `Erro ao atribuir conversa: ${error.message}`;
            }
            break;  
        

      default:
        output = `Função ${functionName} não reconhecida.`;
    }

    console.log(`Output da função ${functionName}:`, output);

    toolOutputs.push({
      tool_call_id: toolCall.id,
      output: output.toString(),  // Força o retorno a ser uma string
    });
  }

  return toolOutputs;
}

export default handleFunctionCall;
