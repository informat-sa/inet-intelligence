import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as sql from 'mssql';
import { Tenant } from './entities/tenant.entity';
import { encryptPassword, decryptPassword } from '../common/crypto.util';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<Tenant> {
    const tenant = await this.findById(id);
    if (!tenant) throw new NotFoundException(`Tenant ${id} no encontrado`);
    return tenant;
  }

  async create(data: {
    slug: string;
    name: string;
    taxId?: string;
    dbServer: string;
    dbPort?: number;
    dbDatabase: string;
    dbUser: string;
    dbPassword: string;
    dbEncrypt?: boolean;
    enabledModules?: string[];
  }): Promise<Tenant> {
    const tenant = this.tenantRepo.create({
      slug:               data.slug,
      name:               data.name,
      taxId:              data.taxId,
      dbServer:           data.dbServer,
      dbPort:             data.dbPort ?? 1433,
      dbDatabase:         data.dbDatabase,
      dbUser:             data.dbUser,
      dbPasswordEncrypted: encryptPassword(data.dbPassword),
      dbEncrypt:          data.dbEncrypt ?? false,
      enabledModules:     data.enabledModules ?? ['VFA','CCC','ADQ','EXI','PRO','REM','CON','SII'],
    });
    return this.tenantRepo.save(tenant);
  }

  async update(id: string, data: Partial<{
    name: string;
    taxId: string;
    dbServer: string;
    dbPort: number;
    dbDatabase: string;
    dbUser: string;
    dbPassword: string;
    dbEncrypt: boolean;
    enabledModules: string[];
    isActive: boolean;
  }>): Promise<Tenant> {
    const tenant = await this.findByIdOrFail(id);
    const updateData: Partial<Tenant> = { ...data } as any;
    if (data.dbPassword) {
      updateData.dbPasswordEncrypted = encryptPassword(data.dbPassword);
      delete (updateData as any).dbPassword;
    }
    await this.tenantRepo.update(id, updateData);
    return this.findByIdOrFail(id);
  }

  /** Test SQL Server connectivity for a tenant */
  async testConnection(tenantId: string): Promise<{ success: boolean; message: string; ms?: number }> {
    const tenant = await this.findByIdOrFail(tenantId);
    const start = Date.now();
    try {
      const password = decryptPassword(tenant.dbPasswordEncrypted);
      const pool = await sql.connect({
        server:   tenant.dbServer,
        database: tenant.dbDatabase,
        user:     tenant.dbUser,
        password,
        port:     tenant.dbPort,
        options: {
          encrypt: tenant.dbEncrypt,
          trustServerCertificate: tenant.dbTrustCert,
          connectTimeout: 10000,
        },
        pool: { max: 1, min: 0 },
      });
      await pool.request().query('SELECT 1 AS ok');
      await pool.close();
      return { success: true, message: 'Conexión exitosa', ms: Date.now() - start };
    } catch (err: any) {
      return { success: false, message: err.message ?? 'Error de conexión' };
    }
  }

  /** Return plain-text password for DatabaseService pool creation */
  getDecryptedPassword(tenant: Tenant): string {
    return decryptPassword(tenant.dbPasswordEncrypted);
  }
}
