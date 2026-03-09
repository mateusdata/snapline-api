import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "src/common/decorators/rules.decorator";
import { Role } from "src/generated/prisma/enums";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }
    canActivate(context: ExecutionContext): boolean {

        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles) return true;
        const request = context.switchToHttp().getRequest();

        const hasRole = requiredRoles.some((role) => request.user.role.includes(role));
        console.log(hasRole)
        if(!hasRole) {
           throw new ForbiddenException("not permitted to access this resource");
        }
        return hasRole;
    }
}