import { Body, Controller, Delete, Get, Params, Post, Put } from 'najm-core';
import { Validate } from 'najm-validation';
import { ThemeStyleService } from './ThemeStyleService';
import {
  duplicateThemeStyleDto,
  themeStyleIdParam,
  updateThemeStyleDto,
  type DuplicateThemeStyleDto,
  type UpdateThemeStyleDto,
} from './ThemeStyleDto';

@Controller('/theme-styles')
export class ThemeStyleController {
  constructor(private styleService: ThemeStyleService) {}

  @Get('/:id')
  @Validate({ params: themeStyleIdParam })
  get(@Params('id') id: string) {
    return this.styleService.get(id);
  }

  @Put('/:id')
  @Validate({ params: themeStyleIdParam, body: updateThemeStyleDto })
  update(@Params('id') id: string, @Body() body: UpdateThemeStyleDto) {
    return this.styleService.update(id, body);
  }

  @Post('/:id/duplicate')
  @Validate({ params: themeStyleIdParam, body: duplicateThemeStyleDto })
  duplicate(@Params('id') id: string, @Body() body: DuplicateThemeStyleDto) {
    return this.styleService.duplicate(id, body);
  }

  @Post('/:id/default')
  @Validate({ params: themeStyleIdParam })
  setDefault(@Params('id') id: string) {
    return this.styleService.setDefault(id);
  }

  @Delete('/:id')
  @Validate({ params: themeStyleIdParam })
  delete(@Params('id') id: string) {
    return this.styleService.delete(id);
  }
}