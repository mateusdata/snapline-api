import { ApiProperty } from "@nestjs/swagger";
import { User } from "src/generated/prisma/client";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsOptional, IsString,  MaxLength } from 'class-validator';


export class CreateUserGoogleDto implements Partial<User> {
  @ApiProperty({ example: "Parceiro padrão" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => capitalizeWords(String(value)))
  name: string;

  @ApiProperty({ example: "parceiro@gmail.com" })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(500)
  @Transform(({ value }) => String(value).toLowerCase())
  email: string;
  @ApiProperty({ example: "url-da-imagem-de-avatar" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  avatar?: string;
}


function capitalizeWords(str: string) {
  return str
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
