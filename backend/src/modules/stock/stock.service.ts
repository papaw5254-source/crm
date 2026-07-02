import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BrickType } from '../../common/enums/brick-type.enum';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockMovement } from './entities/stock-movement.entity';
import { Stock } from './entities/stock.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class StockService implements OnModuleInit {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
  ) {}

  async onModuleInit() {
    await this.ensureStocksExist();
  }

  async ensureStocksExist(): Promise<void> {
    // Migrate any existing record without brickType to BAKED_BRICK
    const untypedStocks = await this.stockRepository
      .createQueryBuilder('s')
      .where('s.brick_type IS NULL')
      .getMany();

    for (const s of untypedStocks) {
      s.brickType = BrickType.BAKED_BRICK;
      if (!s.productName) s.productName = "Pishgan g'isht";
      await this.stockRepository.save(s);
    }

    const bakedCount = await this.stockRepository.count({
      where: { brickType: BrickType.BAKED_BRICK },
    });
    if (bakedCount === 0) {
      await this.stockRepository.save(
        this.stockRepository.create({
          productName: "Pishgan g'isht",
          brickType: BrickType.BAKED_BRICK,
          quantity: 0,
        }),
      );
    }

    const rawCount = await this.stockRepository.count({
      where: { brickType: BrickType.RAW_BRICK },
    });
    if (rawCount === 0) {
      await this.stockRepository.save(
        this.stockRepository.create({
          productName: "Xom g'isht",
          brickType: BrickType.RAW_BRICK,
          quantity: 0,
        }),
      );
    }
  }

  async getAllStocks(): Promise<Stock[]> {
    return this.stockRepository.find();
  }

  async getStock(brickType: BrickType = BrickType.BAKED_BRICK): Promise<Stock> {
    const stock = await this.stockRepository.findOne({ where: { brickType } });
    if (!stock) throw new NotFoundException(`Stock not found for ${brickType}`);
    return stock;
  }

  async increaseStock(
    quantity: number,
    type: StockMovementType,
    reason: string,
    userId: string,
    brickType: BrickType = BrickType.BAKED_BRICK,
  ): Promise<Stock> {
    const stock = await this.getStock(brickType);
    const previousQuantity = stock.quantity;
    stock.quantity += quantity;
    await this.stockRepository.save(stock);
    await this.logMovement(type, quantity, previousQuantity, stock.quantity, reason, userId, brickType);
    return stock;
  }

  async decreaseStock(
    quantity: number,
    type: StockMovementType,
    reason: string,
    userId: string,
    brickType: BrickType = BrickType.BAKED_BRICK,
  ): Promise<Stock> {
    const stock = await this.getStock(brickType);
    if (stock.quantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${stock.quantity}, Requested: ${quantity}`,
      );
    }
    const previousQuantity = stock.quantity;
    stock.quantity -= quantity;
    await this.stockRepository.save(stock);
    await this.logMovement(type, quantity, previousQuantity, stock.quantity, reason, userId, brickType);
    return stock;
  }

  async adjustStock(
    adjustStockDto: AdjustStockDto,
    userId: string,
    brickType: BrickType = BrickType.BAKED_BRICK,
  ): Promise<Stock> {
    const bt = adjustStockDto.brickType || brickType;
    const stock = await this.getStock(bt);
    const previousQuantity = stock.quantity;
    const newQuantity = stock.quantity + adjustStockDto.quantity;

    if (newQuantity < 0) {
      throw new BadRequestException('Stock cannot be negative after adjustment');
    }

    stock.quantity = newQuantity;
    await this.stockRepository.save(stock);

    await this.logMovement(
      StockMovementType.MANUAL_ADJUSTMENT,
      Math.abs(adjustStockDto.quantity),
      previousQuantity,
      newQuantity,
      adjustStockDto.reason || 'Manual adjustment',
      userId,
      bt,
    );

    return stock;
  }

  private async logMovement(
    type: StockMovementType,
    quantity: number,
    previousQuantity: number,
    newQuantity: number,
    reason: string,
    userId: string,
    brickType: BrickType = BrickType.BAKED_BRICK,
  ): Promise<void> {
    const movement = this.stockMovementRepository.create({
      type,
      quantity,
      previousQuantity,
      newQuantity,
      reason,
      createdById: userId,
      brickType,
    });
    await this.stockMovementRepository.save(movement);
  }

  async getMovements(filters?: PaginationDto) {
    const { page = 1, limit = 20, dateFrom, dateTo } = filters || {};
    const skip = (page - 1) * limit;

    const qb = this.stockMovementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.createdBy', 'user')
      .orderBy('movement.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (dateFrom) qb.andWhere('movement.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('movement.createdAt <= :dateTo', { dateTo: dateTo + 'T23:59:59' });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
