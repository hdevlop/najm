import type { StudioAssistantChatDto } from './StudioAssistantDto';
import type { StudioAssistantView } from './viewToolMap';

export const STUDIO_ASSISTANT_PROVIDER = Symbol.for('najm:rag:studio-assistant-provider');

export interface StudioAssistantRunInput extends StudioAssistantChatDto {
  view: StudioAssistantView;
  allowedTools: string[];
}

export interface StudioAssistantProvider {
  run(input: StudioAssistantRunInput): Promise<Response>;
}