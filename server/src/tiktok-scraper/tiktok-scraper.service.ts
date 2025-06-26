import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { teamTable } from '../database/schema';
import { eq, desc, isNull, isNotNull, asc } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import puppeteer from 'puppeteer';

// Scraper real de TikTok usando puppeteer
async function scrapeTikTokProfile(tiktokId: string): Promise<{ 
  followers: number; 
  following: number;
  likes: number;
  description: string;
  displayName: string;
  profileUrl: string;
  avatarUrl: string;
}> {
  const url = `https://www.tiktok.com/@${tiktokId}`;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Espera a que cargue el número de seguidores
  await page.waitForSelector('strong[data-e2e="followers-count"]', { timeout: 15000 });
  
  // Obtener seguidores
  const followersText = await page.$eval('strong[data-e2e="followers-count"]', el => el.textContent || '0');
  const followers = parseTikTokFollowers(followersText);

  // Obtener siguiendo
  let following = 0;
  try {
    const followingText = await page.$eval('strong[data-e2e="following-count"]', el => el.textContent || '0');
    following = parseTikTokFollowers(followingText);
  } catch {
    following = 0;
  }

  // Obtener likes totales
  let likes = 0;
  try {
    const likesText = await page.$eval('strong[data-e2e="likes-count"]', el => el.textContent || '0');
    likes = parseTikTokFollowers(likesText);
  } catch {
    likes = 0;
  }

  // Obtener descripción del perfil
  let description = '';
  try {
    description = await page.$eval('h2[data-e2e="user-bio"]', el => el.textContent || '');
  } catch {
    description = '';
  }

  // Obtener nombre mostrado
  let displayName = '';
  try {
    displayName = await page.$eval('h1[data-e2e="user-title"]', el => el.textContent || '');
  } catch {
    displayName = tiktokId; // Fallback al ID si no se encuentra
  }

  // Obtener URL del avatar
  let avatarUrl = '';
  try {
    avatarUrl = await page.$eval('img.css-1zpj2q-ImgAvatar, img[class*="ImgAvatar"]', el => el.src || '');
  } catch {
    avatarUrl = '';
  }

  await browser.close();

  return { 
    followers, 
    following, 
    likes, 
    description, 
    displayName, 
    profileUrl: url, 
    avatarUrl 
  };
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
    // Primero obtener equipos que nunca han sido scrapeados (lastScrapedAt es NULL)
    const unscrapedTeams = await db
      .select()
      .from(teamTable)
      .where(isNull(teamTable.lastScrapedAt))
      .limit(10);
    
    let batch = unscrapedTeams;
    
    // Si no hay suficientes equipos sin scrapear, completar con los más antiguos
    if (batch.length < 10) {
      const remainingSlots = 10 - batch.length;
      const oldestScrapedTeams = await db
        .select()
        .from(teamTable)
        .where(isNotNull(teamTable.lastScrapedAt))
        .orderBy(asc(teamTable.lastScrapedAt))
        .limit(remainingSlots);
      
      batch = [...batch, ...oldestScrapedTeams];
    }
    
    const scrapedIds = new Set<number>();
    for (const team of batch) {
      if (scrapedIds.has(team.id)) continue; // Evita duplicados si cambia el orden
      try {
        const { followers, following, likes, description, displayName, profileUrl, avatarUrl } = await scrapeTikTokProfile(team.tiktokId);
        await db
          .update(teamTable)
          .set({ 
            followers, 
            following, 
            likes, 
            description, 
            displayName, 
            profileUrl, 
            avatarUrl, 
            lastScrapedAt: new Date() 
          })
          .where(eq(teamTable.id, team.id));
        scrapedIds.add(team.id);
        this.logger.log(`Actualizado ${team.name}: ${followers} seguidores, ${following} siguiendo, ${likes} likes, desc: ${description}`);
      } catch (e) {
        this.logger.error(`Error actualizando ${team.name}: ${e}`);
      }
      // Espera aleatoria entre 10 y 30 segundos
      await delay(10000 + Math.random() * 20000);
    }
    return { updated: scrapedIds.size };
  }

  async onModuleInit() {
    // Comentado para evitar scraping automático al iniciar el servidor
    // this.updateFollowers(); // sin await, para no bloquear el arranque ni el event loop
    this.logger.log('TikTok Scraper Service iniciado. El scraping se ejecutará según el cron schedule.');
  }
}
