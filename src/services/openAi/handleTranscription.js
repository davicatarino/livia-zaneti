import openai from './openAiClient.js';
import fs from 'fs'; // File System para salvar o arquivo
import path from 'path'; // Para trabalhar com caminhos

export default async function transcribeAudio(audioFilePath) {
  try {
    // Verifica se o arquivo existe
    if (!fs.existsSync(audioFilePath)) {
      throw new Error('Arquivo de áudio não encontrado: ' + audioFilePath);
    }

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: 'whisper-1', // Use o modelo Whisper da OpenAI para transcrição
    });

    return response.text; // Retorna a transcrição
  } catch (error) {
    console.error('Erro ao transcrever o áudio:', error.message || error.response.data);
    throw error;
  }
}
