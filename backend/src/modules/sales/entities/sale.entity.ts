import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { PaymentType } from '../../../common/enums/payment-type.enum';
import { User } from '../../users/entities/user.entity';

@Entity('sales')
@Index('idx_sales_payment_type', ['paymentType'])
@Index('idx_sales_date', ['date'])
@Index('idx_sales_customer_name', ['customerName'])
@Index('idx_sales_payment_date', ['paymentType', 'date'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'brick_type', type: 'enum', enum: BrickType, default: BrickType.BAKED_BRICK })
  brickType: BrickType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'price_per_brick', type: 'decimal', precision: 12, scale: 2 })
  pricePerBrick: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount: number;

  @Column({ name: 'payment_type', type: 'enum', enum: PaymentType })
  paymentType: PaymentType;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'date' })
  date: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'is_reserve_sale', type: 'boolean', default: false })
  isReserveSale: boolean;

  @Column({ name: 'worker_rate_per_brick', type: 'decimal', precision: 10, scale: 2, nullable: true })
  workerRatePerBrick: number;

  @Column({ name: 'total_worker_cost', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalWorkerCost: number;

  @Column({ name: 'worker_paid_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  workerPaidAmount: number;

  @Column({ name: 'worker_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  workerDebt: number;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
