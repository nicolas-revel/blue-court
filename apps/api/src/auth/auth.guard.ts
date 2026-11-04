import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService, type SignedIn } from "./auth.service.js";
import { IS_PUBLIC } from "./public.decorator.js";
import { readSessionToken } from "./session-cookie.js";

interface RequestWithSession {
  readonly headers: { readonly cookie?: string };
  signedIn?: SignedIn;
}

/**
 * Applied to every HTTP route: the request needs a valid session cookie unless the route is
 * marked `@Public()`. Live updates check the same cookie in `LiveGateway`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket messages are authenticated once, at the handshake.
    if (context.getType() !== "http") return true;
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const signedIn = await this.auth.check(readSessionToken(request.headers.cookie));
    if (signedIn !== undefined) request.signedIn = signedIn;
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true || signedIn !== undefined) return true;
    throw new UnauthorizedException({ message: "sign in first" });
  }
}

/** The signed-in organizer and session of a route that is not public. */
export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const { signedIn } = context.switchToHttp().getRequest<RequestWithSession>();
  if (signedIn === undefined) throw new UnauthorizedException({ message: "sign in first" });
  return signedIn;
});
