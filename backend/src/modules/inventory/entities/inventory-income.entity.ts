import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { User } from '../../users/entities/user.entity';

@Entity('inventory_incomes')
export class InventoryIncome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'brick_type', type: 'enum', enum: BrickType, default: BrickType.BAKED_BRICK })
  brickType: BrickType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'date' })
  date: string;

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

  @Column({ name: 'kretkach_rate_per_brick', type: 'decimal', precision: 10, scale: 2, nullable: true })
  kretkachRatePerBrick: number;

  @Column({ name: 'total_kretkach_cost', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalKretkachCost: number;

  @Column({ name: 'kretkach_paid_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  kretkachPaidAmount: number;

  @Column({ name: 'kretkach_old_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  kretkachOldDebt: number;

  @Column({ name: 'kretkach_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  kretkachDebt: number;

  @Column({ name: 'eshki_daily_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  eshkiDailyAmount: number;

  @Column({ name: 'eshki_paid_amount', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  eshkiPaidAmount: number;

  @Column({ name: 'eshki_old_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  eshkiOldDebt: number;

  @Column({ name: 'eshki_debt', type: 'decimal', precision: 14, scale: 2, nullable: true, default: 0 })
  eshkiDebt: number;

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
