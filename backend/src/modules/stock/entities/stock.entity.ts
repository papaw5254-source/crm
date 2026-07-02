import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BrickType } from '../../../common/enums/brick-type.enum';

@Entity('stock')
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({ name: 'brick_type', type: 'enum', enum: BrickType, nullable: true })
  brickType: BrickType;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
