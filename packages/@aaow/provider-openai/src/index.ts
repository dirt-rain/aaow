// import { LLMProvider } from "@aaow/types";
import { LLMProvider } from "../../types/src/LLMProvider"; // TODO: remove this line

export class ClaudeCodeLLMProvider implements LLMProvider {
  async availableModels(): Promise<string[]> {
    return ["claude-3-5-sonnet-20241022"];
  }
}

export default ClaudeCodeLLMProvider;
