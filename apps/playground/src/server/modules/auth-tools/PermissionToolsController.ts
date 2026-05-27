import { Controller } from 'najm-api';
import { Get, Post, Put, Delete, ResMsg } from 'najm-api';
import { Body, Params } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Validate } from 'najm-validation';
import { isAdmin, PermissionService } from 'najm-auth';
import {
  createPermissionDto,
  updatePermissionDto,
  permissionIdParam,
  assignPermissionDto,
  roleIdParam,
  type CreatePermissionDto,
  type UpdatePermissionDto,
  type PermissionIdParam,
  type AssignPermissionDto,
  type RoleIdParam,
} from 'najm-auth';

@ToolGroup('permissions')
@Controller('/tools/permissions')
@isAdmin()
export class PermissionToolsController {
  constructor(private permissionService: PermissionService) {}

  @Get('/')
  @McpTool({ description: 'List all permissions (admin only)', readOnly: true })
  @ResMsg('permissions.success.retrieved')
  async getAll() {
    return this.permissionService.getAll();
  }

  @Get('/:id')
  @McpTool({ description: 'Get a permission by ID (admin only)', readOnly: true })
  @Validate({ params: permissionIdParam })
  @ResMsg('permissions.success.retrieved')
  async getById(@Params() params: PermissionIdParam) {
    return this.permissionService.getById(params.id);
  }

  @Post('/')
  @McpTool({ description: 'Create a new permission (admin only)', idempotent: false, confirm: { level: 'danger', message: 'permissions.confirm.create' } })
  @Validate(createPermissionDto)
  @ResMsg({ message: 'Permission created successfully', status: 201 })
  async create(@Body() body: CreatePermissionDto) {
    return this.permissionService.create(body);
  }

  @Put('/:id')
  @McpTool({ description: 'Update a permission by ID (admin only)', confirm: { level: 'danger', message: 'permissions.confirm.update' } })
  @Validate({ params: permissionIdParam, body: updatePermissionDto })
  @ResMsg('permissions.success.updated')
  async update(@Params() params: PermissionIdParam, @Body() body: UpdatePermissionDto) {
    return this.permissionService.update(params.id, body);
  }

  @Delete('/:id')
  @McpTool({ description: 'Delete a permission by ID (admin only)', destructive: true, confirm: { level: 'danger', message: 'permissions.confirm.delete' } })
  @Validate({ params: permissionIdParam })
  @ResMsg('permissions.success.deleted')
  async delete(@Params() params: PermissionIdParam) {
    return this.permissionService.delete(params.id);
  }

  @Get('/role/:id')
  @McpTool({ description: 'List all permissions assigned to a role (admin only)', readOnly: true })
  @Validate({ params: roleIdParam })
  @ResMsg('permissions.success.retrieved')
  async getByRole(@Params() params: RoleIdParam) {
    return this.permissionService.getPermissionsByRole(params.id);
  }

  @Get('/roles/:id')
  @McpTool({ description: 'List all roles that have a specific permission (admin only)', readOnly: true })
  @Validate({ params: permissionIdParam })
  @ResMsg('permissions.success.retrieved')
  async getRolesByPermission(@Params() params: PermissionIdParam) {
    return this.permissionService.getRolesByPermission(params.id);
  }

  @Post('/assign/:roleId/:permissionId')
  @McpTool({ description: 'Assign a permission to a role (admin only)', idempotent: false, confirm: { level: 'danger', message: 'permissions.confirm.assignToRole' } })
  @Validate({ params: assignPermissionDto })
  @ResMsg('permissions.success.assigned')
  async assignToRole(@Params() params: AssignPermissionDto) {
    return this.permissionService.assignPermissionToRole(params.roleId, params.permissionId);
  }

  @Delete('/remove/:roleId/:permissionId')
  @McpTool({ description: 'Remove a permission from a role (admin only)', destructive: true, confirm: { level: 'danger', message: 'permissions.confirm.removeFromRole' } })
  @Validate({ params: assignPermissionDto })
  @ResMsg('permissions.success.removed')
  async removeFromRole(@Params() params: AssignPermissionDto) {
    return this.permissionService.removePermissionFromRole(params.roleId, params.permissionId);
  }
}
