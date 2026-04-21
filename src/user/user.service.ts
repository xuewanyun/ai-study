import {
  BadRequestException,
  NotFoundException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  CreateUserDto,
  GetUsersQueryDto,
  ReplaceUserDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  private readonly users: UserResponseDto[] = [
    { id: 1, username: 'tom', email: 'tom@example.com' },
    { id: 2, username: 'jack', email: 'jack@example.com' },
  ];

  getUsers(query: GetUsersQueryDto): UserResponseDto[] {
    let result = this.users;
    const username = query.username?.trim();
    const email = query.email?.trim();

    if (username) {
      result = result.filter((item) => item.username.includes(username));
    }

    if (email) {
      result = result.filter((item) => item.email.includes(email));
    }

    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const start = (page - 1) * pageSize;
    return result.slice(start, start + pageSize);
  }

  getUserById(id: number): UserResponseDto {
    const user = this.users.find((item) => item.id === id);
    if (!user) {
      throw new NotFoundException(`user ${id} not found`);
    }
    return user;
  }

  createUser(body: CreateUserDto): UserResponseDto {
    if (!body.username?.trim()) {
      throw new BadRequestException('username is required');
    }
    if (!body.email?.trim()) {
      throw new BadRequestException('email is required');
    }
    if (!body.password?.trim()) {
      throw new BadRequestException('password is required');
    }
    if (!body.email.includes('@')) {
      throw new BadRequestException('email format is invalid');
    }
    if (body.username === 'server_error') {
      throw new InternalServerErrorException('simulate server error');
    }

    const createdUser = {
      id: Date.now(),
      username: body.username,
      email: body.email,
    };
    this.users.push(createdUser);
    return createdUser;
  }

  updateUser(id: number, body: UpdateUserDto): UserResponseDto {
    const user = this.getUserById(id);
    const username = body.username?.trim();
    const email = body.email?.trim();

    if (username) {
      user.username = username;
    }
    if (email) {
      if (!email.includes('@')) {
        throw new BadRequestException('email format is invalid');
      }
      user.email = email;
    }

    return user;
  }

  replaceUser(id: number, body: ReplaceUserDto): UserResponseDto {
    const user = this.getUserById(id);
    const username = body.username?.trim();
    const email = body.email?.trim();

    if (!username) {
      throw new BadRequestException('username is required');
    }
    if (!email) {
      throw new BadRequestException('email is required');
    }
    if (!email.includes('@')) {
      throw new BadRequestException('email format is invalid');
    }

    user.username = username;
    user.email = email;
    return user;
  }

  removeUser(id: number): { success: boolean; id: number } {
    const index = this.users.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException(`user ${id} not found`);
    }
    this.users.splice(index, 1);
    return { success: true, id };
  }

  resetPassword(
    id: number,
    notifyByEmail: boolean,
    body: ResetPasswordDto,
  ): { id: number; passwordUpdated: boolean; notifyByEmail: boolean } {
    this.getUserById(id);
    if (!body.newPassword?.trim()) {
      throw new BadRequestException('newPassword is required');
    }
    return { id, passwordUpdated: true, notifyByEmail };
  }

  getUsersByStatus(status?: 'active' | 'inactive'): UserResponseDto[] {
    if (!status) {
      return this.users;
    }
    return this.users.filter((item) =>
      status === 'active' ? item.id % 2 === 1 : item.id % 2 === 0,
    );
  }

  getUserPost(
    id: number,
    postId: number,
  ): { userId: number; postId: number; title: string } {
    this.getUserById(id);
    return {
      userId: id,
      postId,
      title: `mock post ${postId} of user ${id}`,
    };
  }
}
