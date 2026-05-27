import { Controller } from 'najm-core';
import { Get, Post, Put, Delete, ResMsg } from 'najm-core';
import { Params, Body } from 'najm-core';
import { UserService } from './UserService';
import { isAdmin } from '../roles';
import { isAuth } from '../auth';
import { Validate } from 'najm-validation';
import {
  languageParam,
  emailParam,
  userIdParam,
  userIdInParam,
  createUserDto,
  updateUserDto,
  assignRoleParams,
  type LanguageParam,
  type EmailParam,
  type UserIdParam,
  type UserIdInParam,
  type CreateUserDto,
  type UpdateUserDto,
  type AssignRoleParams
} from './UserDto';

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) { }

  @Get()
  @isAdmin()
  @ResMsg('users.success.retrieved')
  async getUsers() {
    return this.userService.getAll();
  }

  @Get('/lang')
  @isAuth()
  @ResMsg('users.success.retrieved')
  async getLang() {
    const language = await this.userService.getLang();
    return { language };
  }

  @Post('/lang/:language')
  @isAuth()
  @Validate({ params: languageParam })
  @ResMsg('users.success.updated')
  async updateLang(@Params() params: LanguageParam) {
    return this.userService.updateLang(params.language);
  }

  @Get('/:id')
  @isAdmin()
  @Validate({ params: userIdParam })
  @ResMsg('users.success.retrieved')
  async getUser(@Params() params: UserIdParam) {
    return this.userService.getById(params.id);
  }

  @Get('/email/:email')
  @isAdmin()
  @Validate({ params: emailParam })
  @ResMsg('users.success.retrieved')
  async getByEmail(@Params() params: EmailParam) {
    return this.userService.getByEmail(params.email);
  }

  @Get('/role/:userId')
  @isAdmin()
  @Validate({ params: userIdInParam })
  @ResMsg('users.success.retrieved')
  async getRole(@Params() params: UserIdInParam) {
    return this.userService.getRoleName(params.userId);
  }

  @Post()
  @isAdmin()
  @Validate(createUserDto)
  @ResMsg('users.success.created')
  async create(@Body() body: CreateUserDto) {
    return this.userService.create(body);
  }

  @Put('/:id')
  @isAdmin()
  @Validate({
    params: userIdParam,
    body: updateUserDto
  })
  @ResMsg('users.success.updated')
  async update(@Params() params: UserIdParam, @Body() body: UpdateUserDto) {
    return this.userService.update(params.id, body);
  }

  @Delete('/:id')
  @isAdmin()
  @Validate({ params: userIdParam })
  @ResMsg('users.success.deleted')
  async delete(@Params() params: UserIdParam) {
    return this.userService.delete(params.id);
  }

  @Delete()
  @isAdmin()
  @ResMsg('users.success.allDeleted')
  async deleteAll() {
    return this.userService.deleteAll();
  }

  @Post('/assign/:userId/:roleId')
  @isAdmin()
  @Validate({ params: assignRoleParams })
  @ResMsg('users.success.updated')
  async assignRole(@Params() params: AssignRoleParams) {
    return this.userService.assignRole(params.userId, params.roleId);
  }

  @Delete('/remove/:userId')
  @isAdmin()
  @Validate({ params: userIdInParam })
  @ResMsg('users.success.updated')
  async removeRole(@Params() params: UserIdInParam) {
    return this.userService.removeRole(params.userId);
  }
}