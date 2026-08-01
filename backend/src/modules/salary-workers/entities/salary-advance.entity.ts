import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SalaryWorker } from './salary-worker.entity';

@Entity('salary_advances')
export class SalaryAdvance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No separate scalar workerId column on purpose: a @JoinColumn relation plus
  // a plain @Column mapped to the same physical column are two independent
  // writers to TypeORM, and the (unset) relation side wins on INSERT, silently
  // overwriting an explicitly-set scalar with NULL.
  @ManyToOne(() => SalaryWorker, (worker) => worker.advances, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker: SalaryWorker;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
