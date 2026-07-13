import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DebtPayment } from './debt-payment.entity';

@Entity('debtors')
export class Debtor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'total_debt', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalDebt: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'remaining_debt', type: 'decimal', precision: 14, scale: 2, default: 0 })
  remainingDebt: number;

  @Column({ name: 'is_paid', default: false })
  isPaid: boolean;

  @Column({ nullable: true })
  notes: string;

  @Column({ name: 'last_debt_date', type: 'date', nullable: true })
  lastDebtDate: string;

  @OneToMany(() => DebtPayment, (payment) => payment.debtor)
  payments: DebtPayment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
