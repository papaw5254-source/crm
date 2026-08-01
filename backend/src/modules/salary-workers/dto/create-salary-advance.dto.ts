import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSalaryAdvanceDto {
  @ApiProperty({ example: 500000 })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be a positive number' })
  amount: number;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
