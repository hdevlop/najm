import { Controller } from 'najm-api';
import { Get, Post, Put, Delete, ResMsg } from 'najm-api';
import { Body, Params } from 'najm-api';
import { McpTool, ToolGroup } from 'najm-mcp';
import { Validate } from 'najm-validation';
import { isAdmin } from 'najm-auth';
import { UserService } from 'najm-auth';
import {
  createUserDto,
  updateUserDto,
  userIdParam,
  userIdInParam,
  assignRoleParams,
  emailParam,
  type CreateUserDto,
  type UpdateUserDto,
  type UserIdParam,
  type UserIdInParam,
  type AssignRoleParams,
  type EmailParam,
} from 'najm-auth';

@ToolGroup('users')
@Controller('/tools/users')
@isAdmin()
export class UserToolsController {
  constructor(private userService: UserService) {}

  @Get('/')
  @McpTool({ description: 'List all users (admin only)', readOnly: true })
  @ResMsg('users.success.retrieved')
  async getAll() {
    return this.userService.getAll();
  }

  @Get('/:id')
  @McpTool({ description: 'Get a user by ID (admin only)', readOnly: true })
  @Validate({ params: userIdParam })
  @ResMsg('users.success.retrieved')
  async getById(@Params() params: UserIdParam) {
    return this.userService.getById(params.id);
  }

  @Get('/email/:email')
  @McpTool({ description: 'Find a user by email address (admin only)', readOnly: true })
  @Validate({ params: emailParam })
  @ResMsg('users.success.retrieved')
  async getByEmail(@Params() params: EmailParam) {
    return this.userService.getByEmail(params.email);
  }

  @Get('/role/:userId')
  @McpTool({ description: 'Get the role name of a user (admin only)', readOnly: true })
  @Validate({ params: userIdInParam })
  @ResMsg('users.success.retrieved')
  async getRole(@Params() params: UserIdInParam) {
    return this.userService.getRoleName(params.userId);
  }

  @Post('/')
  @McpTool({ description: 'Create a new user (admin only)', idempotent: false, confirm: { level: 'danger', message: 'users.confirm.create' } })
  @Validate(createUserDto)
  @ResMsg('users.success.created')
  async create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @Put('/:id')
  @McpTool({ description: 'Update a user by ID (admin only)', confirm: { level: 'danger', message: 'users.confirm.update' } })
  @Validate({ params: userIdParam, body: updateUserDto })
  @ResMsg('users.success.updated')
  async update(@Params() params: UserIdParam, @Body() body: UpdateUserDto) {
    return this.userService.update(params.id, body);
  }

  @Delete('/:id')
  @McpTool({ description: 'Delete a user by ID (admin only)', destructive: true, confirm: { level: 'danger', message: 'users.confirm.delete' } })
  @Validate({ params: userIdParam })
  @ResMsg('users.success.deleted')
  async delete(@Params() params: UserIdParam) {
    return this.userService.delete(params.id);
  }

  @Post('/assign/:userId/:roleId')
  @McpTool({ description: 'Assign a role to a user (admin only)', idempotent: false, confirm: { level: 'danger', message: 'users.confirm.assignRole' } })
  @Validate({ params: assignRoleParams })
  @ResMsg('users.success.updated')
  async assignRole(@Params() params: AssignRoleParams) {
    return this.userService.assignRole(params.userId, params.roleId);
  }

  @Delete('/remove/:userId')
  @McpTool({ description: 'Remove role from a user (admin only)', destructive: true, confirm: { level: 'danger', message: 'users.confirm.removeRole' } })
  @Validate({ params: userIdInParam })
  @ResMsg('users.success.updated')
  async removeRole(@Params() params: UserIdInParam) {
    return this.userService.removeRole(params.userId);
  }
}
