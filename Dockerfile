# Use uma imagem base oficial do Node.js
FROM node:18

# Defina o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copie o package.json e o package-lock.json para o contêiner
COPY package*.json ./

# Instale as dependências da aplicação
RUN npm install --production

# Copie o restante do código da aplicação para o contêiner
COPY . .

# Exponha a porta que a aplicação usa
EXPOSE 3002

# Comando para iniciar a aplicação
# Em vez de usar PM2, podemos iniciar a aplicação diretamente
CMD ["node", "index.js"]
