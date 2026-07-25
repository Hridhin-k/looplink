import { Module } from "@nestjs/common";

import { TunnelModule } from "../tunnel/tunnel.module.js";
import { HttpExchangeCoordinator } from "./http-exchange.coordinator.js";
import { HttpForwardController } from "./http-forward.controller.js";
import { HttpForwardingService } from "./http-forwarding.service.js";

/**
 * HTTP data-plane module that proxies public requests through tunnel WebSockets.
 */
@Module({
  imports: [TunnelModule],
  controllers: [HttpForwardController],
  providers: [
    {
      // The coordinator's optional numeric limits look like injectable
      // dependencies to Nest's reflection; a factory keeps the defaults.
      provide: HttpExchangeCoordinator,
      useFactory: () => new HttpExchangeCoordinator(),
    },
    HttpForwardingService,
  ],
  exports: [HttpExchangeCoordinator, HttpForwardingService],
})
export class HttpForwardModule {}
