import axios from 'axios';
import { google } from 'googleapis';
import { oauth2Client } from '../auth/autheticationGoogle.js';

/**
 * Função para adicionar uma linha à planilha do Google na aba "Sheet1".
 * @param {Array} rowData - Array contendo os dados que serão adicionados como uma linha.
 */
async function appendRowToSheet(rowData) {
  // Usa a versão v4 da API, conforme a referência oficial.
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  // ID da planilha (definido na variável de ambiente)
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  // Define o intervalo de destino (a partir da célula A2 da aba "Sheet1")
// Para a primeira aba ("entrada")
const range = 'entrada!A2';

  // Monta o recurso com os valores a serem adicionados (uma linha por vez)
  const resource = { values: [rowData] };

  // Chama o método append conforme a documentação da API:
  // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource,
  });
}

/**
 * Função para adicionar uma linha à segunda aba da planilha do Google.
 * @param {Array} rowData - Array contendo os dados que serão adicionados como uma linha.
 */
async function appendRowToSecondSheet(rowData) {
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  // Define o intervalo de destino na segunda aba (ajuste o nome da aba conforme necessário)
// Para a segunda aba ("agendamentos")
const range = 'agendamentos!A2';
  const resource = { values: [rowData] };

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource,
  });
}

/**
 * Função para buscar os dados do usuário no ManyChat e armazená-los na primeira aba da planilha Google.
 * @param {string} userID - ID do assinante no ManyChat.
 */
export async function GetUserInfo(userID, manyChatConfig) {
  // Realiza a requisição GET à API do ManyChat para obter os dados do assinante
  const MCKey = manyChatConfig.apiKey;
  const response = await axios.get(
    `https://api.manychat.com/fb/subscriber/getInfo?subscriber_id=${userID}`,
    {
      headers: { 
        accept: 'application/json',
        Authorization: `Bearer ${MCKey}` 
      }
    }
  );
  
  // A resposta do ManyChat geralmente possui a estrutura:
  // { status: "success", data: { id, name, whatsapp_phone, ... } }
  const subscriber = response.data.data;
  console.log('Dados do ManyChat:', subscriber);

  // Monta os dados que serão armazenados na planilha.
  const rowData = [
    subscriber.id,
    subscriber.name,
    subscriber.whatsapp_phone
  ];

  // Adiciona os dados na planilha do Google.
  await appendRowToSheet(rowData);
  console.log('Dados do usuário ManyChat adicionados à planilha do Google.');
}

/**
 * Função para salvar os dados de agendamento do usuário na segunda aba da planilha.
 * @param {Object} scheduleData - Objeto contendo os dados do agendamento.
 * scheduleData deve conter as seguintes propriedades:
 *    - fullName: Nome completo
 *    - birthDate: Data de nascimento
 *    - cpf: CPF
 *    - address: Endereço com CEP
 *    - email: E-mail
 *    - advancePayment: "Sim" ou "Não" (indicando se fez pagamento antecipado)
 */
export async function saveUserSchedule(scheduleData) {
  const { fullName, birthDate, cpf, address, email, advancePayment } = scheduleData;

  // Monta o array com os dados na ordem desejada
  const rowData = [
    fullName,
    birthDate,
    cpf,
    address,
    email,
    advancePayment,
  ];

  // Adiciona os dados na segunda aba da planilha do Google.
  await appendRowToSecondSheet(rowData);
  console.log('Dados de agendamento do usuário adicionados à segunda aba da planilha.');
}
