import { Module } from "@nestjs/common";

import { TunnelModule } from "../tunnel/tunnel.module.js";
import { HttpExchangeCoordinator } from "./http-exchange.coordinator.js";
import { HttpForwardController } from "./http-forward.controller.js";
import { HttpForwardingService } from "./http-forwarding.service.js";
import { PathTunnelController } from "./path-tunnel.controller.js";
import { PublicRequestForwarder } from "./public-request-forwarder.js";

/**
 * HTTP data-plane module that proxies public requests through tunnel WebSockets.
 *
 * Controllers are ordered so path-based `/tunnel/:id` routes register before the
 * Host-based catch-all.
 */
@Module({
  imports: [TunnelModule],
  controllers: [PathTunnelController, HttpForwardController],
  providers: [
    {
      // The coordinator's optional numeric limits look like injectable
      // dependencies to Nest's reflection; a factory keeps the defaults.
      provide: HttpExchangeCoordinator,
      useFactory: () => new HttpExchangeCoordinator(),
    },
    HttpForwardingService,
    PublicRequestForwarder,
  ],
  exports: [HttpExchangeCoordinator, HttpForwardingService, PublicRequestForwarder],
})
export class HttpForwardModule {}
