import axios from 'axios';
import fs from 'fs'; // File System para salvar o arquivo

// Função para baixar o arquivo de áudio .ogg
export default async function downloadAudio(url, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(outputPath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Erro ao fazer o download do áudio:', error);
    throw error;
  }
}