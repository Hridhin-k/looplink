import { ReplayError, ReplayErrorCode } from "@hridhin-k/badger-shared";
import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Maps {@link ReplayError} (or unknown failures) to an HTTP exception.
 *
 * @param error - Caught error from {@link import("./request-replay.service.js").RequestReplayService}.
 * @returns Nest HTTP exception.
 */
export function toReplayHttpException(error: unknown): HttpException {
  if (!(error instanceof ReplayError)) {
    return new HttpException(
      { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: "Replay failed." },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  switch (error.code) {
    case ReplayErrorCode.NotFound:
      return new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, code: error.code, message: error.message },
        HttpStatus.NOT_FOUND,
      );
    case ReplayErrorCode.TunnelUnavailable:
      return new HttpException(
        { statusCode: HttpStatus.CONFLICT, code: error.code, message: error.message },
        HttpStatus.CONFLICT,
      );
    case ReplayErrorCode.UnsupportedMethod:
      return new HttpException(
        { statusCode: HttpStatus.BAD_REQUEST, code: error.code, message: error.message },
        HttpStatus.BAD_REQUEST,
      );
    case ReplayErrorCode.ForwardFailed:
      return new HttpException(
        { statusCode: HttpStatus.BAD_GATEWAY, code: error.code, message: error.message },
        HttpStatus.BAD_GATEWAY,
      );
    default: {
      const _exhaustive: never = error.code;
      return new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Unhandled replay error: ${String(_exhaustive)}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
