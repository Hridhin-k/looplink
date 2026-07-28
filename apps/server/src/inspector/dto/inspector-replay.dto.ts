import { ApiProperty } from "@nestjs/swagger";

/**
 * Response body for `POST /api/v1/inspector/replay/:id`.
 */
export class InspectorReplayResponseDto {
  @ApiProperty({ description: "Original traffic request id." })
  originalRequestId!: string;

  @ApiProperty()
  tunnelId!: string;

  @ApiProperty({ example: "POST" })
  method!: string;

  @ApiProperty({ example: "/echo" })
  path!: string;

  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({
    description: "Response headers excluding Set-Cookie.",
    type: "object",
    additionalProperties: true,
  })
  headers!: Record<string, string | readonly string[]>;

  @ApiProperty({ type: [String] })
  setCookies!: string[];

  @ApiProperty({ description: "Base64-encoded response body." })
  bodyBase64!: string;

  @ApiProperty()
  bodyByteLength!: number;

  @ApiProperty()
  bodyTruncated!: boolean;

  @ApiProperty({
    description: "True when the recorded request body was truncated before replay.",
  })
  requestBodyTruncated!: boolean;
}
