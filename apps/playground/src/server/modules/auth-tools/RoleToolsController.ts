import { Controller } from 'najm-api';
import { Get, Post, Put, Delete, ResMsg } from 'najm-api';
import { Body, Params } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Validate } from 'najm-validation';
import { isAdmin, RoleService } from 'najm-auth';
import {
  createRoleDto,
  updateRoleDto,
  roleIdParam,
  type CreateRoleDto,
  type UpdateRoleDto,
  type RoleIdParam,
} from 'najm-auth';

@ToolGroup('roles')
@Controller('/tools/roles')
@isAdmin()
export class RoleToolsController {
  constructor(private roleService: RoleService) {}

  @Get('/')
  @McpTool({ description: 'List all roles (admin only)', readOnly: true })
  @ResMsg('roles.success.retrieved')
  async getAll() {
    return this.roleService.getAll();
  }

  @Get('/:id')
  @McpTool({ description: 'Get a role by ID (admin only)', readOnly: true })
  @Validate({ params: roleIdParam })
  @ResMsg('roles.success.retrieved')
  async getById(@Params() params: RoleIdParam) {
    return this.roleService.getById(params.id);
  }

  @Post('/')
  @McpTool({ description: 'Create a new role (admin only)', idempotent: false, confirm: { level: 'danger', message: 'roles.confirm.create' } })
  @Validate(createRoleDto)
  @ResMsg('roles.success.created')
  async create(@Body() body: CreateRoleDto) {
    return this.roleService.create(body);
  }

  @Put('/:id')
  @McpTool({ description: 'Update a role by ID (admin only)', confirm: { level: 'danger', message: 'roles.confirm.update' } })
  @Validate({ params: roleIdParam, body: updateRoleDto })
  @ResMsg('roles.success.updated')
  async update(@Params() params: RoleIdParam, @Body() body: UpdateRoleDto) {
    return this.roleService.update(params.id, body);
  }

  @Delete('/:id')
  @McpTool({ description: 'Delete a role by ID (admin only)', destructive: true, confirm: { level: 'danger', message: 'roles.confirm.delete' } })
  @Validate({ params: roleIdParam })
  @ResMsg('roles.success.deleted')
  async delete(@Params() params: RoleIdParam) {
    return this.roleService.delete(params.id);
  }
}
