import { ApiProperty } from "@nestjs/swagger";

export class CreateWorkspaceBodyDto {
  @ApiProperty({ example: "My Team" })
  name!: string;
}
