import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePrepaymentDeliveryDto {
  @ApiProperty({ example: 2000, description: 'Yetkazilgan g\'isht soni' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
