import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDebtPaymentDto {
  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0.01, { message: 'Payment amount must be a positive number' })
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;
}
