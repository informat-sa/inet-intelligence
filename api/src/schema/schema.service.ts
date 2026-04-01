import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Attribute {
  id: string;
  name: string;
  title: string;
  type: string;
  length: number;
  dec: number;
  prefix: string;
  desc?: string;
}

export interface SchemaModule {
  prefix: string;
  name: string;
  description: string;
  tables: SchemaTable[];
  keywords: string[];
}

export interface SchemaTable {
  name: string;
  description: string;
  attributes: Attribute[];
}

// Human-readable module definitions
const MODULE_META: Record<string, { name: string; description: string; keywords: string[] }> = {
  VFA: { name: 'Ventas y Facturación', description: 'Órdenes de venta, facturas, boletas, notas de crédito/débito, clientes, listas de precios',
    keywords: ['ventas', 'factura', 'boleta', 'venta', 'cliente', 'nota de crédito', 'nota de débito', 'ingreso', 'precio', 'descuento', 'cobro', 'guía', 'documentos'] },
  CCC: { name: 'Cuentas por Cobrar', description: 'Cartera de clientes, cuentas corrientes, cobranzas, vencimientos, morosidad',
    keywords: ['deuda', 'cobrar', 'moroso', 'cartera', 'vencida', 'vencimiento', 'pendiente pago', 'cuentas corrientes', 'cobranza'] },
  ADQ: { name: 'Adquisiciones y Compras', description: 'Órdenes de compra, cotizaciones, proveedores, recepciones de mercadería',
    keywords: ['compra', 'proveedor', 'orden de compra', 'cotización', 'recepción', 'adquisición', 'abastecimiento'] },
  IMP: { name: 'Importaciones', description: 'Carpetas de importación, gastos de internación, pólizas, derechos aduaneros, almacenes particulares',
    keywords: ['importación', 'internación', 'aduanero', 'derecho', 'carpeta', 'embarque', 'flete', 'póliza', 'seguro'] },
  EXI: { name: 'Existencias e Inventario', description: 'Control de stock, bodegas, movimientos, traspasos, ajustes de inventario, valorización',
    keywords: ['stock', 'inventario', 'bodega', 'existencia', 'movimiento', 'traspaso', 'saldo', 'unidades', 'mínimo', 'sin movimiento'] },
  PRO: { name: 'Producción y Maestro de Artículos', description: 'Órdenes de producción, fórmulas, máquinas, costos de producción, maestro de productos y proveedores',
    keywords: ['producción', 'orden producción', 'fórmula', 'máquina', 'producto', 'artículo', 'ítem', 'sku', 'fabricar', 'fabricación', 'proceso productivo', 'costo producción', 'hoja control', 'dotación', 'turno'] },
  AFF: { name: 'Activo Fijo', description: 'Bienes, depreciación, incorporaciones, bajas, traslados, revaluaciones',
    keywords: ['activo fijo', 'bien', 'depreciación', 'incorporación', 'baja', 'traslado', 'valor libro', 'valor residual'] },
  REM: { name: 'Remuneraciones y RRHH', description: 'Liquidación de sueldos, haberes, descuentos, AFP, ISAPRE, finiquitos, vacaciones',
    keywords: ['remuneración', 'sueldo', 'trabajador', 'empleado', 'afp', 'isapre', 'liquidación', 'finiquito', 'vacaciones', 'horas', 'turno'] },
  CON: { name: 'Contabilidad General', description: 'Plan de cuentas, asientos, centros de costo, conciliación bancaria, balance, resultado',
    keywords: ['contabilidad', 'asiento', 'cuenta', 'balance', 'resultado', 'centro de costo', 'conciliación', 'cierre', 'mayor', 'diario'] },
  SII: { name: 'SII y Documentos Tributarios', description: 'DTE, facturas electrónicas, libro de compras/ventas, IVA, F29, F50',
    keywords: ['sii', 'dte', 'factura electrónica', 'iva', 'libro de compras', 'libro de ventas', 'tributario', 'f29', 'declaración'] },
  PAR: { name: 'Parámetros del Sistema', description: 'Configuración global, monedas, tasas, tablas maestras, sucursales',
    keywords: ['parámetro', 'configuración', 'moneda', 'tasa', 'tipo de cambio', 'sucursal', 'tabla maestra'] },
  DDI: { name: 'Distribución y Despacho', description: 'Guías de despacho, rutas, transportistas, pedidos, entregas',
    keywords: ['despacho', 'guía', 'ruta', 'transporte', 'entrega', 'pedido', 'distribución', 'driver'] },
  FIN: { name: 'Finanzas y Tesorería', description: 'Flujo de caja, inversiones, préstamos, instrumentos financieros',
    keywords: ['tesorería', 'flujo de caja', 'inversión', 'préstamo', 'financiero', 'banco', 'caja'] },
  GAN: { name: 'Granos (Vertical Molinero)', description: 'Módulo vertical para empresas molineras: granos, trigo, romanajes, saldos',
    keywords: ['grano', 'trigo', 'molino', 'harina', 'romanaje', 'cereal', 'molinero'] },
  ATE: { name: 'Atención a Clientes', description: 'Tickets, solicitudes de servicio, contratos de mantención, SLA',
    keywords: ['atención', 'ticket', 'soporte', 'mantención', 'servicio', 'reclamo'] },
  BAN: { name: 'Bancos', description: 'Cuentas bancarias, movimientos bancarios, saldos, cheques, transferencias, conciliación',
    keywords: ['banco', 'cuenta bancaria', 'cheque', 'transferencia', 'saldo banco', 'movimiento banco', 'cartola', 'conciliación bancaria', 'depósito'] },
  EGR: { name: 'Egresos y Pagos', description: 'Egresos de caja, pagos a proveedores, formas de pago, autorización de gastos, análisis de egresos',
    keywords: ['egreso', 'pago proveedor', 'gasto', 'egreso directo', 'forma de pago', 'autorización pago', 'cuentas pagar', 'pago remun'] },
  COT: { name: 'Cotizaciones', description: 'Cotizaciones de proveedores, solicitudes de cotización, comparación de precios',
    keywords: ['cotización', 'cotizar', 'solicitud cotización', 'presupuesto proveedor', 'comparación precios', 'oferta proveedor'] },
  PED: { name: 'Pedidos', description: 'Pedidos de clientes, solicitudes, seguimiento de pedidos pendientes, órdenes no entregadas',
    keywords: ['pedido', 'solicitud pedido', 'pedido cliente', 'orden pendiente', 'pedido no entregado', 'seguimiento pedido', 'pedidos atendidos'] },
};

