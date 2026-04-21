import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateUserDto,
  GetUsersQueryDto,
  ReplaceUserDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET /user?username=tom&email=tom@example.com&page=1&pageSize=10
  @Get()
  getUsers(@Query() query: GetUsersQueryDto): UserResponseDto[] {
    return this.userService.getUsers(query);
  }

  // GET /user/by-status?status=active (query 传参)
  @Get('by-status')
  getUsersByStatus(
    @Query('status') status?: 'active' | 'inactive',
  ): UserResponseDto[] {
    return this.userService.getUsersByStatus(status);
  }

  // GET /user/1 (params 传参)
  @Get(':id')
  getUserById(@Param('id', ParseIntPipe) id: number): UserResponseDto {
    return this.userService.getUserById(id);
  }

  // POST /user (body 传参)
  @Post()
  createUser(@Body() body: CreateUserDto): UserResponseDto {
    return this.userService.createUser(body);
  }

  // PATCH /user/1 (params + body)
  @Patch(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
  ): UserResponseDto {
    return this.userService.updateUser(id, body);
  }

  // PUT /user/1 (params + body, 全量替换)
  @Put(':id')
  replaceUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReplaceUserDto,
  ): UserResponseDto {
    return this.userService.replaceUser(id, body);
  }

  // DELETE /user/1 (params)
  @Delete(':id')
  removeUser(@Param('id', ParseIntPipe) id: number): {
    success: boolean;
    id: number;
  } {
    return this.userService.removeUser(id);
  }

  // POST /user/1/reset-password?notifyByEmail=true (params + query + body)
  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Query('notifyByEmail', ParseBoolPipe) notifyByEmail: boolean,
    @Body() body: ResetPasswordDto,
  ): { id: number; passwordUpdated: boolean; notifyByEmail: boolean } {
    return this.userService.resetPassword(id, notifyByEmail, body);
  }

  // GET /user/1/posts/101 (多 params 传参)
  @Get(':id/posts/:postId')
  getUserPost(
    @Param('id', ParseIntPipe) id: number,
    @Param('postId', ParseIntPipe) postId: number,
  ): { userId: number; postId: number; title: string } {
    return this.userService.getUserPost(id, postId);
  }
}
