import { Body, Controller, Delete, Get, Params, Post, Put } from 'najm-core';
import { Validate } from 'najm-validation';
import { ThemeProjectService } from './ThemeProjectService';
import { ThemeStyleService } from '../theme-style/ThemeStyleService';
import {
  createThemeProjectDto,
  themeProjectIdParam,
  updateThemeProjectDto,
  type CreateThemeProjectDto,
  type UpdateThemeProjectDto,
} from './ThemeProjectDto';
import {
  createThemeStyleDto,
  themeProjectStylesParam,
  type CreateThemeStyleDto,
} from '../theme-style/ThemeStyleDto';

@Controller('/theme-projects')
export class ThemeProjectController {
  constructor(
    private projectService: ThemeProjectService,
    private styleService: ThemeStyleService,
  ) {}

  @Get('/')
  list() {
    return this.projectService.list();
  }

  @Get('/:id')
  @Validate({ params: themeProjectIdParam })
  get(@Params('id') id: string) {
    return this.projectService.get(id);
  }

  @Post('/')
  @Validate(createThemeProjectDto)
  create(@Body() body: CreateThemeProjectDto) {
    return this.projectService.create(body);
  }

  @Put('/:id')
  @Validate({ params: themeProjectIdParam, body: updateThemeProjectDto })
  update(@Params('id') id: string, @Body() body: UpdateThemeProjectDto) {
    return this.projectService.update(id, body);
  }

  @Delete('/:id')
  @Validate({ params: themeProjectIdParam })
  delete(@Params('id') id: string) {
    return this.projectService.delete(id);
  }

  @Get('/:projectId/styles')
  @Validate({ params: themeProjectStylesParam })
  listStyles(@Params('projectId') projectId: string) {
    return this.styleService.listByProject(projectId);
  }

  @Post('/:projectId/styles')
  @Validate({ params: themeProjectStylesParam, body: createThemeStyleDto })
  createStyle(@Params('projectId') projectId: string, @Body() body: CreateThemeStyleDto) {
    return this.styleService.create(projectId, body);
  }
}