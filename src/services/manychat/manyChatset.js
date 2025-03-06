// manyChatset.js

import axios from 'axios';
import moment from 'moment-timezone';
import config from '../../config/index.js';
config(); // Configura as variáveis de ambiente

/**
 * Atualiza um campo personalizado no ManyChat.
 *
 * @param {string} userID - O ID do assinante no ManyChat.
 * @param {string} fieldID - O ID do campo personalizado a ser atualizado.
 * @param {any} fieldValue - O valor a ser definido para o campo.
 * @returns {Promise<object>} - A resposta da API do ManyChat.
 */
export async function setManyChatCustomField(userID, fieldID, fieldValue, manyChatConfig) {
  if (!userID) {
    throw new Error('O subscriber_id (userID) é obrigatório.');
  }
  if (!fieldID) {
    throw new Error('O field_id é obrigatório.');
  }
  if (!manyChatConfig || !manyChatConfig.apiKey) {
    throw new Error('A configuração do ManyChat é obrigatória e deve conter a apiKey.');
  }

  const accessToken = manyChatConfig.apiKey;

  const updateFieldBody = {
    subscriber_id: userID,
    field_id: fieldID,
    field_value: fieldValue,
  };

  const configAxios = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  try {
    console.log('Atualizando Custom Field no ManyChat:', JSON.stringify(updateFieldBody, null, 2));
    const response = await axios.post('https://api.manychat.com/fb/subscriber/setCustomField', updateFieldBody, configAxios);
    console.log('Custom Field atualizado com sucesso:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar campo no ManyChat:', error);
    throw error;
  }
}

/**
 * Envia um flow e atualiza um campo personalizado no ManyChat.
 *
 * @param {string} userID - O ID do assinante no ManyChat.
 * @param {string} procedureName - O nome do procedimento para atualizar o campo.
 * @returns {Promise<object>} - A resposta da API do ManyChat.
 */
export async function sendManyChatFlowWithField(userID, procedureName, manyChatConfig) {
  if (!userID) {
    throw new Error('O subscriber_id (userID) é obrigatório.');
  }
  if (!procedureName) {
    throw new Error('O nome do procedimento (procedureName) é obrigatório.');
  }
  if (!manyChatConfig || !manyChatConfig.apiKey) {
    throw new Error('A configuração do ManyChat é obrigatória e deve conter a apiKey.');
  }
  const sendFlowUrl = 'https://api.manychat.com/fb/sending/sendFlow';
  const updateFieldUrl = 'https://api.manychat.com/fb/subscriber/setCustomField';
  const accessToken = process.env.MC_KEY_1;
  const imgFluxo = process.env.IMG_FLOW;

  // Corpo para disparar o flow
  const sendFlowBody = {
    subscriber_id: userID,
    flow_ns: 'content20241123213917_598771',
  };

  // Corpo para atualizar o Custom Field
  const updateFieldBody = {
    subscriber_id: userID,
    field_id: imgFluxo, // Substitua pelo nome do campo no ManyChat
    field_value: procedureName,
  };

  const configAxios = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  try {
    // Atualizar Custom Field
    console.log('Atualizando Custom Field no ManyChat:', JSON.stringify(updateFieldBody, null, 2));
    const updateResponse = await axios.post(updateFieldUrl, updateFieldBody, configAxios);
    console.log('Custom Field atualizado com sucesso:', updateResponse.data);

    // Disparar Flow
    console.log('Disparando Flow no ManyChat:', JSON.stringify(sendFlowBody, null, 2));
    const flowResponse = await axios.post(sendFlowUrl, sendFlowBody, configAxios);
    console.log('Flow disparado com sucesso no ManyChat:', flowResponse.data);

    return {
      message: 'Flow e Custom Field atualizados com sucesso.',
      flowResponse: flowResponse.data,
      updateResponse: updateResponse.data,
    };
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('Erro detalhado da API ManyChat:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Erro na requisição para o ManyChat:', error.request);
    } else {
      console.error('Erro inesperado ao disparar flow ou atualizar campo no ManyChat:', error.message);
    }
    throw error;
  }
}

/**
 * Envia um flow e atualiza um campo personalizado no ManyChat.
 *
 * @param {string} userID - O ID do assinante no ManyChat.
 * @returns {Promise<object>} - A resposta da API do ManyChat.
 */
