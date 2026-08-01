import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateSalaryWorkerDto {
  @ApiProperty({ example: 'Ahmadjon Toshmatov' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '2026-07', description: 'YYYY-MM' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month: string;

  @ApiProperty({ example: 3000000 })
  @IsNumber()
  @Min(0)
  salaryAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
