// assistantFunctions.js
const assistantFunctions = [
  {
    type: 'function',
    function: {
      name: 'handleEvent',
      description: 'Cria um evento no Google Calendar para o Espaço Zaneti.',
      parameters: {
        type: 'object',
        properties: {
          Name: { type: 'string', description: 'Nome completo do paciente' },
          CPF: { type: 'string', description: 'CPF do paciente' },
          Telefone: { type: 'string', description: 'Telefone do paciente' },
          Nascimento: { type: 'string', description: 'Data de nascimento do paciente no formato YYYY-MM-DD' },
          Email: { type: 'string', format: 'email', description: 'Email do paciente' },
          Horario: { type: 'string', format: 'date-time', description: 'Data e hora do agendamento no formato ISO 8601' },
          Procedimento: { type: 'string', description: 'Procedimento ou plano escolhido pelo paciente' },
          ComoNosConheceu: { type: 'string', description: 'Como o paciente conheceu o Espaço Zaneti (e.g., Instagram, Google, indicação)' },
          modelo: { type: 'string', description: 'atendimento presencial ou online' },
          endereco: { type: 'string', description: 'endereço com cep' },
          DraResponsavel: { type: 'string', description: 'Nome da médica responsável pelo atendimento (Marina ou Marília)' },
          PagamentoConfirmado: { type: 'boolean', description: 'Se o pagamento antecipado foi confirmado' },
        },
        required: ['Name', 'Email', 'Horario', 'Telefone', 'Procedimento', 'ComoNosConheceu', 'modelo', 'DraResponsavel'],

      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendManyChatFlowWithField',
      description: 'envia uma imagem antes e depois de procedimentos estéticos, baseado no interesse do usuário',
      parameters: {
        type: 'object',
        properties: {
          DraResponsavel: { type: 'string', description: 'Nome da médica responsável pelo atendimento (Marina ou Marília)' },
          procedureName: {
            type: 'string',
            description: 'Nome do procedimento estético de interesse do usuário. Opções disponíveis: tratamento anti-rugas (botox), full face, bigode de chines, Rinomodelacao, Olheira, Remocao de gordura na papada (lipo de papada HD), Lábios (técnica PERFECT LIPS), Queixo e Mandíbula,tratamento anti-envelhecimento(Sculptra e o Elleva).',
          },
        },
        required: ['procedureName', 'DraResponsavel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sendManyChatFlowAssignment',
      description: 'atribui a conversa para um atendente humano',
      parameters: {
        type: 'object',
        properties: {
          DraResponsavel: { type: 'string', description: 'Nome da médica responsável pelo atendimento (Marina ou Marília)' },
        },
        required: ['DraResponsavel'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'handleAvailable',
      description: 'Recupera horários disponíveis para agendamento nos próximos 7 dias.',
      parameters: {
        type: 'object',
        properties: {
          // Adicione parâmetros se necessário
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'handleDelete',
      description: 'Cancela um evento no Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          EventID: { type: 'string', description: 'ID do evento a ser cancelado' },
        },
        required: ['EventID'],
      },
    },
  },
];

export default assistantFunctions;
