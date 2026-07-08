import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { BrickType } from '../../common/enums/brick-type.enum';
import { PrepaymentStatus } from '../../common/enums/prepayment-status.enum';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { StockService } from '../stock/stock.service';
import { CreatePrepaymentDeliveryDto } from './dto/create-prepayment-delivery.dto';
import { CreatePrepaymentDto } from './dto/create-prepayment.dto';
import { UpdatePrepaymentDto } from './dto/update-prepayment.dto';
import { PrepaymentDelivery } from './entities/prepayment-delivery.entity';
import { Prepayment } from './entities/prepayment.entity';

@Injectable()
export class PrepaymentsService {
  constructor(
    @InjectRepository(Prepayment)
    private readonly prepaymentRepository: Repository<Prepayment>,
    @InjectRepository(PrepaymentDelivery)
    private readonly deliveryRepository: Repository<PrepaymentDelivery>,
    private readonly stockService: StockService,
  ) {}

  async create(dto: CreatePrepaymentDto, userId: string): Promise<Prepayment> {
    const brickType = dto.brickType || BrickType.BAKED_BRICK;
    const totalAmount = Number((dto.quantity * dto.pricePerBrick).toFixed(2));
    const remainingAmount = totalAmount - Number(dto.paidAmount);

    const prepayment = this.prepaymentRepository.create({
      ...dto,
      brickType,
      totalAmount,
      remainingQuantity: dto.quantity,
      remainingAmount: remainingAmount < 0 ? 0 : remainingAmount,
      deliveredQuantity: 0,
      status: PrepaymentStatus.ACTIVE,
      createdById: userId,
    });
    return this.prepaymentRepository.save(prepayment);
  }

  async findAll(paginationDto: PaginationDto & { status?: PrepaymentStatus; brickType?: BrickType }) {
    const { page = 1, limit = 20, search, dateFrom, dateTo, status, brickType } = paginationDto;
    const skip = (page - 1) * limit;

    const qb = this.prepaymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.createdBy', 'user')
      .leftJoinAndSelect('p.deliveries', 'deliveries')
      .orderBy('p.date', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .addOrderBy('deliveries.date', 'DESC')
      .skip(skip)
      .take(limit);

    if (search) qb.andWhere('p.customerName ILIKE :s OR p.customerPhone ILIKE :s', { s: `%${search}%` });
    if (dateFrom) qb.andWhere('p.date >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('p.date <= :dateTo', { dateTo });
    if (status) qb.andWhere('p.status = :status', { status });
    if (brickType) qb.andWhere('p.brickType = :brickType', { brickType });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Prepayment> {
    const p = await this.prepaymentRepository.findOne({
      where: { id },
      relations: ['createdBy', 'deliveries'],
    });
    if (!p) throw new NotFoundException(`Prepayment ${id} not found`);
    return p;
  }

  async update(id: string, dto: UpdatePrepaymentDto, userId: string): Promise<Prepayment> {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    return this.prepaymentRepository.save(p);
  }

  async remove(id: string): Promise<void> {
    const p = await this.findOne(id);
    if (p.deliveredQuantity > 0) {
      await this.stockService.increaseStock(
        p.deliveredQuantity,
        StockMovementType.SALE_CANCEL,
        `Zalog o'chirildi, yetkazilgan g'isht qaytarildi (id: ${id})`,
        p.createdById,
        p.brickType,
      );
    }
    await this.deliveryRepository.delete({ prepaymentId: id });
    await this.prepaymentRepository.remove(p);
  }

  async deliver(id: string, dto: CreatePrepaymentDeliveryDto, userId: string): Promise<PrepaymentDelivery> {
    const prepayment = await this.findOne(id);

    if (prepayment.status !== PrepaymentStatus.ACTIVE) {
      throw new BadRequestException('Prepayment is not active');
    }
    if (dto.quantity > prepayment.remainingQuantity) {
      throw new BadRequestException(
        `Delivery quantity (${dto.quantity}) exceeds remaining (${prepayment.remainingQuantity})`,
      );
    }

    await this.stockService.decreaseStock(
      dto.quantity,
      StockMovementType.PREPAYMENT_DELIVERY,
      `Zalog yetkazildi: ${prepayment.customerName}`,
      userId,
      prepayment.brickType,
    );

    const delivery = this.deliveryRepository.create({
      ...dto,
      prepaymentId: id,
      createdById: userId,
    });
    await this.deliveryRepository.save(delivery);

    prepayment.deliveredQuantity += dto.quantity;
    prepayment.remainingQuantity -= dto.quantity;
    const deliveredAmount = prepayment.deliveredQuantity * Number(prepayment.pricePerBrick);
    prepayment.remainingAmount = Math.max(0, Number(prepayment.totalAmount) - deliveredAmount);
    if (prepayment.remainingQuantity === 0) {
      prepayment.status = PrepaymentStatus.COMPLETED;
    }
    await this.prepaymentRepository.save(prepayment);

    return delivery;
  }

  async getDeliveries(id: string, paginationDto: PaginationDto) {
    await this.findOne(id);
    const { page = 1, limit = 20 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.deliveryRepository.findAndCount({
      where: { prepaymentId: id },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
