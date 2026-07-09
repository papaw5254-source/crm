import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { KilnName } from '../../../common/enums/kiln-name.enum';
import { RawBrickSource } from '../../../common/enums/raw-brick-source.enum';
import { User } from '../../users/entities/user.entity';

@Entity('kiln_operations')
export class KilnOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'kiln_name', type: 'enum', enum: KilnName })
  kilnName: KilnName;

  @Column({ name: 'raw_bricks_entered', type: 'int', default: 0 })
  rawBricksEntered: number;

  @Column({ name: 'baked_bricks_output', type: 'int', default: 0 })
  bakedBricksOutput: number;

  @Column({ name: 'raw_brick_source', type: 'enum', enum: RawBrickSource, nullable: true })
  rawBrickSource: RawBrickSource;

  @Column({ name: 'responsible_worker', nullable: true })
  responsibleWorker: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'worker_rate_per_brick', type: 'decimal', precision: 10, scale: 2, nullable: true })
  workerRatePerBrick: number;

  @Column({ name: 'total_worker_cost', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalWorkerCost: number;

  @Column({ name: 'worker_paid_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  workerPaidAmount: number;

  @Column({ name: 'worker_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  workerDebt: number;

  @Column({ name: 'worker_old_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  workerOldDebt: number;

  @Column({ name: 'raw_worker_rate_per_brick', type: 'decimal', precision: 10, scale: 2, nullable: true })
  rawWorkerRatePerBrick: number;

  @Column({ name: 'raw_worker_total_cost', type: 'decimal', precision: 14, scale: 2, nullable: true })
  rawWorkerTotalCost: number;

  @Column({ name: 'raw_worker_paid_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  rawWorkerPaidAmount: number;

  @Column({ name: 'raw_worker_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  rawWorkerDebt: number;

  @Column({ name: 'baked_worker_rate_per_brick', type: 'decimal', precision: 10, scale: 2, nullable: true })
  bakedWorkerRatePerBrick: number;

  @Column({ name: 'baked_worker_total_cost', type: 'decimal', precision: 14, scale: 2, nullable: true })
  bakedWorkerTotalCost: number;

  @Column({ name: 'baked_worker_paid_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  bakedWorkerPaidAmount: number;

  @Column({ name: 'baked_worker_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  bakedWorkerDebt: number;

  @Column({ name: 'qachigar_rate_per_brick', type: 'decimal', precision: 10, scale: 2, nullable: true })
  qachigarRatePerBrick: number;

  @Column({ name: 'qachigar_total_cost', type: 'decimal', precision: 14, scale: 2, nullable: true })
  qachigarTotalCost: number;

  @Column({ name: 'qachigar_paid_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  qachigarPaidAmount: number;

  @Column({ name: 'qachigar_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  qachigarDebt: number;

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
