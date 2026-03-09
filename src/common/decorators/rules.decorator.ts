import { SetMetadata } from "@nestjs/common";
import { Role } from "src/generated/prisma/enums";

export const ROLES_KEY = 'roles';
export const Rules = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
