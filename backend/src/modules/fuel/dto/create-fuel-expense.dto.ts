import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFuelExpenseDto {
  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.01, { message: 'Liters must be a positive number' })
  liters: number;

  @ApiProperty({ example: 'Volga' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
