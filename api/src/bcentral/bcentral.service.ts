import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs   from 'fs';
import * as path from 'path';
import * as https from 'https';

// ── Tipos ──────────────────────────────────────────────────────────────────────
export interface ParametrosLegales {
  uf:           number;   // valor UF del día
  dolar:        number;   // dólar observado
  euro:         number;   // pesos por euro
  utm:          number;   // UTM del mes
  ipcVariacion: number;   // variación IPC último mes (%)
  tpm:          number;   // Tasa de Política Monetaria (%)
  fechaUF:      string;   // YYYY-MM-DD
  fechaDolar:   string;
  fechaUTM:     string;   // YYYY-MM
  actualizadoEn: string;  // ISO timestamp
}

// ── Códigos de serie BCCh ─────────────────────────────────────────────────────
const SERIES = {
  UF:    'F073.UFF.PRE.Z.D',
  DOLAR: 'F073.TCO.PRE.Z.D',
  EURO:  'F072.CLP.EUR.N.O.D',
  UTM:   'F073.UTR.PRE.Z.M',
  IPC:   'F074.IPC.VAR.Z.EP23.C.M',
  TPM:   'F022.TPM.TIN.D001.NO.Z.D',
};

const BASE_URL = 'https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx';
const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'parametros_legales.json');

@Injectable()
export class BcentralService implements OnModuleInit {
  private readonly logger = new Logger(BcentralService.name);
  private cache: ParametrosLegales | null = null;

  async onModuleInit() {
    this.loadCacheFromDisk();
    // Si el cache tiene más de 6 horas, actualizar al arrancar
    if (!this.cache || this.isCacheStale(6)) {
      await this.actualizarParametros();
    }
  }

  // ── Cron: UF y dólar — 00:05 todos los días ──────────────────────────────
  @Cron('5 0 * * *')
  async actualizarDiario() {
    this.logger.log('⏰ Cron diario: actualizando UF, dólar, euro, TPM');
    await this.actualizarParametros();
  }

  // ── Cron: verificación extra a las 10:30 (BCCh publica dólar ~10am) ──────
  @Cron('30 10 * * 1-5')
  async actualizarDolar() {
    this.logger.log('⏰ Cron 10:30: re-verificando dólar observado');
    await this.actualizarParametros();
  }

  // ── Getter principal ──────────────────────────────────────────────────────
  getParametros(): ParametrosLegales | null {
    return this.cache;
  }

  // ── Resumen para el AI (texto plano inyectable en el prompt) ─────────────
  getResumenParaAI(): string {
    if (!this.cache) return '';
    const p = this.cache;
    const fecha = new Date().toLocaleDateString('es-CL', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    return [
      `PARÁMETROS ECONÓMICOS VIGENTES (${fecha}):`,
      `• UF: $${p.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 })} (al ${p.fechaUF})`,
      `• Dólar observado: $${p.dolar.toLocaleString('es-CL', { minimumFractionDigits: 2 })} (al ${p.fechaDolar})`,
      `• Euro: $${p.euro.toLocaleString('es-CL', { minimumFractionDigits: 2 })}`,
      `• UTM: $${p.utm.toLocaleString('es-CL')} (${p.fechaUTM})`,
      `• IPC último mes: ${p.ipcVariacion}%`,
      `• TPM (Tasa Política Monetaria): ${p.tpm}%`,
      `Fuente: Banco Central de Chile — Actualizado: ${new Date(p.actualizadoEn).toLocaleString('es-CL')}`,
    ].join('\n');
  }

  // ── Actualización completa ────────────────────────────────────────────────
  async actualizarParametros(): Promise<void> {
    try {
      const hoy     = this.formatDate(new Date());
      const ayer    = this.formatDate(new Date(Date.now() - 86400000));
      const hace7   = this.formatDate(new Date(Date.now() - 7 * 86400000));
      const hace30  = this.formatDate(new Date(Date.now() - 30 * 86400000));

      const [uf, dolar, euro, utm, ipc, tpm] = await Promise.allSettled([
        this.fetchSerie(SERIES.UF,    ayer,  hoy),
        this.fetchSerie(SERIES.DOLAR, ayer,  hoy),
        this.fetchSerie(SERIES.EURO,  hace7, hoy),
        this.fetchSerie(SERIES.UTM,   hace30, hoy),
        this.fetchSerie(SERIES.IPC,   hace30, hoy),
        this.fetchSerie(SERIES.TPM,   hace7,  hoy),
      ]);

      const prev = this.cache;

      this.cache = {
        uf:           this.extractValue(uf)    ?? prev?.uf    ?? 0,
        dolar:        this.extractValue(dolar)  ?? prev?.dolar  ?? 0,
        euro:         this.extractValue(euro)   ?? prev?.euro   ?? 0,
        utm:          this.extractValue(utm)    ?? prev?.utm    ?? 0,
        ipcVariacion: this.extractValue(ipc)    ?? prev?.ipcVariacion ?? 0,
        tpm:          this.extractValue(tpm)    ?? prev?.tpm    ?? 0,
        fechaUF:      this.extractDate(uf)      ?? prev?.fechaUF    ?? hoy,
        fechaDolar:   this.extractDate(dolar)   ?? prev?.fechaDolar  ?? hoy,
        fechaUTM:     hoy.slice(0, 7),
        actualizadoEn: new Date().toISOString(),
      };

      this.saveCacheToDisk();
      this.logger.log(
        `✅ Parámetros actualizados — UF: $${this.cache.uf} | Dólar: $${this.cache.dolar} | UTM: $${this.cache.utm}`
      );
    } catch (err) {
      this.logger.error('❌ Error actualizando parámetros BCCh:', err);
    }
  }

  // ── Fetch de una serie ────────────────────────────────────────────────────
  private fetchSerie(seriesId: string, desde: string, hasta: string): Promise<any> {
    const user = process.env.BCENTRAL_USER ?? '';
    const pass = process.env.BCENTRAL_PASS ?? '';
    const url  = `${BASE_URL}?function=GetSeries&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}&timeseries=${seriesId}&firstdate=${desde}&lastdate=${hasta}`;

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.Codigo !== 0) reject(new Error(json.Descripcion));
            else resolve(json);
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private extractValue(result: PromiseSettledResult<any>): number | null {
    if (result.status !== 'fulfilled') return null;
    const obs: any[] = result.value?.Series?.Obs ?? [];
    if (!obs.length) return null;
    const last = obs[obs.length - 1];
    return last?.statusCode === 'OK' ? parseFloat(last.value) : null;
  }

  private extractDate(result: PromiseSettledResult<any>): string | null {
    if (result.status !== 'fulfilled') return null;
    const obs: any[] = result.value?.Series?.Obs ?? [];
    if (!obs.length) return null;
    const last = obs[obs.length - 1];
    // BCCh returns DD-MM-YYYY → convert to YYYY-MM-DD
    if (!last?.indexDateString) return null;
    const [d, m, y] = last.indexDateString.split('-');
    return `${y}-${m}-${d}`;
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private isCacheStale(maxHours: number): boolean {
    if (!this.cache?.actualizadoEn) return true;
    const age = Date.now() - new Date(this.cache.actualizadoEn).getTime();
    return age > maxHours * 3600 * 1000;
  }

  private loadCacheFromDisk() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        this.cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        this.logger.log(`📂 Cache cargado desde disco — UF: $${this.cache?.uf}`);
      }
    } catch { /* sin cache previo, no problem */ }
  }

  private saveCacheToDisk() {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (err) {
      this.logger.warn('No se pudo guardar cache en disco:', err);
    }
  }
}
