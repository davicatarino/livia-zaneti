// routes/router.js
import { Router } from 'express';
import { handleChat } from '../services/openAi/handleChat.js';
import {
  auth,
  redirect,
  oauth2Client,
  refreshToken,
} from '../services/auth/autheticationGoogle.js';

const router = Router();

// Rota principal para o chat que integra todas as funções via function calls
router.post('/Julia', handleChat);

// Rotas para autenticação com o Google
router.get('/google', auth);
router.get('/redirect', redirect);

// Rota para verificar e renovar o token, se necessário, e processar horários disponíveis
router.get('/freebusy', async (req, res) => {
  // Verifique e renove o token se necessário
  if (!oauth2Client.credentials || oauth2Client.credentials.expiry_date < Date.now()) {
    await refreshToken(); // Renova o token se estiver expirado
  }

  // Como as funções agora são chamadas internamente via function calls, esta rota pode ser removida ou ajustada
  // Se ainda precisar expor esta funcionalidade, reimplemente-a conforme a nova arquitetura
  res.status(200).send({ message: 'Endpoint /freebusy não está mais em uso. Utilize o chat para interações.' });
});

// Remova as rotas específicas para eventos, pois agora são tratadas via function calls
// router.post('/event', handleEvent);
// router.post('/eventDelete', handleDelete);

export default router;
