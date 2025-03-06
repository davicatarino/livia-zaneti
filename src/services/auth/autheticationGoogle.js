import config from '../../config/index.js';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config(); // Configura as variáveis de ambiente

// Obtenha o diretório atual usando import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_PATH = path.join(__dirname, 'token.json');

// Configura o cliente OAuth2 do Google com as credenciais das variáveis de ambiente
const oauth2Client = new google.auth.OAuth2(
  process.env.GGClient_ID,
  process.env.GGClient_KEY,
  process.env.GG_redirect
);

// Função para salvar o token em um arquivo
function storeToken(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
}

// Função para carregar o token do arquivo
function loadToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oauth2Client.setCredentials(token);
  }
}

// Função para renovar o token automaticamente
function refreshToken() {
  oauth2Client.refreshAccessToken((err, tokens) => {
    if (err) {
      console.error('Erro ao renovar access token:', err);
    } else {
      oauth2Client.setCredentials(tokens);
      storeToken(tokens); // Salva os novos tokens
    }
  });
}

// Chamada inicial para carregar os tokens ao iniciar a aplicação
loadToken();

export { oauth2Client, refreshToken };

// Rota para iniciar o fluxo OAuth2 do Google
export async function auth(req, res) {
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Solicita acesso offline para receber um refresh token
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/spreadsheets',  // Permite acesso completo à API do Sheets
      'https://www.googleapis.com/auth/drive'           // Se for necessário acesso a arquivos do Drive
    ],
    prompt: 'consent', // Garante que sempre será solicitado o refresh token
  });
  res.redirect(url);
}

// Rota para lidar com o callback do OAuth2
export async function redirect(req, res) {
  const code = req.query.code;
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error('Não foi possível obter o token', err);
      res.send('Erro ao obter o token');
      return;
    }
    oauth2Client.setCredentials(tokens);
    storeToken(tokens); // Armazena os tokens (inclusive o refresh token)
    res.redirect('https://livia.212industria.com/freebusy');
  });
}

