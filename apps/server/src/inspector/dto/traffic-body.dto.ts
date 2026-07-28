import { ApiProperty } from "@nestjs/swagger";

/**
 * Serialized HTTP body snapshot for inspector responses.
 */
export class TrafficBodyDto {
  @ApiProperty({ description: "Original body size in bytes before truncation.", example: 12 })
  byteLength!: number;

  @ApiProperty({ description: "True when dataBase64 holds fewer bytes than byteLength." })
  truncated!: boolean;

  @ApiProperty({
    description: "Base64-encoded body bytes (possibly truncated).",
    example: "cGluZw==",
  })
  dataBase64!: string;
}
