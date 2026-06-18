import { Body, Controller, Inject, Post, HttpError } from 'najm-core';
import { isAdmin } from 'najm-auth';
import { Validate } from 'najm-validation';
import { studioAssistantChatDto, type StudioAssistantChatDto } from '../studioContract/StudioAssistantDto';
import {
  STUDIO_VIEW_TOOL_MAP,
  normalizeStudioAssistantView,
} from '../studioContract/viewToolMap';
import {
  STUDIO_ASSISTANT_PROVIDER,
  type StudioAssistantProvider,
} from '../studioContract/StudioAssistantProvider';

@Controller('/rag-studio/assistant')
@isAdmin()
export class StudioAssistantController {
  @Inject(STUDIO_ASSISTANT_PROVIDER)
  private provider!: StudioAssistantProvider;

  @Post('/chat')
  @Validate(studioAssistantChatDto)
  async chat(@Body() body: StudioAssistantChatDto) {
    const view = normalizeStudioAssistantView(body.workspace);
    if (!view) HttpError.badRequest(`Studio Assistant is not available for workspace: ${body.workspace}`);

    return this.provider.run({
      ...body,
      view,
      allowedTools: STUDIO_VIEW_TOOL_MAP[view],
    });
  }
}
