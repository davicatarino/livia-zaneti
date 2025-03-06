// src/services/utilities/userStatus.js

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajuste: agora o defaultValue contém um objeto "processedUsers" como objeto,
// em vez de array.
const filePath = path.join(process.cwd(), 'data/users.json');
const adapter = new JSONFile(filePath);
const db = new Low(adapter, { defaultValue: { processedUsers: {} } });

// Carregamos o arquivo JSON no db.data
await db.read();
await db.write();

// Exportamos db para que possamos ler/escrever steps em outros lugares, se necessário
export { db };

/**
 * Verifica se é o primeiro contato do usuário.
 * Se for o primeiro contato, adiciona o userID com step=1 e retorna true.
 * Caso contrário, retorna false.
 *
 * @param {string} userID - Identificador único do usuário.
 * @returns {Promise<boolean>}
 */
export async function isFirstContact(userID) {
  await db.read();
  if (!db.data.processedUsers[userID]) {
    // Se não existir, criamos a entrada do userID com step=1
    db.data.processedUsers[userID] = { step: 1 };
    await db.write();
    return true;
  }
  return false;
}