// ── Real SQL Server column definitions (verified against live INET DB) ────────
// These override/supplement the GeneXus KB data, which uses internal attribute
// names that don't always match the actual SQL Server column names.
// Format follows SchemaTable interface: { name, description, attributes[] }
const REAL_SQL_TABLES: Record<string, Array<{ name: string; description: string; attributes: Attribute[] }>> = {

  // ── CCC — Cuentas por Cobrar ──────────────────────────────────────────────
  CCC: [
    {
      name: 'CCCONCLI',
      description: 'Saldo consolidado por cliente',
      attributes: [
        { id: 'r_cccclicod', name: 'CCCCLICOD', title: 'RUT cliente',     type: 'string', length: 12, dec: 0, prefix: 'CCC' },
        { id: 'r_cccclinom', name: 'CCCCLINOM', title: 'Nombre cliente',   type: 'string', length: 40, dec: 0, prefix: 'CCC' },
        { id: 'r_cccdeutot', name: 'CCCDEUTOT', title: 'Deuda total',      type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_cccporven', name: 'CCCPORVEN', title: 'Deuda vencida',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_cccclicre', name: 'CCCCLICRE', title: 'Crédito asignado', type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
      ],
    },
    {
      name: 'CCCEGRD',
      description: 'Cartera de documentos por cobrar',
      attributes: [
        { id: 'r_cccanacod', name: 'CCCANACOD', title: 'RUT cliente',        type: 'string', length: 12, dec: 0, prefix: 'CCC' },
        { id: 'r_cccsaldoc', name: 'CCCSALDOC', title: 'Saldo documento',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_cccfchvto', name: 'CCCFCHVTO', title: 'Fecha vencimiento',  type: 'string', length:  8, dec: 0, prefix: 'CCC' },
        { id: 'r_cccdocfch', name: 'CCCDOCFCH', title: 'Fecha documento',    type: 'string', length:  8, dec: 0, prefix: 'CCC' },
        { id: 'r_cccplacod', name: 'CCCPLACOD', title: 'Plan de cuentas',    type: 'string', length: 10, dec: 0, prefix: 'CCC' },
        { id: 'r_cccarecod', name: 'CCCARECOD', title: 'Área cobrador',      type: 'string', length:  4, dec: 0, prefix: 'CCC' },
        { id: 'r_ccccomtip', name: 'CCCCOMTIP', title: 'Tipo comprobante',   type: 'string', length:  3, dec: 0, prefix: 'CCC' },
        { id: 'r_ccccomnum', name: 'CCCCOMNUM', title: 'Nro comprobante',    type: 'n',      length: 10, dec: 0, prefix: 'CCC' },
        { id: 'r_ccccomglo', name: 'CCCCOMGLO', title: 'Glosa comprobante',  type: 'string', length: 60, dec: 0, prefix: 'CCC' },
        { id: 'r_cccanomes', name: 'CCCANOMES', title: 'Período YYYYMM',     type: 'string', length:  6, dec: 0, prefix: 'CCC' },
        { id: 'r_cccsesnom', name: 'CCCEstNom', title: 'Estado',             type: 'string', length: 20, dec: 0, prefix: 'CCC' },
        { id: 'r_cccglocom', name: 'CCCGloCom', title: 'Glosa comercial',    type: 'string', length: 60, dec: 0, prefix: 'CCC' },
      ],
    },
    {
      name: 'CCCHISD',
      description: 'Historial de movimientos cobranza',
      attributes: [
        { id: 'r_hcccclicod', name: 'HccCliCod', title: 'RUT cliente',      type: 'string', length: 12, dec: 0, prefix: 'CCC' },
        { id: 'r_hccval',     name: 'HccVal',     title: 'Valor',            type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_hccfchven',  name: 'HccFchVen',  title: 'Fecha vencimiento',type: 'string', length:  8, dec: 0, prefix: 'CCC' },
        { id: 'r_hccfchdoc',  name: 'HccFchDoc',  title: 'Fecha documento',  type: 'string', length:  8, dec: 0, prefix: 'CCC' },
        { id: 'r_hccnumdoc',  name: 'HccNumDoc',  title: 'Nro documento',    type: 'n',      length: 10, dec: 0, prefix: 'CCC' },
        { id: 'r_hccsen',     name: 'HccSen',     title: 'Sentido D/H',      type: 'string', length:  1, dec: 0, prefix: 'CCC' },
        { id: 'r_hccglo',     name: 'HccGlo',     title: 'Glosa',            type: 'string', length: 60, dec: 0, prefix: 'CCC' },
        { id: 'r_hcccbtame',  name: 'HccCbtAMe',  title: 'Período asiento',  type: 'string', length:  6, dec: 0, prefix: 'CCC' },
      ],
    },
    {
      name: 'CCCMOL',
      description: 'Movimientos libro auxiliar cobranza',
      attributes: [
        { id: 'r_mccanacod', name: 'MccAnaCod', title: 'RUT cliente',        type: 'string', length: 12, dec: 0, prefix: 'CCC' },
        { id: 'r_mccdeb',    name: 'MccDeb',    title: 'Débito',             type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_mcchab',    name: 'MccHab',    title: 'Haber',              type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_mccanomes', name: 'MccAnoMes', title: 'Período YYYYMM',     type: 'string', length:  6, dec: 0, prefix: 'CCC' },
        { id: 'r_mcccbtnum', name: 'MccCbtNum', title: 'Nro comprobante',    type: 'n',      length: 10, dec: 0, prefix: 'CCC' },
        { id: 'r_placod',    name: 'PlaCod',    title: 'Código plan cuentas',type: 'string', length: 10, dec: 0, prefix: 'CCC' },
        { id: 'r_mccnom',    name: 'MccNom',    title: 'Nombre',             type: 'string', length: 40, dec: 0, prefix: 'CCC' },
      ],
    },
    {
      name: 'CCCMOV',
      description: 'Cabecera de comprobantes cobranza',
      attributes: [
        { id: 'r_mcccbttip', name: 'MCCCBTTIP', title: 'Tipo comprobante',  type: 'string', length:  3, dec: 0, prefix: 'CCC' },
        { id: 'r_mccsuccod', name: 'MCCSUCCOD', title: 'Sucursal',          type: 'string', length:  4, dec: 0, prefix: 'CCC' },
        { id: 'r_mccanomes2',name: 'MCCANOMES', title: 'Período YYYYMM',    type: 'string', length:  6, dec: 0, prefix: 'CCC' },
        { id: 'r_mcccbtnum2',name: 'MCCCBTNUM', title: 'Nro comprobante',   type: 'n',      length: 10, dec: 0, prefix: 'CCC' },
        { id: 'r_mcccbtfch', name: 'MCCCBTFCH', title: 'Fecha comprobante', type: 'string', length:  8, dec: 0, prefix: 'CCC' },
        { id: 'r_mccglo',    name: 'MCCGLO',    title: 'Glosa',             type: 'string', length: 60, dec: 0, prefix: 'CCC' },
        { id: 'r_mccestcnf', name: 'MccEstCnf', title: 'Confirmado S/N',    type: 'string', length:  1, dec: 0, prefix: 'CCC' },
      ],
    },
    {
      name: 'CCCSAL',
      description: 'Saldos mensuales plan de cuentas CCC',
      attributes: [
        { id: 'r_sacplacod',  name: 'SACPLACOD',  title: 'Plan de cuentas', type: 'string', length: 10, dec: 0, prefix: 'CCC' },
        { id: 'r_sacsalini',  name: 'SACSALINI',  title: 'Saldo inicial',   type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar001',  name: 'SACCAR001',  title: 'Cargos enero',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar002',  name: 'SACCAR002',  title: 'Cargos febrero',  type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar003',  name: 'SACCAR003',  title: 'Cargos marzo',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar004',  name: 'SACCAR004',  title: 'Cargos abril',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar005',  name: 'SACCAR005',  title: 'Cargos mayo',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar006',  name: 'SACCAR006',  title: 'Cargos junio',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar007',  name: 'SACCAR007',  title: 'Cargos julio',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar008',  name: 'SACCAR008',  title: 'Cargos agosto',   type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar009',  name: 'SACCAR009',  title: 'Cargos sept.',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar010',  name: 'SACCAR010',  title: 'Cargos oct.',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar011',  name: 'SACCAR011',  title: 'Cargos nov.',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_saccar012',  name: 'SACCAR012',  title: 'Cargos dic.',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo001',  name: 'SACABO001',  title: 'Abonos enero',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo002',  name: 'SACABO002',  title: 'Abonos febrero',  type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo003',  name: 'SACABO003',  title: 'Abonos marzo',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo004',  name: 'SACABO004',  title: 'Abonos abril',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo005',  name: 'SACABO005',  title: 'Abonos mayo',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo006',  name: 'SACABO006',  title: 'Abonos junio',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo007',  name: 'SACABO007',  title: 'Abonos julio',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo008',  name: 'SACABO008',  title: 'Abonos agosto',   type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo009',  name: 'SACABO009',  title: 'Abonos sept.',    type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo010',  name: 'SACABO010',  title: 'Abonos oct.',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo011',  name: 'SACABO011',  title: 'Abonos nov.',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
        { id: 'r_sacabo012',  name: 'SACABO012',  title: 'Abonos dic.',     type: 'n',      length: 15, dec: 2, prefix: 'CCC' },
      ],
    },
    {
      name: 'CCCENVCO',
      description: 'Gestión de cobranza enviada por cliente',
      attributes: [
        { id: 'r_ccccodcli', name: 'CCCCODCLI', title: 'RUT cliente',    type: 'string', length: 12, dec: 0, prefix: 'CCC' },
        { id: 'r_cccnomcli', name: 'CCCNOMCLI', title: 'Nombre cliente', type: 'string', length: 40, dec: 0, prefix: 'CCC' },
        { id: 'r_cccclitip', name: 'CCCCLITIP', title: 'Tipo cliente',   type: 'string', length:  3, dec: 0, prefix: 'CCC' },
        { id: 'r_cccfecdoc', name: 'CCCFECDOC', title: 'Fecha documento',type: 'string', length:  8, dec: 0, prefix: 'CCC' },
        { id: 'r_cccest',    name: 'CCCEST',    title: 'Estado',         type: 'string', length:  1, dec: 0, prefix: 'CCC' },
        { id: 'r_ccccobnom', name: 'CCCCOBNOM', title: 'Cobrador',       type: 'string', length: 40, dec: 0, prefix: 'CCC' },
        { id: 'r_cccvennom', name: 'CCCVENNOM', title: 'Vendedor',       type: 'string', length: 40, dec: 0, prefix: 'CCC' },
      ],
    },
  ],

  // ── SII — Documentos Tributarios Electrónicos ────────────────────────────
  SII: [
    {
      name: 'SIIVEN',
      description: 'Libro de ventas SII',
      attributes: [
        { id: 'r_lvatenum', name: 'LvAteNum', title: 'Folio',              type: 'n',      length: 10, dec: 0, prefix: 'SII' },
        { id: 'r_lvdoccod', name: 'LvDocCod', title: 'Tipo documento',     type: 'string', length:  3, dec: 0, prefix: 'SII' },
        { id: 'r_lvfchdoc', name: 'LvFchDoc', title: 'Fecha documento',    type: 'string', length:  8, dec: 0, prefix: 'SII' },
        { id: 'r_lvrutcli', name: 'LvRutCli', title: 'RUT cliente',        type: 'string', length: 12, dec: 0, prefix: 'SII' },
        { id: 'r_lvrznsos', name: 'LvRznSoc', title: 'Razón social',       type: 'string', length: 60, dec: 0, prefix: 'SII' },
        { id: 'r_lvneto',   name: 'LvNeto',   title: 'Monto neto',         type: 'n',      length: 15, dec: 2, prefix: 'SII' },
        { id: 'r_lviva',    name: 'LvIva',    title: 'IVA',                type: 'n',      length: 15, dec: 2, prefix: 'SII' },
        { id: 'r_lvtotal',  name: 'LVtotal',  title: 'Total documento',    type: 'n',      length: 15, dec: 2, prefix: 'SII' },
        { id: 'r_lvestado', name: 'LvEstado', title: 'Estado DTE',         type: 'string', length:  2, dec: 0, prefix: 'SII' },
        { id: 'r_lvsuccod', name: 'LvSucCod', title: 'Sucursal',           type: 'string', length:  4, dec: 0, prefix: 'SII' },
      ],
    },
    {
      name: 'SIIVEND',
      description: 'Detalle libro de ventas SII (por tipo de impuesto)',
      attributes: [
        { id: 'r_lvcodsii', name: 'LvCodSii', title: 'Código impuesto SII', type: 'string', length:  4, dec: 0, prefix: 'SII' },
        { id: 'r_lvvalor',  name: 'LvValor',  title: 'Valor',               type: 'n',      length: 15, dec: 2, prefix: 'SII' },
        { id: 'r_lvtasimp', name: 'LvTasImp', title: 'Tasa impuesto %',     type: 'n',      length:  5, dec: 2, prefix: 'SII' },
      ],
    },
    {
      name: 'SIIPREFA',
      description: 'DTE cabecera — facturas/boletas electrónicas emitidas',
      attributes: [
        { id: 'r_siiprvcod',  name: 'SIIPRVCOD',  title: 'RUT proveedor/emisor', type: 'string', length: 12, dec: 0, prefix: 'SII' },
        { id: 'r_siifactip',  name: 'SIIFACTIP',  title: 'Tipo documento',       type: 'string', length:  3, dec: 0, prefix: 'SII' },
        { id: 'r_siifacnum',  name: 'SIIFACNUM',  title: 'Número DTE',           type: 'n',      length: 10, dec: 0, prefix: 'SII' },
        { id: 'r_siifacfche', name: 'SIIFACFCHE', title: 'Fecha emisión',        type: 'string', length:  8, dec: 0, prefix: 'SII' },
        { id: 'r_siifacest',  name: 'SIIFACEST',  title: 'Estado DTE',           type: 'string', length:  2, dec: 0, prefix: 'SII' },
      ],
    },
    {
      name: 'SIIPREF2',
      description: 'DTE detalle — líneas de productos/servicios',
      attributes: [
        { id: 'r_siifacprdc', name: 'SIIFACPRDC', title: 'Código producto', type: 'string', length: 16, dec: 0, prefix: 'SII' },
        { id: 'r_siifacprdn', name: 'SIIFACPRDN', title: 'Nombre producto', type: 'string', length: 80, dec: 0, prefix: 'SII' },
        { id: 'r_siifacpre',  name: 'SIIFACPRE',  title: 'Precio unitario', type: 'n',      length: 15, dec: 2, prefix: 'SII' },
        { id: 'r_siifaccan',  name: 'SIIFACCAN',  title: 'Cantidad',        type: 'n',      length: 12, dec: 3, prefix: 'SII' },
        { id: 'r_siitotlin',  name: 'SIITOTLIN',  title: 'Total línea',     type: 'n',      length: 15, dec: 2, prefix: 'SII' },
      ],
    },
    {
      name: 'SIIPAR',
      description: 'Parámetros SII empresa (RUT, resolución, etc.)',
      attributes: [
        { id: 'r_siiparut',  name: 'SIIPARUT',  title: 'RUT empresa',    type: 'string', length: 12, dec: 0, prefix: 'SII' },
        { id: 'r_siiparnom', name: 'SIIPARNOM', title: 'Nombre empresa', type: 'string', length: 60, dec: 0, prefix: 'SII' },
      ],
    },
  ],

  // ── CON — Contabilidad ────────────────────────────────────────────────────
  // Schema completo verificado por equipo Informat (Verónica, Bernardo) 2026-04-01
  // Tablas maestras compartidas incluidas: PLACUED, ARENEG, CENCOS, ITEGAS, FLUEFE, EJERCIC*
  CON: [
    {
      name: 'ARENEG',
      description: 'Áreas de negocio — clasificación de cuentas y movimientos por área',
      attributes: [
        { id: 'r_arecod', name: 'AreCod', title: 'Código área de negocio (PK)',     type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_arenom', name: 'AreNom', title: 'Nombre área de negocio',          type: 'string', length: 30, dec: 0, prefix: 'CON' },
        { id: 'r_areest', name: 'AreEst', title: 'Estado: 0=Activo, 1=Inactivo',   type: 'n',      length:  1, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'CONSCE',
      description: 'Secciones de centros de costo — agrupación de centros de costo',
      attributes: [
        { id: 'r_consecod', name: 'ConSeCod', title: 'Código sección C.Costo (PK)', type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_consenom', name: 'ConSeNom', title: 'Nombre sección C.Costo',      type: 'string', length: 30, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'CONSCI',
      description: 'Secciones de conceptos de gasto e ingreso — agrupación de ítems de gasto',
      attributes: [
        { id: 'r_consicod', name: 'ConSiCod', title: 'Código sección concepto (PK)', type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_consinom', name: 'ConSiNom', title: 'Nombre sección concepto',      type: 'string', length: 30, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'CENCOS',
      description: 'Centros de costo — unidades de análisis de costos e ingresos',
      attributes: [
        { id: 'r_cencod',    name: 'CenCod',    title: 'Código centro de costo (PK)',                                             type: 'n',      length:  5, dec: 0, prefix: 'CON' },
        { id: 'r_cennom',    name: 'CenNom',    title: 'Nombre centro de costo',                                                  type: 'string', length: 30, dec: 0, prefix: 'CON' },
        { id: 'r_centit',    name: 'CenTit',    title: 'Es título (agrupador): 0=No, 1=Sí',                                      type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_consecod2', name: 'ConSeCod',  title: 'FK sección C.Costo',                                                     type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_cenprvred', name: 'CenPrvRed', title: 'Código C.Costo para Previred (remuneraciones)',                          type: 'string', length: 20, dec: 0, prefix: 'CON' },
        { id: 'r_cenest',    name: 'cenest',    title: 'Estado: 0=Activo, 1=Inactivo',                                           type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_cencla',    name: 'CenCla',    title: 'Clasificación activo fijo: 0=Sin, 1=Costo Directo, 2=Indirecto, 3=Gasto',type: 'n',      length:  1, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'ITEGAS',
      description: 'Conceptos de gasto e ingreso — ítems analíticos para imputación contable',
      attributes: [
        { id: 'r_itecod',    name: 'IteCod',    title: 'Código concepto gasto/ingreso (PK)', type: 'n',      length:  4, dec: 0, prefix: 'CON' },
        { id: 'r_itenom',    name: 'IteNom',    title: 'Nombre concepto',                    type: 'string', length: 30, dec: 0, prefix: 'CON' },
        { id: 'r_itetit',    name: 'IteTit',    title: 'Es título agrupador: 0=No, 1=Sí',   type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_consicod2', name: 'ConSiCod',  title: 'FK sección conceptos',               type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_iteest',    name: 'iteest',    title: 'Estado: 0=Activo, 1=Inactivo',       type: 'n',      length:  1, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'FLUEFE',
      description: 'Flujos de efectivo — clasificación para estado de flujo de caja',
      attributes: [
        { id: 'r_flutip', name: 'FluTip', title: 'Tipo flujo: 0=Sin flujo, 1=Operación, 2=Inversión, 3=Financiamiento', type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_flucod', name: 'FluCod', title: 'Código flujo de efectivo (PK)',                                        type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_flunom', name: 'FluNom', title: 'Descripción flujo de efectivo',                                        type: 'string', length: 30, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'EJERCIC2',
      description: 'Ejercicios contables — catálogo maestro de ejercicios',
      attributes: [
        { id: 'r_ejecod2', name: 'EjeCod', title: 'Código ejercicio (PK)', type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_ejenom2', name: 'EjeNom', title: 'Nombre ejercicio',      type: 'string', length: 30, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'EJERCICI',
      description: 'Ejercicios contables por año — asociación ejercicio/año con cuenta de resultado',
      attributes: [
        { id: 'r_ejecod',   name: 'EjeCod',   title: 'Código ejercicio (PK)',                              type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_ejeano',   name: 'EjeAno',   title: 'Año del ejercicio (PK)',                             type: 'n',      length:  4, dec: 0, prefix: 'CON' },
        { id: 'r_ejeracod', name: 'EjeRaCod', title: 'Código cuenta resultado de ejercicios anteriores',  type: 'string', length:  9, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'EJERCIC1',
      description: 'Períodos contables por ejercicio — define las fechas de apertura y cierre de cada mes',
      attributes: [
        { id: 'r_ejecod1',   name: 'EjeCod',    title: 'Código ejercicio (PK)',                     type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_ejeano1',   name: 'EjeAno',    title: 'Año del ejercicio (PK)',                    type: 'n',      length:  4, dec: 0, prefix: 'CON' },
        { id: 'r_ejeper',    name: 'EjePer',    title: 'Período / mes (1 a 12) (PK)',               type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_ejeini',    name: 'EjeIni',    title: 'Fecha desde del período',                   type: 'd',      length:  8, dec: 0, prefix: 'CON' },
        { id: 'r_ejefin',    name: 'EjeFin',    title: 'Fecha hasta del período',                   type: 'd',      length:  8, dec: 0, prefix: 'CON' },
        { id: 'r_ejepernom', name: 'EjePerNom', title: 'Nombre del período (ej. Enero)',            type: 'string', length: 10, dec: 0, prefix: 'CON' },
        { id: 'r_ejecbcod',  name: 'EjeCbCod',  title: 'Código cuenta cierre de balance',          type: 'string', length:  9, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'PLACUED',
      description: 'Plan de cuentas contable — maestro completo de cuentas con clasificación y controles',
      attributes: [
        { id: 'r_placod',      name: 'PlaCod',      title: 'Código de cuenta (PK)',                                                    type: 'string', length:  9, dec: 0, prefix: 'CON' },
        { id: 'r_planom',      name: 'PlaNom',      title: 'Nombre de la cuenta',                                                      type: 'string', length: 30, dec: 0, prefix: 'CON' },
        { id: 'r_placodmas',   name: 'PlaCodMas',   title: 'Código de cuenta con máscara (formato visual)',                            type: 'string', length: 18, dec: 0, prefix: 'CON' },
        { id: 'r_plapad',      name: 'PlaPad',      title: 'Código cuenta padre (jerarquía)',                                          type: 'string', length:  9, dec: 0, prefix: 'CON' },
        { id: 'r_plagru',      name: 'PlaGru',      title: 'Agrupación: 1=Activo, 2=Pasivo, 3=Orden Debe, 4=Orden Haber, 5=Gasto, 6=Ingreso', type: 'n', length: 1, dec: 0, prefix: 'CON' },
        { id: 'r_platit',      name: 'PlaTit',      title: 'Indicador cuenta título (agrupador): 0=No, 1=Sí',                         type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plactacte',   name: 'PlaCtaCte',   title: 'Imputa cuenta corriente: 0=No, 1=Sí',                                     type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plaareeng',   name: 'PlaAreNeg',   title: 'Imputa área de negocio: 0=No, 1=Sí',                                      type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_placencos',   name: 'PlaCenCos',   title: 'Imputa centro de costo: 0=No, 1=Sí',                                      type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plaitgas',    name: 'PlaIteGas',   title: 'Imputa concepto gasto/ingreso: 0=No, 1=Sí',                               type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_pladocref',   name: 'PlaDocRef',   title: 'Imputa documento referencial: 0=No, 1=Sí',                                type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plafluefe',   name: 'PlaFluEfe',   title: 'Imputa flujo de efectivo: 0=No, 1=Sí',                                    type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plaflucaj',   name: 'PlaFluCaj',   title: 'Se considera en informe flujo de caja: 0=No, 1=Sí',                       type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_placueblo',   name: 'PlaCueBlo',   title: 'Cuenta bloqueada: 0=No, 1=Sí',                                            type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plafchblo',   name: 'PlaFchBlo',   title: 'Fecha desde cuando está bloqueada',                                       type: 'd',      length:  8, dec: 0, prefix: 'CON' },
        { id: 'r_plaotrmod',   name: 'PlaOtrMod',   title: 'Uso exclusivo (no imputable desde contabilidad): 0=No, 1=Sí',             type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plausorut',   name: 'PlaUsoRut',   title: 'Usa RUT en análisis: 0=No, 1=Sí',                                        type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plactares',   name: 'PlaCtaRes',   title: 'Código contracuenta diferencias de cambio',                               type: 'string', length:  9, dec: 0, prefix: 'CON' },
        { id: 'r_placormon',   name: 'PlaCorMon',   title: 'Corrección monetaria diferencias de cambio: 0=No, 1=Sí',                  type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_placorres',   name: 'PlaCorRes',   title: 'Corrección monetaria ctas de resultado: 0=No, 1=Sí',                      type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_moncod',      name: 'MonCod',      title: 'Código de moneda de la cuenta',                                           type: 'n',      length:  2, dec: 0, prefix: 'CON' },
        { id: 'r_placlicod',   name: 'PLACLICOD',   title: 'Imputa cliente: 0=No, 1=Sí',                                             type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plapardif',   name: 'PlaParDif',   title: 'Participa en proceso diferencia de cambio (tributario): 0=Participa, 1=No Participa', type: 'n', length: 1, dec: 0, prefix: 'CON' },
        { id: 'r_placodsii',   name: 'PlaCodSII',   title: 'Código cuenta SII para clasificación tributaria',                         type: 'string', length: 20, dec: 0, prefix: 'CON' },
        { id: 'r_pladifcam',   name: 'PLADIFCAM',   title: 'Participa en proceso diferencia de cambio (financiero): 0=Participa, 1=No Participa', type: 'n', length: 1, dec: 0, prefix: 'CON' },
        { id: 'r_plabalcod',   name: 'PlaBalCod',   title: 'Código presentación adicional balances',                                  type: 'string', length: 10, dec: 0, prefix: 'CON' },
        { id: 'r_placodf22',   name: 'PlaCodF22',   title: 'Código cuenta recuadro F22 (SII)',                                        type: 'n',      length:  4, dec: 0, prefix: 'CON' },
        { id: 'r_plaoperac',   name: 'PlaOPeRac',   title: 'Operación en EBITDA: 0=Resta, 1=Suma',                                    type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_placuedis',   name: 'placuedis',   title: 'Cuenta de distribución EBITDA: 0=No, 1=Sí',                              type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_plaebitda',   name: 'PlaEbiTda',   title: 'Cuenta para EBITDA: 0=No, 1=Sí',                                         type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_placueven',   name: 'PLACUEVEN',   title: 'Identificación cuenta de ventas: 0=No, 1=Sí',                            type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_cccchepro',   name: 'CccChePro',   title: 'Es cuenta de cheques protestados: 0=No, 1=Sí',                           type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_placuenom',   name: 'PlaCueNom',   title: 'Se usa en generación de nóminas de egresos: 0=No, 1=Sí',                 type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_ccccuerec',   name: 'CCCCueRec',   title: 'Indicador cuenta recaudable: 0=No, 1=Sí',                                type: 'n',      length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_cccnomrec',   name: 'CCCNomRec',   title: 'Nombre recaudación',                                                      type: 'string', length: 20, dec: 0, prefix: 'CON' },
        { id: 'r_plamonkor',   name: 'PlaMonCor',   title: 'Moneda a corregir diferencias de cambio: 0=Moneda Local, 1=Otra moneda',  type: 'n',      length:  1, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'CONCOM',
      description: 'Cabecera del comprobante contable (asiento). IMPORTANTE: COMEJE indica a qué ejercicio afecta; COMEJE=0 significa que afecta a TODOS los ejercicios existentes de la empresa. No existe JOIN directo por período — el período se determina usando COMEJE + ConLibAno a través del procesador de comprobantes.',
      attributes: [
        { id: 'r_concmglo',  name: 'ConCmGlo',  title: 'Glosa del comprobante',                                                                type: 'string', length: 80, dec: 0, prefix: 'CON' },
        { id: 'r_concmtip',  name: 'ConCmTip',  title: 'Tipo de comprobante',                                                                  type: 'string', length:  3, dec: 0, prefix: 'CON' },
        { id: 'r_concmfcre', name: 'ConCmFCre', title: 'Fecha de creación del asiento',                                                        type: 'd',      length:  8, dec: 0, prefix: 'CON' },
        { id: 'r_concmsit',  name: 'ConCmSit',  title: 'Situación: A=Activo, N=Anulado',                                                       type: 'string', length:  1, dec: 0, prefix: 'CON' },
        { id: 'r_conlibano', name: 'ConLibAno', title: 'Año del libro contable',                                                               type: 'n',      length:  4, dec: 0, prefix: 'CON' },
        { id: 'r_conlibcor', name: 'ConLibCor', title: 'Correlativo / número del comprobante',                                                 type: 'n',      length: 10, dec: 0, prefix: 'CON' },
        { id: 'r_comeje',    name: 'COMEJE',    title: 'Ejercicio al que afecta el comprobante. 0=afecta a todos los ejercicios de la empresa', type: 'n',      length:  4, dec: 0, prefix: 'CON' },
      ],
    },
    // CONCOC EXCLUIDA: es una tabla de plantillas de ingreso de comprobantes.
    // No contiene saldos ni movimientos contables reales. Confirmado por Verónica Leighton (INET).
    // No usar en consultas sobre contabilidad, balances ni movimientos.
    {
      name: 'CONCOMCO',
      description: 'Correlativo de comprobantes contables por año y tipo',
      attributes: [
        { id: 'r_conlibano2', name: 'ConLibAno', title: 'Año del correlativo',         type: 'n',      length:  4, dec: 0, prefix: 'CON' },
        { id: 'r_conlibtip',  name: 'ConLibTip', title: 'Tipo de libro/comprobante',   type: 'string', length:  3, dec: 0, prefix: 'CON' },
        { id: 'r_conlibcor2', name: 'ConLibCor', title: 'Último correlativo asignado', type: 'n',      length: 10, dec: 0, prefix: 'CON' },
      ],
    },
    {
      name: 'CONPAR1',
      description: 'Parámetros del período contable en proceso',
      attributes: [
        { id: 'r_conmespro', name: 'ConMesPro', title: 'Mes en proceso (1-12)', type: 'n', length: 2, dec: 0, prefix: 'CON' },
        { id: 'r_conanopro', name: 'ConAnoPro', title: 'Año en proceso (YYYY)', type: 'n', length: 4, dec: 0, prefix: 'CON' },
      ],
    },
  ],

  // ── REM — Remuneraciones ─────────────────────────────────────────────────
  // Schema completo verificado por equipo Informat (Verónica) 2026-04-01
  // Incluye: PERSONAL, AFP, ISAPRES, CARGOS, CAJCOM, LUGPAG, REMIMP, TURNOS, REMTTR, ANACTA
  REM: [
    {
      name: 'PERSONAL',
      description: 'Maestro de personal — ficha completa de cada empleado con datos previsionales, contractuales y de pago',
      attributes: [
        { id: 'r_pertip',    name: 'PerTip',    title: 'Tipo: 1=Persona',                                                           type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_percod',    name: 'PerCod',    title: 'Parte numérica del RUT (PK)',                                               type: 'n',      length: 12, dec: 0, prefix: 'REM' },
        { id: 'r_persec',    name: 'PerSec',    title: 'Secuencia — misma persona puede tener varios contratos (PK)',               type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perfic',    name: 'PerFic',    title: 'Ficha — nombre corto identificador del empleado',                          type: 'string', length:  9, dec: 0, prefix: 'REM' },
        { id: 'r_perdve',    name: 'PerDVe',    title: 'Dígito verificador del RUT',                                               type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_perfchnac', name: 'PerFchNac', title: 'Fecha de nacimiento',                                                      type: 'd',      length:  8, dec: 0, prefix: 'REM' },
        { id: 'r_persex',    name: 'PerSex',    title: 'Sexo: F=Femenino, M=Masculino',                                           type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_perestciv', name: 'PerEstCiv', title: 'Estado civil: C=Casado, S=Soltero, V=Viudo, D=Divorciado, A=Unión Civil', type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_perafpcod', name: 'PerAfpCod', title: 'Código AFP del empleado',                                                  type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perafpcot', name: 'PerAfpCot', title: 'Porcentaje cotización AFP (solo previsión especial)',                      type: 'n',      length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_perafpseg', name: 'PerAfpSeg', title: 'Porcentaje comisión AFP (solo previsión especial)',                        type: 'n',      length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_perxcpcod', name: 'PerXcpCod', title: 'Código ExCaja de Previsión',                                              type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perrgicod', name: 'PerRgiCod', title: 'Código régimen impositivo',                                               type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perfon',    name: 'PerFon',    title: 'Está en Fonasa: S=Sí',                                                    type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_perisacod', name: 'PerIsaCod', title: 'Código Isapre del empleado',                                              type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perisapla', name: 'PerIsaPla', title: 'Monto plan Isapre',                                                       type: 'n',      length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_perisatpl', name: 'PerIsaTPl', title: 'Tipo plan Isapre: %=Porcentaje, $=Pesos, UF=UF, 7+=7%+UF',               type: 'string', length:  2, dec: 0, prefix: 'REM' },
        { id: 'r_perisaley', name: 'PerIsaLey', title: 'Permite descuento Ley 18566: 1=Sí',                                      type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_pertipcon', name: 'PerTipCon', title: 'Tipo contrato: I=Indefinido, P=Plazo Fijo, H=Honorarios, O=Obra',        type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_percarcod', name: 'PerCarCod', title: 'Código de cargo del empleado',                                            type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perfchini', name: 'PerFchIni', title: 'Fecha inicio de contrato',                                                type: 'd',      length:  8, dec: 0, prefix: 'REM' },
        { id: 'r_perfchfin', name: 'PerFchFin', title: 'Fecha término de contrato',                                               type: 'd',      length:  8, dec: 0, prefix: 'REM' },
        { id: 'r_perrtabas', name: 'PerRtaBas', title: 'Monto renta base',                                                        type: 'n',      length: 19, dec: 4, prefix: 'REM' },
        { id: 'r_permonrta', name: 'PerMonRta', title: 'Moneda renta base: $=Pesos, US=Dólar, UF=UF',                            type: 'string', length:  2, dec: 0, prefix: 'REM' },
        { id: 'r_pertiprta', name: 'PerTipRta', title: 'Periodicidad renta: M=Mes, D=Día, H=Hora',                               type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_perjortra', name: 'PerJorTra', title: 'Horas de la jornada de trabajo',                                         type: 'n',      length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_pertipjor', name: 'PerTipJor', title: 'Tipo jornada: S=Semana, D=Día, M=Mes',                                   type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_pergra',    name: 'PerGra',    title: 'Paga gratificación: S=Sí, N=No',                                         type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_percencod', name: 'PerCenCod', title: 'Código centro de costo del empleado',                                    type: 'n',      length: 10, dec: 0, prefix: 'REM' },
        { id: 'r_persuccod', name: 'PerSucCod', title: 'Código sucursal del empleado',                                           type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_percarfan', name: 'PerCarFaN', title: 'Número cargas familiares normales',                                       type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_percarfai', name: 'PerCarFaI', title: 'Número cargas familiares inválidas',                                      type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_percarfam', name: 'PerCarFaM', title: 'Número cargas familiares maternales',                                     type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_pertipcfa', name: 'PerTipCFa', title: 'Tramo carga familiar',                                                   type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_percafcod', name: 'PerCafCod', title: 'Código caja de compensación',                                            type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perestliq', name: 'PerEstLiq', title: 'Ficha vigente: 0=Activa',                                                type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perforpag', name: 'PerForPag', title: 'Forma pago: E=Efectivo, C=Cheque, D=Depósito, P=Cta Prima, V=Vale Vista', type: 'string', length: 1, dec: 0, prefix: 'REM' },
        { id: 'r_perctaban', name: 'PerCtaBan', title: 'Cuenta bancaria del empleado',                                           type: 'string', length: 20, dec: 0, prefix: 'REM' },
        { id: 'r_perlpgcod', name: 'PerLpgCod', title: 'Código lugar de pago',                                                   type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perfchcre', name: 'PerFchCre', title: 'Fecha creación del registro',                                            type: 'd',      length:  8, dec: 0, prefix: 'REM' },
        { id: 'r_perfchmod', name: 'PerFchMod', title: 'Fecha última modificación',                                              type: 'd',      length:  8, dec: 0, prefix: 'REM' },
        { id: 'r_perjub',    name: 'PerJub',    title: 'Tiene cotización previsional especial (jubilado): S=Sí',                 type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_anaapemat', name: 'AnaApeMat', title: 'Apellido materno del empleado',                                          type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_anaapepat', name: 'AnaApePat', title: 'Apellido paterno del empleado',                                          type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_ananompil', name: 'AnaNomPil', title: 'Nombre de pila del empleado',                                            type: 'string', length: 20, dec: 0, prefix: 'REM' },
        { id: 'r_pernom',    name: 'pernom',    title: 'Nombre completo del empleado',                                           type: 'string', length: 40, dec: 0, prefix: 'REM' },
        { id: 'r_perarecod', name: 'PerAreCod', title: 'Código área de negocios',                                                type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_pertraagr', name: 'PerTraAgr', title: 'Trabajador agrícola: 1=Sí',                                              type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perdiasem', name: 'PerDiaSem', title: 'Días por semana que trabaja',                                            type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perext',    name: 'PerExt',    title: 'Personal extranjero — código tipo impuesto a aplicar',                   type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_persegces', name: 'PerSegCes', title: 'Paga seguro de cesantía: 1=Sí, 0=No',                                   type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perfecseg', name: 'PerFecSeg', title: 'Fecha inicio vigencia seguro de cesantía',                               type: 'd',      length:  8, dec: 0, prefix: 'REM' },
        { id: 'r_perdiapag', name: 'PerDiaPag', title: 'Día de pago de sueldo',                                                  type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perdir',    name: 'PerDir',    title: 'Dirección del empleado',                                                 type: 'string', length: 40, dec: 0, prefix: 'REM' },
        { id: 'r_percom',    name: 'PerCom',    title: 'Comuna del empleado',                                                    type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_pertel',    name: 'PerTel',    title: 'Teléfono del empleado',                                                  type: 'string', length: 20, dec: 0, prefix: 'REM' },
        { id: 'r_pereml',    name: 'PerEml',    title: 'E-mail del empleado',                                                    type: 'string', length: 50, dec: 0, prefix: 'REM' },
        { id: 'r_perreg',    name: 'PerReg',    title: 'Región del empleado',                                                    type: 'string', length: 30, dec: 0, prefix: 'REM' },
        { id: 'r_perliqpdf', name: 'PerLiqPdf', title: 'Enviar liquidación PDF por correo: 1=Sí, 0=No',                         type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perdiames', name: 'PerDiaMes', title: 'Cantidad de días por mes',                                               type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perhrsmes', name: 'PerHrsMes', title: 'Cantidad de horas por mes',                                              type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perjorpar', name: 'PerJorPar', title: 'Jornada parcial: 0=Completa, 1=Parcial',                                 type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perfundis', name: 'PERFUNDIS', title: 'Empleado con discapacidad: 1=Sí, 0=No',                                  type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perrtaemp', name: 'PERRTAEMP', title: 'Empleado con renta empresarial (LRE): 1=Sí, 0=No',                      type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perturcod', name: 'PERTURCOD', title: 'Código de turno asignado',                                               type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_remttcod',  name: 'RemTtCod',  title: 'Código tipo de trabajador para Previred',                                type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perbcopag', name: 'PerBcoPag', title: 'Código banco para pago de sueldo',                                       type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_pertipabo', name: 'PerTipAbo', title: 'Tipo cuenta bancaria: 0=Nada, 1=Cta Corriente, 2=Cta Vista, 3=Cta Intereses', type: 'n', length: 5, dec: 0, prefix: 'REM' },
        { id: 'r_perart146', name: 'PerArt146', title: 'Afecto artículo 146 (aporte empleador por máx 11 años): 1=Sí, 0=No',    type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perartact', name: 'PerArtEsp', title: 'Trabajador de artes y espectáculos (DDJJ 1927): 1=Sí, 0=No',            type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_percalant', name: 'PerCalAnt', title: 'Se le paga anticipo de sueldos: 1=Sí, 0=No',                            type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_perfchial', name: 'PerFchIAL', title: 'Fecha inicio años laborales (solo informativo)',                         type: 'd',      length:  8, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'AFP',
      description: 'Tabla de AFP — administradoras de fondos de pensiones con porcentajes de cotización',
      attributes: [
        { id: 'r_afpcod',    name: 'AfpCod',    title: 'Código AFP (PK)',                          type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_afpnom',    name: 'AfpNom',    title: 'Nombre AFP',                               type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_afpraz',    name: 'AfpRaz',    title: 'Razón social AFP',                         type: 'string', length: 30, dec: 0, prefix: 'REM' },
        { id: 'r_afprut',    name: 'AfpRut',    title: 'RUT AFP (parte numérica)',                 type: 'n',      length: 10, dec: 0, prefix: 'REM' },
        { id: 'r_afpdve',    name: 'AfpDve',    title: 'Dígito verificador RUT AFP',               type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_afppcjcfp', name: 'AfpPcjCfp', title: 'Porcentaje cotización previsional (%)',   type: 'n',      length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_afppcjseg', name: 'AfpPcjSeg', title: 'Porcentaje seguro invalidez/sobrevivencia', type: 'n',   length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_afppcjcom', name: 'AfpPcjCom', title: 'Porcentaje comisión AFP (%)',              type: 'n',      length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_afplacod',  name: 'AfpPlaCod', title: 'Código cuenta contable asociada a AFP',   type: 'string', length:  9, dec: 0, prefix: 'REM' },
        { id: 'r_afpcodpre', name: 'AfpCodPre', title: 'Código homólogo en Previred',             type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_afpcodlre', name: 'AfpCodLRE', title: 'Código homólogo en LRE',                  type: 'n',      length:  5, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'ISAPRES',
      description: 'Tabla de Isapres — instituciones de salud previsional',
      attributes: [
        { id: 'r_isacod',    name: 'IsaCod',    title: 'Código Isapre (PK)',              type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_isanom',    name: 'IsaNom',    title: 'Nombre Isapre',                   type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_isaraz',    name: 'IsaRaz',    title: 'Razón social Isapre',             type: 'string', length: 30, dec: 0, prefix: 'REM' },
        { id: 'r_isarut',    name: 'IsaRut',    title: 'RUT Isapre (parte numérica)',     type: 'n',      length: 10, dec: 0, prefix: 'REM' },
        { id: 'r_isadve',    name: 'IsaDve',    title: 'Dígito verificador RUT Isapre',  type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_isaplac',   name: 'PlaCod',    title: 'Código cuenta contable Isapre',  type: 'string', length:  9, dec: 0, prefix: 'REM' },
        { id: 'r_isacodpre', name: 'IsaCodPre', title: 'Código homólogo en Previred',    type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_isacodlre', name: 'IsaCodLRE', title: 'Código homólogo en LRE',         type: 'n',      length:  5, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'CARGOS',
      description: 'Tabla de cargos — posiciones laborales con renta asociada',
      attributes: [
        { id: 'r_carcod',    name: 'CarCod',    title: 'Código de cargo (PK)',                                    type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_carnom',    name: 'CarNom',    title: 'Nombre del cargo',                                        type: 'string', length: 30, dec: 0, prefix: 'REM' },
        { id: 'r_carrta',    name: 'CarRta',    title: 'Renta del cargo',                                         type: 'n',      length: 19, dec: 4, prefix: 'REM' },
        { id: 'r_carrtamed', name: 'CarRtaMed', title: 'Renta media del cargo',                                   type: 'n',      length: 19, dec: 4, prefix: 'REM' },
        { id: 'r_carrtamin', name: 'CarRtaMin', title: 'Renta mínima del cargo',                                  type: 'n',      length: 19, dec: 4, prefix: 'REM' },
        { id: 'r_carrtamax', name: 'CarRtaMax', title: 'Renta máxima del cargo',                                  type: 'n',      length: 19, dec: 4, prefix: 'REM' },
        { id: 'r_carpcijtpe',name: 'CarPcjTPe', title: 'Porcentaje cotización trabajos pesados: 0%, 1%, 2%',     type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_carrtamon', name: 'CarRtaMon', title: 'Moneda de la renta: $=Pesos, UF=UF, US=Dólar',          type: 'string', length:  2, dec: 0, prefix: 'REM' },
        { id: 'r_carntrpes', name: 'CarNTrPes', title: 'Nombre del cargo para presentar en LRE',                 type: 'string', length:200, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'CAJCOM',
      description: 'Tabla de cajas de compensación',
      attributes: [
        { id: 'r_cafcod',    name: 'CafCod',    title: 'Código caja de compensación (PK)',      type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_cafnom',    name: 'CafNom',    title: 'Nombre caja de compensación',           type: 'string', length: 30, dec: 0, prefix: 'REM' },
        { id: 'r_cafplacod', name: 'CafPlaCod', title: 'Código cuenta contable',                type: 'string', length:  9, dec: 0, prefix: 'REM' },
        { id: 'r_cafcodpre', name: 'CafCodPre', title: 'Código homólogo en Previred',           type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_cafrut',    name: 'CAFRUT',    title: 'RUT caja (parte numérica)',             type: 'n',      length: 10, dec: 0, prefix: 'REM' },
        { id: 'r_cafdve',    name: 'CAFDVE',    title: 'Dígito verificador RUT caja',           type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_cafcodlre', name: 'CafCodLRE', title: 'Código homólogo en LRE',               type: 'n',      length:  5, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'LUGPAG',
      description: 'Tabla de lugares de pago — incluye porcentaje de asignación por zona extrema',
      attributes: [
        { id: 'r_lpgcod',    name: 'LpgCod',    title: 'Código lugar de pago (PK)',                  type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_lpgnom',    name: 'LpgNom',    title: 'Nombre lugar de pago',                        type: 'string', length: 30, dec: 0, prefix: 'REM' },
        { id: 'r_lpgpcjzex', name: 'LpgPcjZEx', title: 'Porcentaje asignación zona extrema (%)',      type: 'n',      length: 10, dec: 4, prefix: 'REM' },
      ],
    },
    {
      name: 'REMIMP',
      description: 'Tipos de impuesto a aplicar — para empleados extranjeros',
      attributes: [
        { id: 'r_reimpcod',  name: 'REMImpCod',  title: 'Código impuesto único (PK)',                          type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_reimpnom',  name: 'REMImpNom',  title: 'Nombre tipo impuesto',                               type: 'string', length: 40, dec: 0, prefix: 'REM' },
        { id: 'r_reimpcpj',  name: 'REMImpPcj',  title: 'Porcentaje a aplicar a extranjeros (%)',             type: 'n',      length: 10, dec: 4, prefix: 'REM' },
        { id: 'r_reimpgpe',  name: 'RemImpGPe',  title: 'Glosa en maestro de personal para tipo extranjero',  type: 'string', length: 25, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'TURNOS',
      description: 'Tabla de turnos de trabajo',
      attributes: [
        { id: 'r_turcod', name: 'TURCOD', title: 'Código de turno (PK)', type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_turnom', name: 'TURNOM', title: 'Nombre del turno',     type: 'string', length: 30, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'REMTTR',
      description: 'Tipos de trabajador para Previred',
      attributes: [
        { id: 'r_remttcod', name: 'RemTtCod', title: 'Código tipo trabajador Previred (PK)', type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_remttnom', name: 'RemTtNom', title: 'Nombre tipo trabajador',               type: 'string', length: 40, dec: 0, prefix: 'REM' },
      ],
    },
    {
      name: 'ANACTA',
      description: 'Maestro de análisis de cuentas — datos de contacto y pago de personas y proveedores',
      attributes: [
        { id: 'r_anatip',    name: 'AnaTip',    title: 'Clasificación: 1=Persona, 0=Otro (PK)',    type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_anacod',    name: 'AnaCod',    title: 'Parte numérica del RUT (PK)',              type: 'n',      length: 12, dec: 0, prefix: 'REM' },
        { id: 'r_anasec',    name: 'AnaSec',    title: 'Secuencia (PK)',                           type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_anadve',    name: 'AnaDve',    title: 'Dígito verificador',                       type: 'string', length:  1, dec: 0, prefix: 'REM' },
        { id: 'r_ananom',    name: 'AnaNom',    title: 'Nombre completo',                          type: 'string', length: 40, dec: 0, prefix: 'REM' },
        { id: 'r_anadir',    name: 'AnaDir',    title: 'Dirección',                                type: 'string', length: 40, dec: 0, prefix: 'REM' },
        { id: 'r_anaciu',    name: 'AnaCiu',    title: 'Ciudad',                                   type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_anacom',    name: 'AnaCom',    title: 'Comuna',                                   type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_anareg',    name: 'AnaReg',    title: 'Región',                                   type: 'string', length: 30, dec: 0, prefix: 'REM' },
        { id: 'r_anatel',    name: 'AnaTel',    title: 'Teléfono',                                 type: 'string', length: 20, dec: 0, prefix: 'REM' },
        { id: 'r_anaeml',    name: 'AnaEml',    title: 'E-mail',                                   type: 'string', length: 50, dec: 0, prefix: 'REM' },
        { id: 'r_anaapepat', name: 'AnaApePat', title: 'Apellido paterno',                         type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_anaapemat', name: 'AnaApeMat', title: 'Apellido materno',                         type: 'string', length: 15, dec: 0, prefix: 'REM' },
        { id: 'r_ananompil2',name: 'AnaNomPil', title: 'Nombre de pila',                           type: 'string', length: 20, dec: 0, prefix: 'REM' },
        { id: 'r_anaest',    name: 'anaest',    title: 'Activo: 0=Sí, 1=No',                       type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_anabcocod', name: 'AnaBcoCod', title: 'Código de banco',                          type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_ananumccc', name: 'ANANUMCCC', title: 'Número cuenta corriente',                  type: 'string', length: 22, dec: 0, prefix: 'REM' },
        { id: 'r_anapaicod', name: 'AnaPaiCod', title: 'Código de país',                           type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_anaindac',  name: 'AnaIndFac', title: 'RUT corresponde a empresa de factoring',   type: 'n',      length:  5, dec: 0, prefix: 'REM' },
        { id: 'r_anafacod',  name: 'AnaFaCod',  title: 'Código forma de pago para proveedores',    type: 'n',      length:  5, dec: 0, prefix: 'REM' },
      ],
    },
  ],
};

@Injectable()
export class SchemaService implements OnModuleInit {
  private readonly logger = new Logger(SchemaService.name);
  private modules: Map<string, SchemaModule> = new Map();
  private allAttributes: Attribute[] = [];
  /** Lookup map: UPPERCASE table name → description from GeneXus transactions */
  private tableDescMap: Map<string, string> = new Map();

  /**
   * Lookup map: UPPERCASE attribute name → human-readable title from GeneXus KB.
   * e.g. "LAQTOTHAB" → "total haberes", "VFADOCNUM" → "Número de documento"
   * Built at startup from _full_attributes.json (92% coverage).
   */
  private attrTitleMap: Map<string, string> = new Map();

  async onModuleInit() {
    await this.loadSchema();
  }

  private async loadSchema() {
    // KB_DOCS_PATH must be set in production. Falls back to a path relative
    // to the compiled dist/ output so it works in dev without env var.
    // In production (Railway/Docker), set KB_DOCS_PATH to the absolute path
    // where the JSON files are placed (e.g. /app/docs or /data/docs).
    const defaultDocsPath = path.resolve(__dirname, '..', '..', '..', 'docs');
    const docsPath = process.env.KB_DOCS_PATH ?? defaultDocsPath;

    if (!process.env.KB_DOCS_PATH) {
      this.logger.warn(
        `KB_DOCS_PATH not set — falling back to: ${docsPath}. ` +
        'Set KB_DOCS_PATH in production to ensure schema is loaded correctly.'
      );
    }

    const attrsPath = path.join(docsPath, '_full_attributes.json');
    const objectsPath = path.join(docsPath, '_language_objects.json');

    try {
      // Load attributes
      const attrsRaw = fs.readFileSync(attrsPath, 'utf-8');
      this.allAttributes = JSON.parse(attrsRaw) as Attribute[];

      // Build title lookup map: UPPERCASE name → human title
      this.attrTitleMap = new Map();
      for (const attr of this.allAttributes) {
        if (attr.name && attr.title && attr.title.trim() !== '' && attr.title !== attr.name) {
          this.attrTitleMap.set(attr.name.toUpperCase(), attr.title.trim());
        }
      }
      this.logger.log(`Title map built: ${this.attrTitleMap.size} attribute descriptions loaded from KB`);

      // Load objects for table descriptions
      const objectsRaw = fs.readFileSync(objectsPath, 'utf-8');
      const langData = JSON.parse(objectsRaw);
      const transactions: Array<{ name: string; description: string; module_prefix: string }> =
        (langData.objects ?? []).filter((o: { type: string }) => o.type === 'Transaction');

      // Build table description map: UPPERCASE table name → description
      this.tableDescMap = new Map();
      for (const t of transactions) {
        if (t.name && t.description && t.description.trim() !== '') {
          this.tableDescMap.set(t.name.toUpperCase(), t.description.trim());
        }
      }
      this.logger.log(`Table desc map built: ${this.tableDescMap.size} table descriptions from KB`);

      // Group attributes by prefix
      const attrsByPrefix = new Map<string, Attribute[]>();
      for (const attr of this.allAttributes) {
        const prefix = attr.prefix?.toUpperCase() ?? 'UNK';
        if (!attrsByPrefix.has(prefix)) attrsByPrefix.set(prefix, []);
        attrsByPrefix.get(prefix)!.push(attr);
      }

      // Build modules
      for (const [prefix, meta] of Object.entries(MODULE_META)) {
        const moduleTrans = transactions.filter((t) => t.module_prefix === prefix);
        const moduleAttrs = attrsByPrefix.get(prefix) ?? [];

        // Match attrs to tables
        const tablesSorted = moduleTrans.map((t) => t.name).sort((a, b) => b.length - a.length);
        const tableAttrMap = new Map<string, Attribute[]>();
        const unmatched: Attribute[] = [];

        for (const attr of moduleAttrs) {
          let matched = false;
          for (const tname of tablesSorted) {
            if (attr.name.toUpperCase().startsWith(tname.toUpperCase())) {
              if (!tableAttrMap.has(tname)) tableAttrMap.set(tname, []);
              tableAttrMap.get(tname)!.push(attr);
              matched = true;
              break;
            }
          }
          if (!matched) unmatched.push(attr);
        }

        const tables: SchemaTable[] = moduleTrans.map((t) => ({
          name: t.name,
          description: t.description,
          attributes: tableAttrMap.get(t.name) ?? [],
        }));

        this.modules.set(prefix, {
          prefix,
          name: meta.name,
          description: meta.description,
          keywords: meta.keywords,
          tables,
        });
      }

      this.logger.log(`Schema loaded: ${this.allAttributes.length} attributes, ${transactions.length} tables, ${this.modules.size} modules`);

      // Inject real SQL Server column definitions (overrides GeneXus KB data)
      this.applyRealSchemaOverrides();
      this.logger.log('Real SQL schema overrides applied for CCC, SII');

    } catch (err) {
      this.logger.error('Failed to load schema from KB files', err);
      this.logger.warn('Running with empty schema — queries will fail');
    }
  }

  /**
   * Normalize a string: lowercase + remove diacritics (tildes/accents).
   * "Facturación" → "facturacion", "ñoño" → "nono"
   * This ensures user questions without tildes still match keywords that have them.
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')                        // decompose accented chars: é → e + ́
      .replace(/[\u0300-\u036f]/g, '');        // strip combining diacritical marks
  }

  /** Detect which modules are relevant for a given question */
  detectModules(question: string): string[] {
    // Normalize both the question and keywords so "facturacion" matches "facturación"
    const normalizedQ = this.normalize(question);
    const scores: Array<{ prefix: string; score: number }> = [];

    for (const [prefix, mod] of this.modules) {
      let score = 0;
      for (const kw of mod.keywords) {
        if (normalizedQ.includes(this.normalize(kw))) {
          score += kw.split(' ').length; // longer keyword phrases score higher
        }
      }
      if (score > 0) scores.push({ prefix, score });
    }

    scores.sort((a, b) => b.score - a.score);

    // Return top 3 modules (or all that scored > 0)
    const result = scores.slice(0, 3).map((s) => s.prefix);

    // Fallback: check if the user typed the module prefix directly (e.g. "módulo VFA")
    if (result.length === 0) {
      for (const prefix of this.modules.keys()) {
        if (normalizedQ.includes(prefix.toLowerCase())) result.push(prefix);
      }
    }

    // No module detected: return empty so the agent asks for clarification
    // rather than generating SQL for unrelated modules.
    return result;
  }

  /**
   * Get schema context for a list of module prefixes.
   *
   * Optimizations applied:
   * 1. Smart Table Selection: ranks tables by keyword relevance → top N per module
   * 2. Smart Column Selection: ranks columns by relevance + limits per table
   * 3. Compact format: [TABLE] shorthand + compact types (~3x fewer tokens vs DDL)
   * 4. Inline column titles: VFADOCNUM:C10(Nro Doc) → Claude understands column meaning
   *
   * Combined effect: ~85–90% fewer tokens vs full DDL with all tables/columns
   */
  getSchemaContext(prefixes: string[], question?: string): string {
    const MAX_TABLES_PER_MODULE = 8;   // Top-N most relevant tables per module
    const MAX_COLS_PER_TABLE    = 28;  // Limit columns per table (large tables have 80+)
    const lines: string[] = [];
    lines.push('-- I-NET ERP (SQL Server). Fechas: CHAR(8)=YYYYMMDD, CHAR(6)=YYYYMM');
    lines.push('-- Mes actual: CONVERT(CHAR(6),GETDATE(),112)');
    lines.push('');

    for (const prefix of prefixes) {
      const mod = this.modules.get(prefix);
      if (!mod) continue;

      lines.push(`-- ${mod.name} (${prefix}): ${mod.description}`);

      // ── Opt 1: Smart Table Selection ──────────────────────────────────
      const tables = question
        ? this.rankTablesByRelevance(mod.tables, question).slice(0, MAX_TABLES_PER_MODULE)
        : mod.tables.slice(0, MAX_TABLES_PER_MODULE);

      for (const table of tables) {
        if (table.attributes.length === 0) continue;

        // ── Opt 2: Smart Column Selection ─────────────────────────────
        const rankedCols = question
          ? this.rankColumnsByRelevance(table.attributes, question)
          : this.sortColumnsByImportance(table.attributes);
        const cols = rankedCols.slice(0, MAX_COLS_PER_TABLE);

        // ── Opt 3+4: Compact format with inline human-readable titles ──
        // Format: COLNAME:TYPE  or  COLNAME:TYPE(título)
        const colStrings = cols.map((a) => {
          const title = this.attrTitleMap.get(a.name.toUpperCase());
          const compactType = this.toCompactType(a);
          // Only include title if it's short and meaningfully different from the col name
          if (title && title.length <= 22 && title.toLowerCase() !== a.name.toLowerCase()) {
            return `${a.name}:${compactType}(${title})`;
          }
          return `${a.name}:${compactType}`;
        });

        lines.push(`[${table.name}] ${table.description}`);
        lines.push(`  ${colStrings.join(' ')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Rank tables by keyword relevance to the question.
   * Score = number of question words found in table name or description.
   */
  private rankTablesByRelevance(tables: SchemaTable[], question: string): SchemaTable[] {
    const words = this.questionWords(question);
    return tables
      .map((t) => {
        const target = this.normalize(`${t.name} ${t.description ?? ''}`);
        const score = words.reduce((acc, w) => acc + (target.includes(w) ? 1 : 0), 0);
        return { table: t, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.table);
  }

  /**
   * Rank columns within a table by relevance to the question.
   * Also boosts key columns (amounts, dates, codes, foreign keys) so they
   * always appear even when a question doesn't mention them explicitly.
   */
  private rankColumnsByRelevance(attrs: Attribute[], question: string): Attribute[] {
    const words = this.questionWords(question);
    return attrs
      .map((a) => {
        const title  = this.attrTitleMap.get(a.name.toUpperCase()) ?? '';
        const target = this.normalize(`${a.name} ${title}`);
        let score = words.reduce((acc, w) => acc + (target.includes(w) ? 2 : 0), 0);
        // Boost structurally important columns so they always rank high
        score += this.columnImportanceBoost(a);
        return { attr: a, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.attr);
  }

  /**
   * Default column ordering (no question context): important columns first.
   */
  private sortColumnsByImportance(attrs: Attribute[]): Attribute[] {
    return [...attrs].sort(
      (a, b) => this.columnImportanceBoost(b) - this.columnImportanceBoost(a),
    );
  }

  /**
   * Importance score for a column based on its type/name patterns.
   * Higher = more likely to be needed in any query.
   */
  private columnImportanceBoost(a: Attribute): number {
    const n = a.name.toLowerCase();
    const t = (a.type ?? '').toLowerCase();
    let boost = 0;
    // Primary/foreign key indicators
    if (/num|cod|cod$|id$|key|seq/.test(n)) boost += 3;
    // Date/period columns — almost always needed for filtering
    if (t === 'date' || t === 'd' || t === 'datetime' || t === 'a') boost += 4;
    if (/fec|fecha|per|periodo|ano|mes/.test(n)) boost += 3;
    // Amount/money columns — core business metrics
    if (/mnt|monto|tot|total|val|valor|imp|importe|prec|precio|cos|costo/.test(n)) boost += 3;
    // Status flags
    if (/sta|status|sts|estado|tip|tipo/.test(n)) boost += 2;
    // Name/description columns
    if (/nom|nombre|desc|glosa|raz/.test(n)) boost += 2;
    return boost;
  }

  /** Extract meaningful words from a question for relevance scoring */
  private questionWords(question: string): string[] {
    return this.normalize(question)
      .replace(/[^\wáéíóúñü\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  /** Compact type notation: N10, C8, N15.2, DATE, etc. */
  private toCompactType(a: Attribute): string {
    const t = (a.type ?? '').toLowerCase();
    const len = a.length ?? 0;
    const dec = a.dec ?? 0;
    if (t === 'date' || t === 'd') return 'DATE';
    if (t === 'datetime' || t === 'a') return 'DATETIME';
    if (t === 'boolean' || t === 'b') return 'BIT';
    if (t === 'numeric' || t === 'n') return dec > 0 ? `N${len}.${dec}` : `N${len}`;
    if (t === 'varchar' || t === 'vchar') return `VC${len}`;
    if (t === 'string') {
      if (len === 0) return 'N14.2';
      return dec > 0 ? `N${len}.${dec}` : `C${len}`;
    }
    if (len > 0) return dec > 0 ? `N${len}.${dec}` : `C${len}`;
    return 'VC255';
  }

  private toSqlType(a: Attribute): string {
    const t = (a.type ?? '').toLowerCase();
    const len = a.length ?? 0;
    const dec = a.dec ?? 0;
    if (t === 'date' || t === 'd') return 'DATE';
    if (t === 'datetime' || t === 'a') return 'DATETIME';
    if (t === 'boolean' || t === 'b') return 'BIT';
    if (t === 'numeric' || t === 'n') return dec > 0 ? `NUMERIC(${len},${dec})` : `NUMERIC(${len})`;
    if (t === 'varchar' || t === 'vchar') return `VARCHAR(${len})`;
    if (t === 'longvarchar' || t === 'longvchar') return 'TEXT';
    if (t === 'blob') return 'VARBINARY(MAX)';
    if (t === 'string') {
      if (len === 0) return 'NUMERIC(14,2)';
      return dec > 0 ? `NUMERIC(${len},${dec})` : `CHAR(${len})`;
    }
    if (len > 0) return dec > 0 ? `NUMERIC(${len},${dec})` : `CHAR(${len})`;
    return 'VARCHAR(255)';
  }

  /**
   * Injects real SQL Server column definitions from REAL_SQL_TABLES into the
   * loaded schema, replacing the GeneXus KB data for the affected tables.
   *
   * Strategy per table:
   *   - If the table already exists in the module → REPLACE its attributes
   *   - If the table doesn't exist yet → ADD it to the module
   *
   * Also registers column titles in `attrTitleMap` so `getSchemaContext()`
   * emits human-readable inline labels for these columns (e.g. "CCCANACOD:C12(RUT cliente)").
   */
  private applyRealSchemaOverrides(): void {
    for (const [prefix, realTables] of Object.entries(REAL_SQL_TABLES)) {
      // Ensure the module exists (it always should for CCC/SII)
      if (!this.modules.has(prefix)) {
        const meta = (MODULE_META as Record<string, typeof MODULE_META[keyof typeof MODULE_META]>)[prefix];
        if (!meta) continue;
        this.modules.set(prefix, {
          prefix,
          name: meta.name,
          description: meta.description,
          keywords: meta.keywords,
          tables: [],
        });
      }

      const mod = this.modules.get(prefix)!;

      for (const realTable of realTables) {
        // Register column titles into the lookup map so getSchemaContext() picks them up
        for (const attr of realTable.attributes) {
          if (attr.title && attr.title.trim() !== '') {
            this.attrTitleMap.set(attr.name.toUpperCase(), attr.title.trim());
          }
        }

        // Also register the table description
        if (realTable.description) {
          this.tableDescMap.set(realTable.name.toUpperCase(), realTable.description);
        }

        // Replace existing table or append new one
        const existingIdx = mod.tables.findIndex(
          (t) => t.name.toUpperCase() === realTable.name.toUpperCase(),
        );

        if (existingIdx >= 0) {
          // Replace only the attributes; keep the table reference intact
          mod.tables[existingIdx] = {
            name: realTable.name,
            description: realTable.description,
            attributes: realTable.attributes,
          };
        } else {
          mod.tables.push({
            name: realTable.name,
            description: realTable.description,
            attributes: realTable.attributes,
          });
        }
      }
    }
  }

  /**
   * Get the human-readable title for a SQL column name from the GeneXus KB.
   * Column names are matched case-insensitively.
   */
  getAttributeTitle(columnName: string): string | undefined {
    return this.attrTitleMap.get(columnName.toUpperCase());
  }

  /**
   * Get the human-readable description for a SQL table name from the GeneXus KB.
   * e.g. "REMLAQ" → "Liquidaciones de Remuneraciones"
   */
  getTableDescription(tableName: string): string | undefined {
    return this.tableDescMap.get(tableName.toUpperCase());
  }

  getModule(prefix: string): SchemaModule | undefined {
    return this.modules.get(prefix);
  }

  getAllModules(): SchemaModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Returns compression stats for a given schema context string.
   * Used for logging cost savings per query.
   * Rule of thumb: 1 token ≈ 4 characters in English/code.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Returns raw table+column counts for a set of prefixes.
   * Useful to compare "all tables" vs "selected tables" in logs.
   */
  getRawStats(prefixes: string[]): { tables: number; columns: number } {
    let tables = 0;
    let columns = 0;
    for (const prefix of prefixes) {
      const mod = this.modules.get(prefix);
      if (!mod) continue;
      tables  += mod.tables.length;
      columns += mod.tables.reduce((sum, t) => sum + t.attributes.length, 0);
    }
    return { tables, columns };
  }
}
