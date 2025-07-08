// Importaciones necesarias para el servicio de scraping de TikTok
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule'; // Para tareas programadas (cron jobs)
import { teamTable } from '../database/schema'; // Esquema de la tabla de equipos
import { eq, desc, isNull, isNotNull, asc } from 'drizzle-orm'; // Operadores de consulta de Drizzle ORM
import { DATABASE_PROVIDER } from '../database/database.module'; // Proveedor de base de datos
import { DatabaseService } from '../database/database.service'; // Servicio de base de datos
import { FootballDataCacheService } from '../football-data/football-data-cache.service'; // Servicio de cache
import { PlayerService } from '../players/player.service'; // Servicio de jugadores
import puppeteer from 'puppeteer'; // Librería para automatización de navegador (web scraping)

/**
 * Configuración específica de Puppeteer para entornos de producción como Render
 */
const getPuppeteerConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;
  
  if (isProduction || isRender) {
    return {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--enable-automation=false',
        '--disable-blink-features=AutomationControlled'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    };
  }
  
  return {
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--enable-automation=false',
      '--disable-blink-features=AutomationControlled'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  };
};

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
  let browser;
  try {
    // Construir la URL del perfil de TikTok
    const url = `https://www.tiktok.com/@${tiktokId}`;
    
    // Lanzar una instancia de navegador con configuración optimizada para producción
    const puppeteerConfig = getPuppeteerConfig();
    console.log(`🚀 Lanzando navegador con configuración:`, { 
      headless: puppeteerConfig.headless, 
      argsCount: puppeteerConfig.args.length 
    });
      browser = await puppeteer.launch(puppeteerConfig);
    const page = await browser.newPage();

    // Configuración anti-detección
    await page.evaluateOnNewDocument(() => {
      // Eliminar propiedades que indican automatización
      delete (navigator as any).webdriver;
      
      // Redefinir la propiedad plugins para simular un navegador real
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Redefinir languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['es-ES', 'es', 'en'],
      });
      
      // Mock de chrome object
      (window as any).chrome = {
        runtime: {},
      };
    });

    // Establecer viewport realista para móvil
    await page.setViewport({ 
      width: 375, 
      height: 812, 
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });

    // User-Agent más actualizado y específico para móvil
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    
    // Headers más realistas
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    // Navegar con configuración más robusta y manejo de errores específicos
    console.log(`🔍 Iniciando navegación a: ${url}`);
    
    try {
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded', // Cambiar de networkidle2 a domcontentloaded
        timeout: 45000 
      });
      
      if (!response) {
        throw new Error('No response received from TikTok');
      }
      
      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }
      
      console.log(`✅ Página cargada exitosamente: ${response.status()}`);
      
    } catch (navigationError) {
      console.error(`❌ Error en navegación: ${navigationError.message}`);
      throw new Error(`Failed to navigate to TikTok: ${navigationError.message}`);
    }

    // Esperar un momento para que la página se estabilice
    await delay(3000);

    // Intentar detectar si estamos bloqueados
    const isBlocked = await page.evaluate(() => {
      return document.body.innerText.includes('captcha') || 
             document.body.innerText.includes('blocked') ||
             document.body.innerText.includes('verify') ||
             document.title.includes('Just a moment');
    });

    if (isBlocked) {
      throw new Error('TikTok está requiriendo verificación - perfil temporalmente inaccesible');
    }

    console.log(`🔍 Iniciando scraping de: ${url}`);

    // Esperar a que aparezca el elemento que contiene el número de seguidores
    // --- NUEVO: Scroll, delay y dump de HTML antes de buscar selectores ---
    await delay(2000 + Math.random() * 2000); // Espera extra aleatoria
    try {
      await page.mouse.move(100, 200); // Simula movimiento de mouse
      await page.mouse.move(200, 300);
      await page.mouse.move(300, 400);
    } catch {}
    try {
      await page.evaluate(() => window.scrollBy(0, 200));
      await delay(1000);
      await page.evaluate(() => window.scrollBy(0, 400));
      await delay(1000);
    } catch {}
    // Dump parcial de HTML para debug (solo si debug ON)
    try {
      const html = await page.content();
      console.log('--- HTML parcial para debug (primeros 5000 chars): ---');
      console.log(html.slice(0, 5000));
    } catch {}

    let selectorFound = false;
    const allSelectors = [
      'strong[data-e2e="followers-count"]',
      'strong[title*="Follower"]',
      'strong[title*="follower"]',
      'div[data-e2e="followers-count"]',
      'span[data-e2e="followers-count"]'
    ];
    let lastSelector = '';
    for (const selector of allSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 12000 }); // Aumenta timeout
        console.log(`✅ Selector encontrado: ${selector}`);
        selectorFound = true;
        lastSelector = selector;
        break;
      } catch (err) {
        continue;
      }
    }

    if (!selectorFound) {
      console.error(`❌ Ningún selector funcionó para ${tiktokId}, intentando guardar screenshot y HTML para debug`);
      try {
        if (!page.isClosed()) {
          await page.screenshot({ path: `debug-${tiktokId}.png` });
          const html = await page.content();
          const fs = require('fs');
          fs.writeFileSync(`debug-${tiktokId}.html`, html);
        } else {
          console.error('⚠️ La página ya estaba cerrada, no se pudo guardar screenshot ni HTML');
        }
      } catch (err) {
        console.error('⚠️ Error al intentar guardar screenshot/HTML:', err);
      }
      if (browser && browser.close) await browser.close();
      throw new Error(`No se pudieron encontrar los elementos de TikTok para ${tiktokId}`);
    }
    
    // Extraer el texto del número de seguidores y convertirlo a número
    let followersText = '';
    try {
      followersText = await page.$eval(lastSelector || 'strong[data-e2e="followers-count"]', el => el.textContent || '0');
      console.log(`✅ Seguidores obtenidos con selector: ${lastSelector} -> ${followersText}`);
    } catch (err) {
      console.error('❌ Error extrayendo el número de seguidores:', err);
      followersText = '0';
    }
    
    console.log(`📊 Texto de seguidores capturado: "${followersText}"`);
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
    let likesText = '';
    try {
      likesText = await page.$eval('strong[data-e2e="likes-count"]', el => el.textContent || '0');
      console.log(`❤️ Texto de likes capturado: "${likesText}"`);
      likes = parseTikTokFollowers(likesText);
    } catch (error) {
      console.warn(`⚠️ No se encontró el selector principal de likes para ${tiktokId}, intentando alternativas...`);
      
      // Intentar selectores alternativos para likes
      const alternativeSelectors = [
        'strong[title*="Like"]',
        'strong[title*="like"]', 
        'div[data-e2e="likes-count"]',
        'span[data-e2e="likes-count"]'
      ];
      
      for (const selector of alternativeSelectors) {
        try {
          likesText = await page.$eval(selector, el => el.textContent || '0');
          console.log(`✅ Likes obtenidos con selector alternativo: ${selector} -> "${likesText}"`);
          likes = parseTikTokFollowers(likesText);
          break;
        } catch {
          continue;
        }
      }
      
      if (likes === 0) {
        console.error(`❌ No se pudieron obtener los likes para ${tiktokId}`);
      }
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

    console.log(`✅ Scraping completado para ${tiktokId}:`, {
      followers,
      following, 
      likes,
      displayName,
      description: description.substring(0, 50) + '...'
    });

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
  } catch (error) {
    // Manejar errores de Puppeteer específicos
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn(`⚠️ Error cerrando navegador: ${closeError.message}`);
      }
    }
    
    const errorMessage = error.message || error.toString();
    
    // Errores específicos de Chrome/Puppeteer
    if (errorMessage.includes('Could not find Chrome')) {
      console.error(`❌ Error de Chrome/Puppeteer para ${tiktokId}:`, errorMessage);
      throw new Error(`Chrome no está disponible en el servidor. El scraping de TikTok está temporalmente deshabilitado.`);
    }
    
    // Error específico de frame detached
    if (errorMessage.includes('Navigating frame was detached') || 
        errorMessage.includes('frame was detached') ||
        errorMessage.includes('Target closed')) {
      console.error(`❌ Frame detached para ${tiktokId} - TikTok posiblemente detectó automatización`);
      throw new Error(`TikTok detectó automatización para ${tiktokId}. Reintentando más tarde.`);
    }
    
    // Error de timeout en navegación
    if (errorMessage.includes('Navigation timeout') || 
        errorMessage.includes('TimeoutError')) {
      console.error(`❌ Timeout navegando a ${tiktokId}`);
      throw new Error(`Timeout accediendo al perfil de ${tiktokId}. Red lenta o perfil inaccesible.`);
    }
    
    // Error de verificación/captcha
    if (errorMessage.includes('captcha') || 
        errorMessage.includes('verification') ||
        errorMessage.includes('verificación')) {
      console.error(`❌ Verificación requerida para ${tiktokId}`);
      throw new Error(`TikTok requiere verificación para acceder a ${tiktokId}.`);
    }
    
    console.error(`❌ Error durante el scraping de ${tiktokId}:`, error);
    throw error;
  }
}

