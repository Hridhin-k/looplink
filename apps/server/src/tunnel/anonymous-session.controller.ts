import { Controller, Delete, Headers, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AnonymousSessionService } from "./anonymous-session.service.js";

/**
 * HTTP API for minting / destroying ephemeral anonymous tunnel sessions.
 *
 * Used by the CLI when `badger <port>` runs without login. Not part of AuthModule.
 */
@ApiTags("anonymous-sessions")
@Controller("api/v1/anonymous-sessions")
export class AnonymousSessionController {
  constructor(private readonly sessions: AnonymousSessionService) {}

  @Post()
  @ApiOperation({ summary: "Create an ephemeral anonymous tunnel session" })
  async create(): Promise<{
    id: string;
    token: string;
    expiresAt: string;
  }> {
    const created = await this.sessions.create();
    return {
      id: created.session.id,
      token: created.token,
      expiresAt: created.session.expiresAt,
    };
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: "Destroy an anonymous tunnel session" })
  async destroy(
    @Headers("x-anonymous-session") tokenHeader: string | undefined,
  ): Promise<void> {
    const token = typeof tokenHeader === "string" ? tokenHeader.trim() : "";
    if (token.length === 0) {
      return;
    }
    await this.sessions.destroyByToken(token);
  }
}
