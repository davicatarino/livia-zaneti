import express from 'express';
import chatRoutes from './routes/chatRoutes.js';
import mongoose from 'mongoose';

const app = express();

mongoose.connect('mongodb+srv://davicatarino:J%40nela123456@212industria.eo39r.mongodb.net/fernanda?retryWrites=true&w=majority&appName=212industria')
  .then(() => console.log('Conectado ao MongoDB'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));


app.use(express.json()); // Middleware para parsear JSON
app.use('/', chatRoutes); // Usa as rotas de chat

export default app;
