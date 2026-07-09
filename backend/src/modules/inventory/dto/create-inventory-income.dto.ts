import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';

export class CreateInventoryIncomeDto {
  @ApiPropertyOptional({ enum: BrickType, default: BrickType.RAW_BRICK })
  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType = BrickType.RAW_BRICK;

  @ApiProperty({ example: 5000 })
  @IsInt()
  @Min(1, { message: 'Quantity must be a positive number' })
  quantity: number;

  @ApiPropertyOptional({ example: 'Daily production batch' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerRatePerBrick?: number;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerPaidAmount?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Oldingi oydan qolgan ishchi qarzi' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerOldDebt?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kretkachRatePerBrick?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kretkachPaidAmount?: number;

  @ApiPropertyOptional({ example: 300000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kretkachOldDebt?: number;

  @ApiPropertyOptional({ example: 80000, description: 'Eshki kunlik to\'lov miqdori' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  eshkiDailyAmount?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  eshkiPaidAmount?: number;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  eshkiOldDebt?: number;
}
