import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../.env') });

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'brick_factory_crm',
    entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
    synchronize: true,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected successfully');

    const userRepository = dataSource.getRepository('users');
    const stockRepository = dataSource.getRepository('stock');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');

    // Create admin user
    const existingAdmin = await userRepository.findOne({ where: { username: 'admin' } });
    if (!existingAdmin) {
      const adminHash = await bcrypt.hash('Admin123!', rounds);
      const admin = userRepository.create({
        fullName: 'System Administrator',
        username: 'admin',
        phone: '+998901234567',
        passwordHash: adminHash,
        role: 'ADMIN',
        isActive: true,
      });
      await userRepository.save(admin);
      console.log('✅ Admin user created: username=admin, password=Admin123!');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create employee user
    const existingEmployee = await userRepository.findOne({ where: { username: 'employee' } });
    if (!existingEmployee) {
      const employeeHash = await bcrypt.hash('Employee123!', rounds);
      const employee = userRepository.create({
        fullName: 'Factory Employee',
        username: 'employee',
        phone: '+998907654321',
        passwordHash: employeeHash,
        role: 'EMPLOYEE',
        isActive: true,
      });
      await userRepository.save(employee);
      console.log('✅ Employee user created: username=employee, password=Employee123!');
    } else {
      console.log('ℹ️  Employee user already exists');
    }

    // Create stock row
    const existingStock = await stockRepository.findOne({
      where: { productName: "Pishgan g'isht" },
    });
    if (!existingStock) {
      const stock = stockRepository.create({
        productName: "Pishgan g'isht",
        quantity: 0,
      });
      await stockRepository.save(stock);
      console.log("✅ Stock row created: productName=Pishgan g'isht, quantity=0");
    } else {
      console.log('ℹ️  Stock row already exists');
    }

    console.log('\n🎉 Seed completed successfully!\n');
    console.log('='.repeat(50));
    console.log('Admin credentials:');
    console.log('  username: admin');
    console.log('  password: Admin123!');
    console.log('-'.repeat(50));
    console.log('Employee credentials:');
    console.log('  username: employee');
    console.log('  password: Employee123!');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

seed();
