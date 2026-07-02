import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { ReserveMovementType } from '../../../common/enums/reserve-movement-type.enum';

export class CreateReserveMovementDto {
  @ApiProperty({ enum: BrickType })
  @IsEnum(BrickType)
  brickType: BrickType;

  @ApiProperty({ enum: ReserveMovementType })
  @IsEnum(ReserveMovementType)
  movementType: ReserveMovementType;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;
}
