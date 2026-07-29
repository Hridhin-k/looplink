import { Controller, Get, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentUser } from "./decorators/current-user.decorator.js";
import { AuthUserDto } from "./dto/auth-session.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import type { AuthUser } from "./auth.types.js";

/**
 * Current-user endpoint protected by JWT verification.
 */
@ApiTags("auth")
@ApiBearerAuth()
@Controller("api/v1/me")
@UseGuards(JwtAuthGuard)
export class MeController {
  /**
   * Returns the authenticated user from the verified Bearer JWT.
   *
   * @param user - Current user injected by {@link CurrentUser}.
   * @returns Public user identity.
   */
  @Get()
  @ApiOperation({ summary: "Get the current authenticated user" })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  getMe(@CurrentUser() user: AuthUser): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      authMethod: user.authMethod ?? "jwt",
      ...(user.workspaceId === undefined ? {} : { workspaceId: user.workspaceId }),
      ...(user.apiKeyId === undefined ? {} : { apiKeyId: user.apiKeyId }),
    };
  }
}
