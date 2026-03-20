import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { SchemaService } from './schema.service';

@Controller('schema')
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}

  /** List all modules with summary counts */
  @Get('modules')
  getModules() {
    return this.schemaService.getAllModules().map((mod) => ({
      prefix:         mod.prefix,
      name:           mod.name,
      description:    mod.description,
      tableCount:     mod.tables.length,
      attributeCount: mod.tables.reduce((s, t) => s + t.attributes.length, 0),
    }));
  }

  /** Full detail for a single module (tables + columns) */
  @Get('modules/:prefix')
  getModule(@Param('prefix') prefix: string) {
    const mod = this.schemaService.getModule(prefix.toUpperCase());
    if (!mod) throw new NotFoundException(`Módulo '${prefix}' no encontrado`);

    return {
      prefix:         mod.prefix,
      name:           mod.name,
      description:    mod.description,
      keywords:       mod.keywords,
      tableCount:     mod.tables.length,
      attributeCount: mod.tables.reduce((s, t) => s + t.attributes.length, 0),
      tables: mod.tables.map((t) => ({
        name:           t.name,
        description:    t.description,
        attributeCount: t.attributes.length,
        attributes:     t.attributes.map((a) => ({
          name:   a.name,
          title:  a.title,
          type:   a.type,
          length: a.length,
          dec:    a.dec,
          desc:   a.desc ?? null,
        })),
      })),
    };
  }
}
