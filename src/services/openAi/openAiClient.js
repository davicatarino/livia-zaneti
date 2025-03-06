import OpenAI from 'openai';
import config from '../../config/index.js';

// Configura as variáveis de ambiente
config();

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
});

export default openai;
