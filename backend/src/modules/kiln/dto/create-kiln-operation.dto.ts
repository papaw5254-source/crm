import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { KilnName } from '../../../common/enums/kiln-name.enum';
import { RawBrickSource } from '../../../common/enums/raw-brick-source.enum';

export class CreateKilnOperationDto {
  @ApiProperty({ enum: KilnName, example: KilnName.HUMBUZ_1 })
  @IsEnum(KilnName)
  kilnName: KilnName;

  @ApiPropertyOptional({ example: 5000, description: 'Humbuzga kirgan xom g\'isht soni' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rawBricksEntered?: number = 0;

  @ApiPropertyOptional({ example: 4500, description: 'Humbuzdan chiqqan pishgan g\'isht soni' })
  @IsOptional()
  @IsInt()
  @Min(0)
  bakedBricksOutput?: number = 0;

  @ApiPropertyOptional({ enum: RawBrickSource, description: 'Xom g\'isht manbai: FIELD yoki RESERVE' })
  @ValidateIf((o) => o.rawBricksEntered > 0)
  @IsEnum(RawBrickSource)
  rawBrickSource?: RawBrickSource;

  @ApiPropertyOptional({ example: 'Alisher' })
  @IsOptional()
  @IsString()
  responsibleWorker?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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
}
