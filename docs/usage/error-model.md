---
sidebar_position: 9
---

# Error model

Every library throw is one of four classes, mapped to a NestJS exception with a redacted payload:

| Thrown | Nest exception | HTTP | Payload highlights |
|---|---|---|---|
| `IamUnauthorizedError` | `UnauthorizedException` | 401 | `wwwAuthenticate: 'Bearer realm="ukki-iam"'` |
| `IamForbiddenError` | `ForbiddenException` | 403 | — |
| `IamUpstreamUnavailableError` | `ServiceUnavailableException` | 503 | `retryAfter: 5` |
| `IamConfigurationError` | `InternalServerErrorException` | 500 | Generic message (detail logged server-side only) |

Library errors **never** echo upstream payloads. If a Kratos response contains a JWT or session token, the mapper strips it before the error leaves the library — you cannot accidentally leak PII into an error response or log line.

To surface the `wwwAuthenticate` hint and `retryAfter` as real HTTP headers, add a tiny interceptor in your app:

```ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class IamErrorHeadersInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        if (err instanceof HttpException) {
          const res = ctx.switchToHttp().getResponse();
          const body = err.getResponse() as any;
          if (body?.wwwAuthenticate) res.setHeader('WWW-Authenticate', body.wwwAuthenticate);
          if (body?.retryAfter != null) res.setHeader('Retry-After', String(body.retryAfter));
        }
        return throwError(() => err);
      }),
    );
  }
}
```
