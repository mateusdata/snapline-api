import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateAvatarDto {
  @ApiProperty({ required: false, example: 'Guerreiro Lendário' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'https://i.postimg.cc/MMfhrzcX/1.png' })
  @IsNotEmpty()
  @IsString()
  @IsUrl({}, { message: 'A URL da imagem precisa ser válida' })
  imageUrl: string;

  @ApiProperty({ default: 0, description: 'Preço em gemas' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceGems?: number;

  @ApiProperty({ default: false, description: 'Se for true, é comprado com dinheiro real via RevenueCat' })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}