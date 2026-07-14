import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateDebtorDto {
  @ApiProperty({ example: 'Ahmadjon Toshmatov' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{9,15}$/, { message: 'Phone number is not valid' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 2700000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  oldDebt?: number;

  @ApiPropertyOptional({ example: '2026-07-14' })
  @IsOptional()
  @IsDateString()
  lastDebtDate?: string;
}
