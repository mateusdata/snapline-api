import { $Enums } from "src/generated/prisma/client";

export interface JwtPayload {
    sub: string;
    email: string;
    role: $Enums.Role;
    iat?: number;
    exp?: number;


}