import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BrickType } from '../../../common/enums/brick-type.enum';
import { ReserveMovementType } from '../../../common/enums/reserve-movement-type.enum';
import { User } from '../../users/entities/user.entity';

@Entity('reserve_movements')
export class ReserveMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'brick_type', type: 'enum', enum: BrickType })
  brickType: BrickType;

  @Column({ name: 'movement_type', type: 'enum', enum: ReserveMovementType })
  movementType: ReserveMovementType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'previous_quantity', type: 'int', default: 0 })
  previousQuantity: number;

  @Column({ name: 'new_quantity', type: 'int', default: 0 })
  newQuantity: number;

  @Column({ nullable: true })
  reason: string;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

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

  @Column({ type: 'date' })
  date: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
