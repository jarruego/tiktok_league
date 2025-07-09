const { Client } = require('pg');
require('dotenv').config();

async function main() {
  // Conexión a la base de datos
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Conectado a la base de datos');

    // Consultar todas las divisiones
    const { rows } = await client.query('SELECT * FROM divisions ORDER BY level');
    console.log('Divisiones encontradas:', rows.length);
    console.log(JSON.stringify(rows, null, 2));

    // Verificar específicamente el campo tournament_slots
    console.log('\nVerificando valor de tournament_slots para División 1:');
    const div1 = rows.find(d => d.level === 1);
    if (div1) {
      console.log(`División 1 (${div1.name}) - tournament_slots:`, div1.tournament_slots);
    } else {
      console.log('No se encontró la División 1');
    }
  } catch (error) {
    console.error('Error al consultar divisiones:', error);
  } finally {
    // Cerrar la conexión
    await client.end();
  }
}

main().catch(console.error);
