import { ApiProperty } from "@nestjs/swagger";
import { $Enums, User } from "src/generated/prisma/client";
import { Transform } from "class-transformer";
import { IsEmail, IsEmpty, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, min, MinLength, minLength, ValidateIf } from 'class-validator';

export class CreateUserDto  {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => capitalizeWords(String(value)))
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => String(value).toLowerCase())
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(255)
  password: string;

  @ApiProperty({ enum: $Enums.Role, example: $Enums.Role.USER, })
  @IsEnum($Enums.Role)
  @IsOptional()
  role?: $Enums.Role;

}


function capitalizeWords(str: string) {
  return str
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}