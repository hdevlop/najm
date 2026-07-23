import { Controller } from 'najm-core';
import { Get, Post, Put, Delete, ResMsg } from 'najm-core';
import { Params, Body, User } from 'najm-core';
import { RoleService } from './RoleService';
import { isAdmin } from './RoleGuards';
import { Validate } from 'najm-validation';
import {
  createRoleDto,
  updateRoleDto,
  roleIdParam,
  type CreateRoleDto,
  type UpdateRoleDto,
  type RoleIdParam
} from './RoleDto';

@Controller('/roles')
export class RoleController {
  constructor(private roleService: RoleService) { }

  @Get()
  @isAdmin()
  @ResMsg('roles.success.retrieved')
  async getRoles() {
    return this.roleService.getAll();
  }

  @Get('/:id')
  @isAdmin()
  @Validate({ params: roleIdParam })
  @ResMsg('roles.success.retrieved')
  async getRole(@Params() params: RoleIdParam) {
    return this.roleService.getById(params.id);
  }

  @Post()
  @isAdmin()
  @Validate(createRoleDto)
  @ResMsg('roles.success.created')
  async createRole(@Body() body: CreateRoleDto) {
    return this.roleService.create(body);
  }

  @Put('/:id')
  @isAdmin()
  @Validate({
    params: roleIdParam,
    body: updateRoleDto
  })
  @ResMsg('roles.success.updated')
  async updateRole(@Params() params: RoleIdParam, @Body() body: UpdateRoleDto) {
    return this.roleService.update(params.id, body);
  }

  @Delete('/:id')
  @isAdmin()
  @Validate({ params: roleIdParam })
  @ResMsg('roles.success.deleted')
  async deleteRole(@Params() params: RoleIdParam) {
    return this.roleService.delete(params.id);
  }
}