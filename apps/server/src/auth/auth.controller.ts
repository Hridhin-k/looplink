import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";

import { SUPABASE_CONFIG } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import { ApiKeyService } from "../workspaces/api-keys/api-key.service.js";
import {
  clearAuthCookies,
  isAuthCookieEnabled,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from "./auth-cookies.js";
import { AuthService } from "./auth.service.js";
import { AuthSessionDto } from "./dto/auth-session.dto.js";
import { LoginBodyDto } from "./dto/login-body.dto.js";
import { RefreshBodyDto } from "./dto/refresh-body.dto.js";
import { JwtAuthGuard, type JwtAuthenticatedRequest } from "./guards/jwt-auth.guard.js";
import { parseJsonBody, readRequiredString } from "./parse-json-body.js";

/**
 * Public authentication endpoints and authenticated account lifecycle.
 */
@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeyService,
    @Inject(SUPABASE_CONFIG) private readonly supabaseConfig: SupabaseConfig,
  ) {}

  @Get("cli/config")
  @ApiOperation({ summary: "Get OAuth bootstrap config for CLI login" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        supabaseUrl: { type: "string" },
        supabaseAnonKey: { type: "string" },
        provider: { type: "string" },
      },
      required: ["supabaseUrl", "supabaseAnonKey", "provider"],
    },
  })
  getCliConfig(): { supabaseUrl: string; supabaseAnonKey: string; provider: string } {
    if (!this.supabaseConfig.enabled) {
      throw new ServiceUnavailableException("Supabase is not configured.");
    }

    const providerFromEnv = process.env["BADGER_CLI_OAUTH_PROVIDER"]?.trim() ?? "";
    return {
      supabaseUrl: this.supabaseConfig.url,
      supabaseAnonKey: this.supabaseConfig.anonKey,
      provider: providerFromEnv.length > 0 ? providerFromEnv : "google",
    };
  }

  @Post("oauth/start")
  @HttpCode(200)
  @ApiOperation({ summary: "Start browser OAuth login (PKCE)" })
  startOAuth(@Body() body: unknown): { url: string; codeVerifier: string } {
    const json = parseJsonBody(body);
    const redirectTo = readRequiredString(json, "redirectTo");
    const providerRaw = json["provider"];
    const provider =
      typeof providerRaw === "string" && providerRaw.trim().length > 0
        ? providerRaw.trim()
        : (process.env["BADGER_CLI_OAUTH_PROVIDER"]?.trim() ?? "google");
    return this.auth.beginOAuthLogin({ provider, redirectTo });
  }

  @Post("oauth/callback")
  @HttpCode(200)
  @ApiOperation({ summary: "Complete browser OAuth login" })
  @ApiOkResponse({ type: AuthSessionDto })
  async completeOAuth(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionDto> {
    const json = parseJsonBody(body);
    const session = await this.auth.completeOAuthLogin(
      {
        code: readRequiredString(json, "code"),
        codeVerifier: readRequiredString(json, "codeVerifier"),
      },
      requestMeta(request),
    );
    return this.respondWithSession(session, reply);
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiBody({ type: LoginBodyDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionDto> {
    const json = parseJsonBody(body);
    const session = await this.auth.login(
      readRequiredString(json, "email"),
      readRequiredString(json, "password"),
      requestMeta(request),
    );
    return this.respondWithSession(session, reply);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Refresh an access token (rotates refresh token)" })
  @ApiBody({ type: RefreshBodyDto })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token" })
  async refresh(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionDto> {
    const json = parseJsonBody(body);
    let refreshToken: string;
    try {
      refreshToken = readRequiredString(json, "refreshToken");
    } catch {
      const cookieToken = readCookie(request, REFRESH_COOKIE);
      if (cookieToken === undefined) {
        throw new BadRequestException("refreshToken is required.");
      }
      refreshToken = cookieToken;
    }

    const session = await this.auth.refresh(refreshToken, requestMeta(request));
    return this.respondWithSession(session, reply);
  }

  @Post("password/forgot")
  @HttpCode(204)
  @ApiOperation({ summary: "Request a password reset email" })
  async forgotPassword(@Body() body: unknown, @Req() request: FastifyRequest): Promise<void> {
    const json = parseJsonBody(body);
    await this.auth.requestPasswordReset(
      readRequiredString(json, "email"),
      readRequiredString(json, "redirectTo"),
      requestMeta(request),
    );
  }

  @Post("password/reset")
  @HttpCode(204)
  @ApiOperation({ summary: "Set a new password using a recovery access token" })
  async resetPassword(@Body() body: unknown, @Req() request: FastifyRequest): Promise<void> {
    const json = parseJsonBody(body);
    await this.auth.updatePassword(
      readRequiredString(json, "accessToken"),
      readRequiredString(json, "password"),
      requestMeta(request),
    );
  }

  @Post("email/resend-verification")
  @HttpCode(204)
  @ApiOperation({ summary: "Resend email verification" })
  async resendVerification(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    const json = parseJsonBody(body);
    await this.auth.resendVerificationEmail(
      readRequiredString(json, "email"),
      readRequiredString(json, "redirectTo"),
      requestMeta(request),
    );
  }

  @Get("email/status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Email verification status for the current user" })
  async emailStatus(@Req() request: JwtAuthenticatedRequest): Promise<{
    email: string | null;
    emailVerified: boolean;
  }> {
    const token = request.accessToken;
    if (token === undefined) {
      throw new ServiceUnavailableException("Missing access token.");
    }
    return this.auth.getEmailStatus(token);
  }

  @Delete("account")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Permanently delete the authenticated account" })
  async deleteAccount(
    @Body() body: unknown,
    @Req() request: JwtAuthenticatedRequest & FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.accessToken;
    if (token === undefined) {
      return;
    }
    const json = parseJsonBody(body);
    const confirmation = readRequiredString(json, "confirmation");
    const user = request.authUser;
    if (user !== undefined) {
      await this.apiKeys.revokeAllForUser(user.id);
    }
    await this.auth.deleteAccount(token, confirmation, requestMeta(request));
    clearAuthCookies(reply);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Sign out the current user" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  async logout(
    @Req() request: JwtAuthenticatedRequest & FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.accessToken;
    if (token !== undefined) {
      await this.auth.logout(token, {
        ...(request.authUser?.id !== undefined ? { actorUserId: request.authUser.id } : {}),
        ...requestMeta(request),
      });
    }
    clearAuthCookies(reply);
  }

  private respondWithSession(session: AuthSessionDto, reply: FastifyReply): AuthSessionDto {
    if (isAuthCookieEnabled()) {
      setAuthCookies(reply, session);
    }
    return session;
  }
}

function requestMeta(request: FastifyRequest): { ipAddress?: string; userAgent?: string } {
  const userAgentHeader = request.headers["user-agent"];
  const meta: { ipAddress?: string; userAgent?: string } = {};
  if (typeof request.ip === "string" && request.ip.length > 0) {
    meta.ipAddress = request.ip;
  }
  if (typeof userAgentHeader === "string" && userAgentHeader.length > 0) {
    meta.userAgent = userAgentHeader;
  }
  return meta;
}
