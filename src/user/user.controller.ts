import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  // 获取用户列表
  @Get('list')
  getUsers(): UserResponseDto[] {
    return this.userService.getUsers();
  }
  // 创建用户
  @Post('create')
  createUser(@Body() body: CreateUserDto): UserResponseDto {
    return this.userService.createUser(body);
  }
}