/**
 * Función para convertir texto de seguidores de TikTok a número
 * TikTok muestra números como "1.2M" o "500K" o "1.6B", esta función los convierte a números enteros
 * @param text - Texto del número de seguidores (ej: "1.2M", "500K", "1.6B", "1234")
 * @returns Número entero correspondiente
 */
function parseTikTokFollowers(text: string): number {
  // Si no hay texto, retornar 0
  if (!text) return 0;
  
  // Limpiar el texto removiendo espacios y caracteres no deseados
  const cleanText = text.trim();
  
  // Buscar patrón de número seguido opcionalmente de B, M o K
  const match = cleanText.match(/([\d.]+)([BMK]?)$/i);
  
  // Si no coincide con el patrón, extraer solo números
  if (!match) {
    const numberOnly = parseInt(cleanText.replace(/\D/g, ''), 10) || 0;
    console.log(`Parsed number without suffix: ${cleanText} -> ${numberOnly}`);
    return numberOnly;
  }
  
  // Extraer el número y el sufijo (B, M o K)
  let [, num, suffix] = match;
  let n = parseFloat(num);
  
  // Convertir según el sufijo
  if (suffix === 'B' || suffix === 'b') n *= 1_000_000_000; // Billones (miles de millones)
  if (suffix === 'M' || suffix === 'm') n *= 1_000_000; // Millones
  if (suffix === 'K' || suffix === 'k') n *= 1_000;     // Miles
  
  const result = Math.round(n);
  console.log(`Parsed TikTok number: ${cleanText} -> ${result}`);
  return result; // Redondear a número entero
}

