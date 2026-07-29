import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthService } from "./auth.service.js";
import { AuthSessionDto } from "./dto/auth-session.dto.js";
import { LoginBodyDto } from "./dto/login-body.dto.js";
import { RefreshBodyDto } from "./dto/refresh-body.dto.js";
import { JwtAuthGuard, type JwtAuthenticatedRequest } from "./guards/jwt-auth.guard.js";
import { parseJsonBody, readRequiredString } from "./parse-json-body.js";

/**
 * Public authentication endpoints (login / refresh) and authenticated logout.
 */
@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  /**
   * @param auth - Auth application service.
   */
  constructor(private readonly auth: AuthService) {}

  /**
   * Signs in with email and password.
   *
   * @param body - Raw Fastify body (Buffer or object).
   * @returns Session tokens and user.
   */
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiBody({ type: LoginBodyDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(@Body() body: unknown): Promise<AuthSessionDto> {
    const json = parseJsonBody(body);
    return this.auth.login(readRequiredString(json, "email"), readRequiredString(json, "password"));
  }

  /**
   * Renews an access token using a refresh token.
   *
   * @param body - Raw Fastify body (Buffer or object).
   * @returns Renewed session.
   */
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Refresh an access token" })
  @ApiBody({ type: RefreshBodyDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token" })
  async refresh(@Body() body: unknown): Promise<AuthSessionDto> {
    const json = parseJsonBody(body);
    return this.auth.refresh(readRequiredString(json, "refreshToken"));
  }

  /**
   * Signs out the current user (invalidates refresh tokens).
   *
   * @param request - Authenticated request carrying the access token.
   */
  @Post("logout")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Sign out the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  async logout(@Req() request: JwtAuthenticatedRequest): Promise<void> {
    const token = request.accessToken;
    if (token === undefined) {
      return;
    }
    await this.auth.logout(token);
  }
}
