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

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
