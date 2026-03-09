import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "src/types";

type UserDecorator = "sub" | "email" | "role" | "iat" | "exp" | undefined;


export const User = createParamDecorator((data: UserDecorator, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return data ? user?.[data] : user;
}
)