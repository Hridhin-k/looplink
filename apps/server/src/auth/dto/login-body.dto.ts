import { ApiProperty } from "@nestjs/swagger";

/**
 * Email/password login payload.
 */
export class LoginBodyDto {
  @ApiProperty({ example: "dev@example.com" })
  email!: string;

  @ApiProperty({ example: "password" })
  password!: string;
}
