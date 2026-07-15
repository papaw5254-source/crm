import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { ReserveMovementType } from '../../../common/enums/reserve-movement-type.enum';

export class CreateReserveMovementDto {
  @ApiProperty({ enum: BrickType })
  @IsEnum(BrickType)
  brickType: BrickType;

  @ApiProperty({ enum: ReserveMovementType })
  @IsEnum(ReserveMovementType)
  movementType: ReserveMovementType;

  @ApiProperty({ example: 1000, description: '0 is allowed for an ADD entry that only records a worker payment' })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerRatePerBrick?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerPaidAmount?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Oldingi oydan qolgan ishchi qarzi' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  workerOldDebt?: number;
}
