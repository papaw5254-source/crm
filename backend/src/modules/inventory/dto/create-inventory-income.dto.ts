import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';

export class CreateInventoryIncomeDto {
  @ApiPropertyOptional({ enum: BrickType, default: BrickType.BAKED_BRICK })
  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType = BrickType.BAKED_BRICK;

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
}
