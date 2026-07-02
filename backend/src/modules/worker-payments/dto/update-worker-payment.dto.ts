import { PartialType } from '@nestjs/swagger';
import { CreateWorkerPaymentDto } from './create-worker-payment.dto';

export class UpdateWorkerPaymentDto extends PartialType(CreateWorkerPaymentDto) {}
