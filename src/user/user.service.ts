import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  /**
   *
   * @returns string
   */
  getUsers(): UserResponseDto[] {
    return [
      {
        id: 1,
        username: 'tom',
        email: 'tom@example.com',
      },
      {
        id: 2,
        username: 'jack',
        email: 'jack@example.com',
      },
    ];
  }
  /**
   *
   * @param body
   * @returns string
   */
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

    return {
      id: Date.now(),
      username: body.username,
      email: body.email,
    };
  }
}
