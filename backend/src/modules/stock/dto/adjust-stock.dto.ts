import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';

export class AdjustStockDto {
  @ApiProperty({ description: 'Positive to increase, negative to decrease' })
  @IsInt()
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ enum: BrickType, default: BrickType.BAKED_BRICK })
  @IsOptional()
  @IsEnum(BrickType)
  brickType?: BrickType;
}
