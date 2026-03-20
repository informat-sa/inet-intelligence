/**
 * Seed script — creates demo data for development/testing
 * Run: cd api && npx ts-node -r tsconfig-paths/register src/scripts/seed.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Tenant } from '../tenants/entities/tenant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UserModulePermission } from '../users/entities/user-module-permission.entity';
import { UserTenantAccess } from '../users/entities/user-tenant-access.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { encryptPassword } from '../common/crypto.util';

const ds = new DataSource({
  type:        'postgres',
  host:        process.env.PG_HOST     ?? 'localhost',
  port:        parseInt(process.env.PG_PORT ?? '5432'),
  database:    process.env.PG_DATABASE ?? 'inet_intelligence',
  username:    process.env.PG_USER     ?? 'postgres',
  password:    process.env.PG_PASSWORD ?? '',
  entities:    [Tenant, User, UserModulePermission, UserTenantAccess, Favorite],
  synchronize: true,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  await ds.initialize();
  console.log('✅ Connected to PostgreSQL');

  const tenantRepo       = ds.getRepository(Tenant);
  const userRepo         = ds.getRepository(User);
  const permRepo         = ds.getRepository(UserModulePermission);
  const accessRepo       = ds.getRepository(UserTenantAccess);

  // ── 1. Primary Demo Tenant ─────────────────────────────────────────────
  let tenant = await tenantRepo.findOne({ where: { slug: 'demo' } });
  if (!tenant) {
    tenant = tenantRepo.create({
      slug:                'demo',
      name:                'Empresa Demo SpA',
      taxId:               '76.000.000-0',
      dbServer:            process.env.DB_SERVER   ?? 'localhost',
      dbPort:              parseInt(process.env.DB_PORT ?? '1433'),
      dbDatabase:          process.env.DB_DATABASE ?? 'INET_STD',
      dbUser:              process.env.DB_USER     ?? 'sa',
      dbPasswordEncrypted: encryptPassword(process.env.DB_PASSWORD ?? ''),
      dbEncrypt:           false,
      dbTrustCert:         true,
      enabledModules:      ['VFA','CCC','ADQ','IMP','EXI','PRO','AFF','REM','CON','SII','PAR','DDI','FIN','GAN','ATE'],
      isActive:            true,
    });
    tenant = await tenantRepo.save(tenant);
    console.log(`✅ Tenant created: ${tenant.name} [${tenant.id}]`);
  } else {
    console.log(`⏩ Tenant already exists: ${tenant.name}`);
  }

  // ── 2. Second Demo Tenant (holding subsidiary — multi-empresa demo) ────
  let tenant2 = await tenantRepo.findOne({ where: { slug: 'holding-demo' } });
  if (!tenant2) {
    tenant2 = tenantRepo.create({
      slug:                'holding-demo',
      name:                'Holding Consolidado SA',
      taxId:               '77.111.222-3',
      dbServer:            process.env.DB_SERVER    ?? 'localhost',
      dbPort:              parseInt(process.env.DB_PORT ?? '1433'),
      dbDatabase:          process.env.DB_DATABASE2 ?? process.env.DB_DATABASE ?? 'INET_STD',
      dbUser:              process.env.DB_USER     ?? 'sa',
      dbPasswordEncrypted: encryptPassword(process.env.DB_PASSWORD ?? ''),
      dbEncrypt:           false,
      dbTrustCert:         true,
      enabledModules:      ['VFA','CCC','EXI','CON','SII','BAN','EGR','FIN'],
      isActive:            true,
    });
    tenant2 = await tenantRepo.save(tenant2);
    console.log(`✅ Tenant created: ${tenant2.name} [${tenant2.id}]`);
  } else {
    console.log(`⏩ Tenant already exists: ${tenant2.name}`);
  }

  // ── 3. Super Admin (Informat staff) ───────────────────────────────────
  const superAdminEmail = 'superadmin@informat.cl';
  if (!await userRepo.findOne({ where: { email: superAdminEmail } })) {
    const user = userRepo.create({
      name:         'Super Admin Informat',
      email:        superAdminEmail,
      passwordHash: await bcrypt.hash('Informat2025!', 12),
      role:         UserRole.SUPER_ADMIN,
      tenantId:     null as any,
      isActive:     true,
    });
    await userRepo.save(user);
    console.log(`✅ Super admin created: ${superAdminEmail}`);
  }

  // ── 4. Demo Admin — has access to BOTH tenants ─────────────────────────
  const adminEmail = 'admin@empresa-demo.cl';
  let adminUser = await userRepo.findOne({ where: { email: adminEmail } });
  if (!adminUser) {
    adminUser = userRepo.create({
      name:         'Sebastián Segura',
      email:        adminEmail,
      passwordHash: await bcrypt.hash('Demo2025!', 12),
      role:         UserRole.ADMIN,
      tenantId:     tenant.id,
      isActive:     true,
    });
    adminUser = await userRepo.save(adminUser);
    console.log(`✅ Admin created: ${adminEmail}`);
  }

  // Grant admin access to the second tenant (holding)
  const existingAccess = await accessRepo.findOne({
    where: { userId: adminUser.id, tenantId: tenant2.id },
  });
  if (!existingAccess) {
    await accessRepo.save(
      accessRepo.create({
        userId:         adminUser.id,
        tenantId:       tenant2.id,
        role:           'admin',
        allowedModules: null,  // inherit tenant defaults
        isActive:       true,
      }),
    );
    console.log(`✅ Multi-empresa access granted: ${adminEmail} → ${tenant2.name}`);
  }

  // ── 5. Demo User (limited modules — single company) ───────────────────
  const userEmail = 'encargado.cobranza@empresa-demo.cl';
  let demoUser = await userRepo.findOne({ where: { email: userEmail } });
  if (!demoUser) {
    demoUser = userRepo.create({
      name:         'Ana González',
      email:        userEmail,
      passwordHash: await bcrypt.hash('Demo2025!', 12),
      role:         UserRole.USER,
      tenantId:     tenant.id,
      isActive:     true,
    });
    demoUser = await userRepo.save(demoUser);

    const perms = ['CCC', 'VFA'].map((p) =>
      permRepo.create({ userId: demoUser!.id, modulePrefix: p, enabled: true }),
    );
    await permRepo.save(perms);
    console.log(`✅ User created: ${userEmail} [modules: CCC, VFA]`);
  }

  await ds.destroy();
  console.log('\n🎉 Seed complete! Credentials:');
  console.log(`  Super Admin: ${superAdminEmail} / Informat2025!`);
  console.log(`  Admin:       ${adminEmail} / Demo2025! (2 empresas: Demo SpA + Holding SA)`);
  console.log(`  User:        ${userEmail} / Demo2025! (modules: CCC, VFA only)`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
