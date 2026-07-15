import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Debtor } from './debtor.entity';

@Entity('debt_payments')
export class DebtPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // debtorId is intentionally NOT also declared as a separate @Column: TypeORM
  // treats a @JoinColumn relation and a plain @Column mapped to the same
  // physical column as two independent writers, and the (unset) relation
  // side wins on INSERT, silently writing NULL over an explicitly-set scalar.
  @ManyToOne(() => Debtor, (debtor) => debtor.payments, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'debtor_id' })
  debtor: Debtor;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'date' })
  date: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
