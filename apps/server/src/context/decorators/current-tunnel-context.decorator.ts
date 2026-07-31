import {
  createParamDecorator,
  type ExecutionContext as NestExecutionContext,
} from "@nestjs/common";

import type { TunnelContext } from "../tunnel-context.interface.js";

/**
 * Nest request property where {@link TunnelContext} is attached after resolution.
 */
export const TUNNEL_CONTEXT_REQUEST_KEY = "badgerTunnelContext";

/**
 * Parameter decorator that reads the request-bound {@link TunnelContext}.
 *
 * Controllers / guards must resolve and attach the context before this runs.
 */
export const CurrentTunnelContext = createParamDecorator(
  (_data: unknown, ctx: NestExecutionContext): TunnelContext => {
    const request = ctx.switchToHttp().getRequest<{
      [TUNNEL_CONTEXT_REQUEST_KEY]?: TunnelContext;
    }>();
    const context = request[TUNNEL_CONTEXT_REQUEST_KEY];
    if (context === undefined) {
      throw new Error("TunnelContext is not bound to this request.");
    }
    return context;
  },
);
