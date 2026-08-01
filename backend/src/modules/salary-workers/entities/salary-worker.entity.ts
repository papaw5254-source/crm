import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SalaryAdvance } from './salary-advance.entity';

@Entity('salary_workers')
export class SalaryWorker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  // 'YYYY-MM' - which month this salary allocation is for
  @Column({ type: 'varchar', length: 7 })
  month: string;

  @Column({ name: 'salary_amount', type: 'decimal', precision: 14, scale: 2 })
  salaryAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'remaining_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  remainingAmount: number;

  @Column({ nullable: true })
  notes: string;

  @OneToMany(() => SalaryAdvance, (advance) => advance.worker)
  advances: SalaryAdvance[];

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
