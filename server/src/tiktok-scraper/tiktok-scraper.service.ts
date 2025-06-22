import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { teamTable } from '../database/schema';
import { eq, desc } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import puppeteer from 'puppeteer';

// Scraper real de TikTok usando puppeteer
async function scrapeTikTokProfile(tiktokId: string): Promise<{ followers: number; description: string }> {
  const url = `https://www.tiktok.com/@${tiktokId}`;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Espera a que cargue el número de seguidores
  await page.waitForSelector('strong[data-e2e="followers-count"]', { timeout: 15000 });
  const followersText = await page.$eval('strong[data-e2e="followers-count"]', el => el.textContent || '0');
  // Extrae la descripción del perfil
  let description = '';
  try {
    description = await page.$eval('h2[data-e2e="user-bio"]', el => el.textContent || '');
  } catch {
    description = '';
  }
  await browser.close();

  // Convierte el texto de seguidores a número
  const followers = parseTikTokFollowers(followersText);
  return { followers, description };
}

function parseTikTokFollowers(text: string): number {
  // Ejemplo: "1.2M" => 1200000
  if (!text) return 0;
  const match = text.match(/([\d.]+)([MK]?)$/i);
  if (!match) return parseInt(text.replace(/\D/g, ''), 10) || 0;
  let [, num, suffix] = match;
  let n = parseFloat(num);
  if (suffix === 'M' || suffix === 'm') n *= 1_000_000;
  if (suffix === 'K' || suffix === 'k') n *= 1_000;
  return Math.round(n);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Injectable()
export class TiktokScraperService {
  private readonly logger = new Logger(TiktokScraperService.name);

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  @Cron('0 * * * *') // Cada hora
  async updateFollowers() {
    const db = this.databaseService.db;
    // Obtener los equipos ordenados del último al primero por id
    const allTeams = await db.select().from(teamTable).orderBy(desc(teamTable.id));
    // Seleccionar los 10 últimos (o menos si hay pocos)
    const batch = allTeams.slice(0, 10);
    const scrapedIds = new Set<number>();
    for (const team of batch) {
      if (scrapedIds.has(team.id)) continue; // Evita duplicados si cambia el orden
      try {
        const { followers, description } = await scrapeTikTokProfile(team.tiktokId);
        await db
          .update(teamTable)
          .set({ followers, description, lastScrapedAt: new Date() })
          .where(eq(teamTable.id, team.id));
        scrapedIds.add(team.id);
        this.logger.log(`Actualizado ${team.name}: ${followers} seguidores, desc: ${description}`);
      } catch (e) {
        this.logger.error(`Error actualizando ${team.name}: ${e}`);
      }
      // Espera aleatoria entre 10 y 30 segundos
      await delay(10000 + Math.random() * 20000);
    }
    return { updated: scrapedIds.size };
  }

  async onModuleInit() {
    this.updateFollowers(); // sin await, para no bloquear el arranque ni el event loop
  }
}
