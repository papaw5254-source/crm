import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class SalaryWorkerQueryDto {
  @ApiPropertyOptional({ example: '2026-07', description: 'YYYY-MM' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
