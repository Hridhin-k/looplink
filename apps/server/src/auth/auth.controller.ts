import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
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

import { AuthService } from "./auth.service.js";
import { AuthSessionDto } from "./dto/auth-session.dto.js";
import { LoginBodyDto } from "./dto/login-body.dto.js";
import { RefreshBodyDto } from "./dto/refresh-body.dto.js";
import { JwtAuthGuard, type JwtAuthenticatedRequest } from "./guards/jwt-auth.guard.js";
import { parseJsonBody, readRequiredString } from "./parse-json-body.js";
import { SUPABASE_CONFIG } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";

/**
 * Public authentication endpoints (login / refresh) and authenticated logout.
 */
@ApiTags("auth")
@Controller("api/v1/auth")
export class AuthController {
  /**
   * @param auth - Auth application service.
   */
  constructor(
    private readonly auth: AuthService,
    @Inject(SUPABASE_CONFIG) private readonly supabaseConfig: SupabaseConfig,
  ) {}

  /**
   * Returns public Supabase OAuth bootstrap config for CLI login flow.
   */
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

  /**
   * Starts dashboard/browser OAuth (PKCE). Client should redirect the user to `url`.
   */
  @Post("oauth/start")
  @HttpCode(200)
  @ApiOperation({ summary: "Start browser OAuth login (PKCE)" })
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        url: { type: "string" },
        codeVerifier: { type: "string" },
      },
      required: ["url", "codeVerifier"],
    },
  })
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

  /**
   * Completes dashboard/browser OAuth after the provider redirects back with a code.
   */
  @Post("oauth/callback")
  @HttpCode(200)
  @ApiOperation({ summary: "Complete browser OAuth login" })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ description: "Invalid OAuth code or verifier" })
  async completeOAuth(@Body() body: unknown): Promise<AuthSessionDto> {
    const json = parseJsonBody(body);
    return this.auth.completeOAuthLogin({
      code: readRequiredString(json, "code"),
      codeVerifier: readRequiredString(json, "codeVerifier"),
    });
  }

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
