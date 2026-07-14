import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Prepayment } from './prepayment.entity';

@Entity('prepayment_deliveries')
export class PrepaymentDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prepayment, (p) => p.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prepayment_id' })
  prepayment: Prepayment;

  @Column({ name: 'prepayment_id', type: 'uuid' })
  prepaymentId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
