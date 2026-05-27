import { Controller } from 'najm-core';
import { Get, Post, Put, Delete, ResMsg } from 'najm-core';
import { Params, Body } from 'najm-core';
import { PermissionService } from './PermissionService';
import { isAdmin } from '../roles/RoleGuards';
import { Validate } from 'najm-validation';
import {
  createPermissionDto,
  updatePermissionDto,
  permissionIdParam,
  assignPermissionDto,
  type CreatePermissionDto,
  type UpdatePermissionDto,
  type PermissionIdParam,
  type AssignPermissionDto
} from './PermissionDto';
import { roleIdParam, type RoleIdParam } from '../roles/RoleDto';

@Controller('/permissions')
@isAdmin()
export class PermissionController {
  constructor(private permissionService: PermissionService) { }

  // ============================================================================
  // Option 1: @ResMsg with i18n key (recommended)
  // ============================================================================
  
  @Get()
  @ResMsg('permissions.success.retrieved')
  async getPermissions() {
    return this.permissionService.getAll();
  }

  @Get('/:id')
  @Validate({ params: permissionIdParam })
  @ResMsg('permissions.success.retrieved')
  async getPermission(@Params() params: PermissionIdParam) {
    return this.permissionService.getById(params.id);
  }

  // ============================================================================
  // Option 2: @ResMsg with plain text
  // ============================================================================
  
  @Post()
  @Validate(createPermissionDto)
  @ResMsg({ message: 'Permission created successfully', status: 201 })
  async create(@Body() body: CreatePermissionDto) {
    return this.permissionService.create(body);
  }

  @Put('/:id')
  @Validate({
    params: permissionIdParam,
    body: updatePermissionDto
  })
  @ResMsg('permissions.success.updated')
  async update(@Params() params: PermissionIdParam, @Body() body: UpdatePermissionDto) {
    return this.permissionService.update(params.id, body);
  }

  @Delete('/:id')
  @Validate({ params: permissionIdParam })
  @ResMsg('permissions.success.deleted')
  async delete(@Params() params: PermissionIdParam) {
    return this.permissionService.delete(params.id);
  }

  @Get('/role/:id')
  @Validate({ params: roleIdParam })
  @ResMsg('permissions.success.retrieved')
  async getByRole(@Params() params: RoleIdParam) {
    return this.permissionService.getPermissionsByRole(params.id);
  }

  @Get('/roles/:id')
  @Validate({ params: permissionIdParam })
  @ResMsg('permissions.success.retrieved')
  async getRolesByPermission(@Params() params: PermissionIdParam) {
    return this.permissionService.getRolesByPermission(params.id);
  }

  @Post('/assign/:roleId/:permissionId')
  @Validate({ params: assignPermissionDto })
  @ResMsg('permissions.success.assigned')
  async assignToRole(@Params() params: AssignPermissionDto) {
    return this.permissionService.assignPermissionToRole(params.roleId, params.permissionId);
  }

  @Delete('/remove/:roleId/:permissionId')
  @Validate({ params: assignPermissionDto })
  @ResMsg('permissions.success.removed')
  async removeFromRole(@Params() params: AssignPermissionDto) {
    return this.permissionService.removePermissionFromRole(params.roleId, params.permissionId);
  }

  @Delete()
  @isAdmin()
  @ResMsg('permissions.success.allDeleted')
  async deleteAll() {
    return this.permissionService.deleteAll();
  }
}
