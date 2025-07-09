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

    // Actualizar el valor de tournament_slots para la División 1
    const result = await client.query(
      'UPDATE divisions SET tournament_slots = 8 WHERE level = 1 RETURNING *'
    );
    
    if (result.rows.length > 0) {
      console.log('Actualización exitosa:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('No se encontró la División 1 para actualizar');
    }
  } catch (error) {
    console.error('Error al actualizar la división:', error);
  } finally {
    // Cerrar la conexión
    await client.end();
  }
}

main().catch(console.error);
