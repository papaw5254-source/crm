import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { WorkerPaymentCategory } from '../../../common/enums/worker-payment-category.enum';

export class WorkerPaymentQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(WorkerPaymentCategory)
  category?: WorkerPaymentCategory;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  debtOnly?: string;
}
