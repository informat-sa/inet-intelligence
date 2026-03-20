import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean } from 'class-validator';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class CreateTenantDto {
  @IsString() slug: string;
  @IsString() name: string;
  @IsOptional() @IsString() taxId?: string;
  @IsString() dbServer: string;
  @IsOptional() @IsNumber() dbPort?: number;
  @IsString() dbDatabase: string;
  @IsString() dbUser: string;
  @IsString() dbPassword: string;
  @IsOptional() @IsBoolean() dbEncrypt?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) enabledModules?: string[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findByIdOrFail(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateTenantDto>) {
    return this.tenantsService.update(id, dto as any);
  }

  @Post(':id/test-connection')
  testConnection(@Param('id') id: string) {
    return this.tenantsService.testConnection(id);
  }
}
