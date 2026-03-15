import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Min, MinLength } from "class-validator";

export class CreateAuthDto {
    @ApiProperty({
        example: "gamer@gmail.com"
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        example: "123456"
    })
    @IsNotEmpty()
    @MinLength(6)
    @IsString()
    password?: string | undefined;
}