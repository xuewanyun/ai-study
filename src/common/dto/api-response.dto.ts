export class ApiResponseDto<T> {
  status: number;
  message: string;
  data: T | null;
}