export async function sendManyChatFlowAssignment(userID, manyChatConfig) {
  if (!userID) {
    throw new Error('O subscriber_id (userID) é obrigatório.');
  }
  if (!manyChatConfig || !manyChatConfig.apiKey) {
    throw new Error('A configuração do ManyChat é obrigatória e deve conter a apiKey.');
  }

  const sendFlowUrl = 'https://api.manychat.com/fb/sending/sendFlow';
  const updateFieldUrl = 'https://api.manychat.com/fb/subscriber/setCustomField';
  const accessToken = manyChatConfig.apiKey
  const draResponsavel = manyChatConfig.draResponsavel;
  const assingment = draResponsavel.includes('Marília')
    ? process.env.ASSINGMENT2
    : process.env.ASSINGMENT;
  

  // Corpo para disparar o flow
  const sendFlowBody = {
    subscriber_id: userID,
    flow_ns: 'content20250114182302_569306',
  };

  // Corpo para atualizar o Custom Field
  const updateFieldBody = {
    subscriber_id: userID,
    field_id: assingment, // Substitua pelo nome do campo no ManyChat
    field_value: "sim",
  };

  const configAxios = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  try {
    // Atualizar Custom Field
    console.log('Atualizando Custom Field no ManyChat:', JSON.stringify(updateFieldBody, null, 2));
    const updateResponse = await axios.post(updateFieldUrl, updateFieldBody, configAxios);
    console.log('Custom Field atualizado com sucesso:', updateResponse.data);

    // Disparar Flow
    console.log('Disparando Flow no ManyChat:', JSON.stringify(sendFlowBody, null, 2));
    const flowResponse = await axios.post(sendFlowUrl, sendFlowBody, configAxios);
    console.log('Flow disparado com sucesso no ManyChat:', flowResponse.data);

    return {
      message: 'Flow e Custom Field atualizados com sucesso.',
      flowResponse: flowResponse.data,
      updateResponse: updateResponse.data,
    };
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('Erro detalhado da API ManyChat:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Erro na requisição para o ManyChat:', error.request);
    } else {
      console.error('Erro inesperado ao disparar flow ou atualizar campo no ManyChat:', error.message);
    }
    throw error;
  }
}


/**
 * Atualiza múltiplos campos personalizados no ManyChat.
 *
 * @param {string} userID - O ID do assinante no ManyChat.
 * @param {string} eventID - O ID do evento para atualizar.
 * @param {string|null} part1 - Valor para o campo part1.
 * @param {string|null} part2 - Valor para o campo part2.
 * @param {string|null} part3 - Valor para o campo part3.
 * @param {string|null} part4 - Valor para o campo part4.
 * @returns {Promise<void>}
 */
export default async function updateManyChatCustomField(userID, eventID, part1, part2, part3, part4, manyChatConfig) {
  const isValidValue = (value) => value !== null && value !== undefined && value !== '';
  
  const updateUrl = 'https://api.manychat.com/fb/subscriber/setCustomField';
  const sendFlowUrl = 'https://api.manychat.com/fb/sending/sendFlow';
  const customFieldEventID = process.env.EVENT_ID; // ID do campo para eventID
  const accessToken = manyChatConfig.apiKey;
  const customFieldIds = manyChatConfig.customFields;

  const configAxios = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  const updateCustomField = async (fieldId, fieldValue) => {
    try {
      if (fieldValue) {
        const updateBody = {
          subscriber_id: userID,
          field_id: fieldId,
          field_value: fieldValue,
        };
        const response = await axios.post('https://api.manychat.com/fb/subscriber/setCustomField', updateBody, configAxios);
        console.log(`Success updating custom field ${fieldId}:`, response.data);
      }
    } catch (error) {
      console.error(`Error updating custom field ${fieldId}:`, error);
    }
  };

  try {
    // Atualiza o EventID sozinho, se existir um valor
    if (isValidValue(eventID)) {
      await updateCustomField(customFieldEventID, eventID);
    }

    // Verifica quais partes têm valor e envia apenas as válidas
    const partsToSend = [];
    if (isValidValue(part1)) {
      await updateCustomField(customFieldIds.part1, part1);
      partsToSend.push('part1');
    }
    if (isValidValue(part2)) {
      await updateCustomField(customFieldIds.part2, part2);
      partsToSend.push('part2');
    }
    if (isValidValue(part3)) {
      await updateCustomField(customFieldIds.part3, part3);
      partsToSend.push('part3');
    }
    if (isValidValue(part4)) {
      await updateCustomField(customFieldIds.part4, part4);
      partsToSend.push('part4');
    }

    // Obter a data atual no fuso horário 'America/Sao_Paulo' e no formato 'YYYY-MM-DD'
   // const currentDate = moment().tz('America/Sao_Paulo').format('YYYY-MM-DD');
    
    // Atualiza o campo personalizado com a data atual
   // await updateCustomField(customFieldDate, currentDate);

    // Dispara o flow se houver pelo menos uma parte válida
    if (partsToSend.length > 0) {
      const sendFlowBody = {
        subscriber_id: userID,
        flow_ns: 'content20240914122016_929535', // Ajuste o flow_ns se necessário
      };

      const flowResponse = await axios.post(sendFlowUrl, sendFlowBody, configAxios);
      console.log('Success triggering flow with parts:', partsToSend, flowResponse.data);
    } else {
      console.log('No valid parts to update, skipping flow trigger');
    }

  } catch (error) {
    console.error('Error in updateManyChatCustomField process:', error);
  }

  console.log('Update process completed for:', userID, eventID, part1, part2, part3, part4);
}
