import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { PrepaymentStatus } from '../../../common/enums/prepayment-status.enum';
import { PaymentType } from '../../../common/enums/payment-type.enum';
import { User } from '../../users/entities/user.entity';
import { PrepaymentDelivery } from './prepayment-delivery.entity';

@Entity('prepayments')
export class Prepayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  @Column({ name: 'brick_type', type: 'enum', enum: BrickType, default: BrickType.BAKED_BRICK })
  brickType: BrickType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'price_per_brick', type: 'decimal', precision: 12, scale: 2 })
  pricePerBrick: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'delivered_quantity', type: 'int', default: 0 })
  deliveredQuantity: number;

  @Column({ name: 'remaining_quantity', type: 'int' })
  remainingQuantity: number;

  @Column({ name: 'remaining_amount', type: 'decimal', precision: 14, scale: 2 })
  remainingAmount: number;

  @Column({ name: 'status', type: 'enum', enum: PrepaymentStatus, default: PrepaymentStatus.ACTIVE })
  status: PrepaymentStatus;

  @Column({ name: 'payment_type', type: 'enum', enum: PaymentType, nullable: true })
  paymentType: PaymentType;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => PrepaymentDelivery, (d) => d.prepayment)
  deliveries: PrepaymentDelivery[];

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
