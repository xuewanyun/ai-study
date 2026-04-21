export class CreateUserDto {
  username!: string;
  email!: string;
  password!: string;
}

export class GetUsersQueryDto {
  username?: string;
  email?: string;
  page?: number;
  pageSize?: number;
}

export class UpdateUserDto {
  username?: string;
  email?: string;
}

export class ResetPasswordDto {
  newPassword!: string;
}

export class ReplaceUserDto {
  username!: string;
  email!: string;
}

export class GetUsersByStatusQueryDto {
  status?: 'active' | 'inactive';
}
