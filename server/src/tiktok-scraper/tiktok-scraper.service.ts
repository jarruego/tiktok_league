// Importaciones necesarias para el servicio de scraping de TikTok
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule'; // Para tareas programadas (cron jobs)
import { teamTable } from '../database/schema'; // Esquema de la tabla de equipos
import { eq, desc, isNull, isNotNull, asc } from 'drizzle-orm'; // Operadores de consulta de Drizzle ORM
import { DATABASE_PROVIDER } from '../database/database.module'; // Proveedor de base de datos
import { DatabaseService } from '../database/database.service'; // Servicio de base de datos
import puppeteer from 'puppeteer'; // Librería para automatización de navegador (web scraping)

/**
 * Función para hacer scraping de un perfil de TikTok
 * Utiliza puppeteer para abrir un navegador, navegar al perfil y extraer datos
 * @param tiktokId - El ID del usuario de TikTok (sin el @)
 * @returns Objeto con los datos del perfil: seguidores, siguiendo, likes, etc.
 */
async function scrapeTikTokProfile(tiktokId: string): Promise<{ 
  followers: number; 
  following: number;
  likes: number;
  description: string;
  displayName: string;
  profileUrl: string;
  avatarUrl: string;
}> {
  // Construir la URL del perfil de TikTok
  const url = `https://www.tiktok.com/@${tiktokId}`;
  
  // Lanzar una instancia de navegador sin interfaz gráfica (headless)
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navegar a la página del perfil con timeout de 30 segundos
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Esperar a que aparezca el elemento que contiene el número de seguidores
  await page.waitForSelector('strong[data-e2e="followers-count"]', { timeout: 15000 });
  
  // Extraer el texto del número de seguidores y convertirlo a número
  const followersText = await page.$eval('strong[data-e2e="followers-count"]', el => el.textContent || '0');
  const followers = parseTikTokFollowers(followersText);

  // Obtener número de cuentas que sigue (siguiendo)
  let following = 0;
  try {
    const followingText = await page.$eval('strong[data-e2e="following-count"]', el => el.textContent || '0');
    following = parseTikTokFollowers(followingText);
  } catch {
    // Si no se encuentra el elemento, asignar 0
    following = 0;
  }

  // Obtener número total de likes del perfil
  let likes = 0;
  try {
    const likesText = await page.$eval('strong[data-e2e="likes-count"]', el => el.textContent || '0');
    likes = parseTikTokFollowers(likesText);
  } catch {
    // Si no se encuentra el elemento, asignar 0
    likes = 0;
  }

  // Obtener la descripción/biografía del perfil
  let description = '';
  try {
    description = await page.$eval('h2[data-e2e="user-bio"]', el => el.textContent || '');
  } catch {
    // Si no tiene descripción, dejar vacío
    description = '';
  }

  // Obtener el nombre mostrado del usuario
  let displayName = '';
  try {
    displayName = await page.$eval('h1[data-e2e="user-title"]', el => el.textContent || '');
  } catch {
    // Si no se encuentra, usar el ID como fallback
    displayName = tiktokId; // Fallback al ID si no se encuentra
  }

  // Obtener la URL de la imagen de perfil (avatar)
  let avatarUrl = '';
  try {
    avatarUrl = await page.$eval('img.css-1zpj2q-ImgAvatar, img[class*="ImgAvatar"]', el => el.src || '');
  } catch {
    // Si no se encuentra, dejar vacío
    avatarUrl = '';
  }

  // Cerrar el navegador para liberar recursos
  await browser.close();

  // Retornar todos los datos extraídos
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

/**
 * Función para convertir texto de seguidores de TikTok a número
 * TikTok muestra números como "1.2M" o "500K", esta función los convierte a números enteros
 * @param text - Texto del número de seguidores (ej: "1.2M", "500K", "1234")
 * @returns Número entero correspondiente
 */
function parseTikTokFollowers(text: string): number {
  // Si no hay texto, retornar 0
  if (!text) return 0;
  
  // Buscar patrón de número seguido opcionalmente de M o K
  const match = text.match(/([\d.]+)([MK]?)$/i);
  
  // Si no coincide con el patrón, extraer solo números
  if (!match) return parseInt(text.replace(/\D/g, ''), 10) || 0;
  
  // Extraer el número y el sufijo (M o K)
  let [, num, suffix] = match;
  let n = parseFloat(num);
  
  // Convertir según el sufijo
  if (suffix === 'M' || suffix === 'm') n *= 1_000_000; // Millones
  if (suffix === 'K' || suffix === 'k') n *= 1_000;     // Miles
  
  return Math.round(n); // Redondear a número entero
}

/**
 * Función helper para crear delays/pausas en la ejecución
 * Útil para evitar ser detectado como bot por hacer requests muy rápidos
 * @param ms - Milisegundos a esperar
 * @returns Promise que se resuelve después del tiempo especificado
 */
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Servicio principal para el scraping de TikTok
 * Se encarga de actualizar automáticamente los datos de los equipos desde sus perfiles de TikTok
 */
@Injectable()
export class TiktokScraperService {
  // Logger para registrar eventos y errores
  private readonly logger = new Logger(TiktokScraperService.name);

  constructor(
    // Inyección de dependencia del servicio de base de datos
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Tarea programada que se ejecuta cada 2 minutos
   * Actualiza los datos de TikTok de los equipos de manera inteligente:
   * - Primero actualiza equipos que nunca han sido scrapeados
   * - Luego actualiza los que tienen datos más antiguos
   * - Procesa 1 equipo por ejecución para distribución natural
   */
  @Cron('*/2 * * * *') // Cada 2 minutos
  async updateFollowers() {
    const db = this.databaseService.db;
    
    // PASO 1: Obtener equipos que nunca han sido scrapeados (lastScrapedAt es NULL)
    const unscrapedTeams = await db
      .select()
      .from(teamTable)
      .where(isNull(teamTable.lastScrapedAt)) // Donde lastScrapedAt es null
      .limit(1); // Solo 1 equipo por ejecución
    
    let batch = unscrapedTeams;
    
    // PASO 2: Si no hay equipos sin scrapear, obtener el más antiguo
    if (batch.length < 1) {
      const oldestScrapedTeams = await db
        .select()
        .from(teamTable)
        .where(isNotNull(teamTable.lastScrapedAt)) // Donde lastScrapedAt no es null
        .orderBy(asc(teamTable.lastScrapedAt)) // Ordenar por fecha más antigua primero
        .limit(1); // Solo 1 equipo
      
      // Usar el equipo más antiguo
      batch = oldestScrapedTeams;
    }
    
    // PASO 3: Procesar cada equipo en el lote
    const scrapedIds = new Set<number>(); // Para evitar duplicados
    for (const team of batch) {
      // Saltar si ya procesamos este equipo (prevención de duplicados)
      if (scrapedIds.has(team.id)) continue;
      
      try {
        // Hacer scraping del perfil de TikTok del equipo
        const { followers, following, likes, description, displayName, profileUrl, avatarUrl } = await scrapeTikTokProfile(team.tiktokId);
        
        // Actualizar la base de datos con los nuevos datos
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
            lastScrapedAt: new Date() // Marcar como scrapeado ahora
          })
          .where(eq(teamTable.id, team.id));
          
        // Marcar como procesado
        scrapedIds.add(team.id);
        
        // Log de éxito
        this.logger.log(`Actualizado ${team.name}: ${followers} seguidores, ${following} siguiendo, ${likes} likes, desc: ${description}`);
      } catch (e) {
        // Log de error si falla el scraping
        this.logger.error(`Error actualizando ${team.name}: ${e}`);
      }
      
      // IMPORTANTE: Pequeño delay aleatorio para simular comportamiento humano natural
      await delay(5000 + Math.random() * 10000); // Entre 5-15 segundos
    }
    
    // Retornar resumen de la operación
    return { updated: scrapedIds.size };
  }

  /**
   * Método que se ejecuta cuando el módulo se inicializa
   * Se llama automáticamente cuando NestJS carga este servicio
   */
  async onModuleInit() {
    // NOTA: El scraping automático al iniciar está comentado para evitar sobrecarga
    // Si se descomenta, ejecutaría el scraping inmediatamente al arrancar el servidor
    // this.updateFollowers(); // sin await, para no bloquear el arranque ni el event loop
    
    // Log informativo del estado del servicio
    this.logger.log('TikTok Scraper Service iniciado. El scraping se ejecutará según el cron schedule.');
  }
}
