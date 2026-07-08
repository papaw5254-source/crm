import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkerPaymentCategory } from '../../../common/enums/worker-payment-category.enum';
import { User } from '../../users/entities/user.entity';

@Entity('worker_payments')
export class WorkerPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'worker_name' })
  workerName: string;

  @Column({ type: 'enum', enum: WorkerPaymentCategory })
  category: WorkerPaymentCategory;

  @Column({ name: 'debt_from_previous_month', type: 'decimal', precision: 14, scale: 2, default: 0 })
  debtFromPreviousMonth: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'remaining_debt', type: 'decimal', precision: 14, scale: 2, default: 0 })
  remainingDebt: number;

  @Column({ nullable: true })
  month: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'source_type', nullable: true })
  sourceType: string;

  @Column({ name: 'source_id', nullable: true })
  sourceId: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
