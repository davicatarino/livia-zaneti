// VerificationRunStatus.js

import openai from './openAiClient.js';
import handleFunctionCall from './handlerFunctionCall.js';

export async function VerificationRunStatus(userThread, runId, runStatus, userID, manyChatConfig) { // Adicionado userID
  while (runStatus !== 'completed') {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const runStatusObject = await openai.beta.threads.runs.retrieve(
      userThread,
      runId,
    );
    runStatus = runStatusObject.status;

    console.log(`Status do run: ${runStatus}`);

    if (runStatus === 'requires_action') {
      console.log('Run requer ação');
      const toolCalls =
        runStatusObject.required_action.submit_tool_outputs.tool_calls;
      console.log('Chamadas de ferramenta requeridas:', toolCalls);
      const toolOutputs = await handleFunctionCall(toolCalls, userID, manyChatConfig); // Passando userID
      console.log('Outputs das ferramentas:', toolOutputs);
      await openai.beta.threads.runs.submitToolOutputs(userThread, runId, {
        tool_outputs: toolOutputs,
      });
      console.log('Tool outputs submetidos');
    }

    if (['failed', 'cancelled', 'expired'].includes(runStatus)) {
      console.log(
        `Run status is '${runStatus}'. Unable to complete the request.`,
      );
      break;
    }
  }
  return runStatus;
}
