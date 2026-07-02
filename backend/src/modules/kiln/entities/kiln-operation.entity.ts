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

  @ManyToOne(() => User, { nullable: true, eager: false })
  createdBy: User;

  @Column({ name: 'created_by_id', nullable: true })
  createdById: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