/**
 * Función helper para crear delays/pausas en la ejecución
 * Útil para evitar ser detectado como bot por hacer requests muy rápidos
 * NOTA: Reemplaza page.waitForTimeout() que fue removido en Puppeteer v23+
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
    // Servicios para importación automática desde cache
    private readonly footballDataCacheService: FootballDataCacheService,
    private readonly playerService: PlayerService,
  ) {}

  /**
   * Método para importar automáticamente datos de Football-Data desde cache
   * Se ejecuta después del scraping de TikTok si el equipo tiene IDs configurados
   */
  private async autoImportFromCache(team: any): Promise<{ imported: boolean; message: string }> {
    // Verificar si el equipo tiene footballDataId y competitionId configurados
    if (!team.footballDataId || !team.competitionId) {
      return { 
        imported: false, 
        message: `Equipo ${team.name} no tiene footballDataId (${team.footballDataId}) o competitionId (${team.competitionId}) configurados` 
      };
    }

    try {
      // 1. Verificar que la competición esté cacheada
      const cachedData = await this.footballDataCacheService.getCachedCompetition(team.competitionId);
      
      // 2. Buscar el equipo específico en los datos cacheados
      const teams = cachedData.competition.teams;
      const teamData = teams.find((t: any) => t.id === team.footballDataId);
      
      if (!teamData) {
        return {
          imported: false,
          message: `Equipo con Football-Data ID ${team.footballDataId} no encontrado en competición cacheada ${team.competitionId}`
        };
      }

      // 3. Importar usando el servicio existente
      const importResult = await this.playerService.importFromFootballData(teamData, {
        teamId: team.id,
        footballDataTeamId: team.footballDataId,
        competitionId: team.competitionId,
        source: `auto-import-after-tiktok-scraping`
      });

      // Adaptarse a la nueva estructura de respuesta
      const syncStats = importResult.synchronization?.summary || {};
      const newPlayersCount = syncStats.added || 0;
      const departedPlayers = syncStats.departed || 0;
      const updatedPlayers = syncStats.updated || 0;
      const hasUpdates = newPlayersCount > 0 || departedPlayers > 0 || updatedPlayers > 0;

      if (hasUpdates) {
        this.logger.log(`✅ Auto-import exitoso para ${team.name}: ${newPlayersCount} nuevos, ${departedPlayers} dados de baja, ${updatedPlayers} actualizados`);
      } else {
        this.logger.log(`✅ Auto-import exitoso para ${team.name}: información del equipo actualizada, sin cambios en jugadores`);
      }
      
      return {
        imported: true,
        message: hasUpdates 
          ? `Sincronización completa: ${newPlayersCount} nuevos, ${departedPlayers} dados de baja, ${updatedPlayers} actualizados`
          : `Información del equipo actualizada desde cache, sin cambios en jugadores`
      };

    } catch (error) {
      this.logger.warn(`⚠️ Error en auto-import para ${team.name}: ${error.message}`);
      return {
        imported: false,
        message: `Error en auto-import: ${error.message}`
      };
    }
  }

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
        
        // Log de éxito del scraping
        this.logger.log(`📱 TikTok actualizado ${team.name}: ${followers} seguidores, ${following} siguiendo, ${likes} likes`);
        
        // Auto-importar desde cache si tiene Football-Data IDs configurados
        const importResult = await this.autoImportFromCache(team);
        if (importResult.imported) {
          this.logger.log(`⚽ ${importResult.message}`);
        } else {
          this.logger.debug(`⏭️ Sin auto-import: ${importResult.message}`);
        }
      } catch (e) {
        const errorMessage = e.message || e.toString();
        
        // Manejo específico de errores de Chrome/Puppeteer
        if (errorMessage.includes('Could not find Chrome')) {
          this.logger.error(`🚫 Chrome no disponible para ${team.name}. Saltando scraping hasta que Chrome esté disponible.`);
          // No marcamos como scrapeado para intentar de nuevo más tarde
          continue;
        } else if (errorMessage.includes('Chrome no está disponible en el servidor')) {
          this.logger.warn(`⚠️ Scraping temporalmente deshabilitado para ${team.name}: Chrome no disponible`);
          continue;
        }
        
        // Manejo específico de errores de detección/frame detached
        if (errorMessage.includes('detectó automatización') || 
            errorMessage.includes('frame was detached') ||
            errorMessage.includes('Navigating frame was detached')) {
          this.logger.warn(`🤖 TikTok detectó automatización para ${team.name}. Aplicando delay adicional y reintentando más tarde.`);
          // No marcamos como scrapeado para reintentar más tarde con delay mayor
          await delay(30000 + Math.random() * 30000); // Delay adicional de 30-60 segundos
          continue;
        }
        
        // Manejo de errores de verificación/captcha
        if (errorMessage.includes('verificación') || 
            errorMessage.includes('captcha') ||
            errorMessage.includes('verification')) {
          this.logger.warn(`🔐 TikTok requiere verificación para ${team.name}. Saltando temporalmente.`);
          // Marcamos como procesado pero con timestamp antiguo para reintentar en unas horas
          await db
            .update(teamTable)
            .set({ 
              lastScrapedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 horas atrás
            })
            .where(eq(teamTable.id, team.id));
          scrapedIds.add(team.id);
          continue;
        }
        
        // Manejo de errores de timeout
        if (errorMessage.includes('timeout') || 
            errorMessage.includes('TimeoutError')) {
          this.logger.warn(`⏰ Timeout para ${team.name}. Red lenta o perfil inaccesible.`);
          // No marcamos como scrapeado para reintentar más tarde
          continue;
        }
        
        // Log de error si falla el scraping por otras razones
        this.logger.error(`❌ Error actualizando ${team.name}: ${errorMessage}`);
        
        // Para otros errores, aún marcamos como "procesado" para evitar que se quede atascado
        scrapedIds.add(team.id);
      }
      
      // IMPORTANTE: Pequeño delay aleatorio para simular comportamiento humano natural
      await delay(5000 + Math.random() * 10000); // Entre 5-15 segundos
    }
    
    // Retornar resumen de la operación
    return { updated: scrapedIds.size };
  }

  /**
   * Método para forzar auto-import de un equipo específico (útil para testing)
   */
  async forceAutoImportForTeam(teamId: number): Promise<any> {
    const db = this.databaseService.db;
    
    // Obtener los datos del equipo
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, teamId));
    
    if (!team) {
      throw new Error(`Equipo con ID ${teamId} no encontrado`);
    }

    const importResult = await this.autoImportFromCache(team);
    
    return {
      teamId,
      teamName: team.name,
      ...importResult
    };
  }

  /**
   * Método para probar scraping de un equipo específico (útil para debugging)
   */
  async testScrapingForTeam(teamId: number): Promise<any> {
    const db = this.databaseService.db;
    
    // Obtener los datos del equipo
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, teamId));
    
    if (!team) {
      throw new Error(`Equipo con ID ${teamId} no encontrado`);
    }

    try {
      // Hacer scraping del perfil de TikTok del equipo
      const scrapingResult = await scrapeTikTokProfile(team.tiktokId);
      
      return {
        success: true,
        teamId,
        teamName: team.name,
        tiktokId: team.tiktokId,
        scrapingResult,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        teamId,
        teamName: team.name,
        tiktokId: team.tiktokId,
        error: error.message,
        timestamp: new Date()
      };
    }
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
