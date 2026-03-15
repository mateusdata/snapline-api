import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Min, MinLength } from "class-validator";

export class CreateAuthGoogleDto {
    @ApiProperty({
        example: "ID token fornecido pelo Google"
    })
    @IsNotEmpty()
    @IsString()
    idToken: string;
}