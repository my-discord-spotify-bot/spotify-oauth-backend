import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Ajoute cette fonction pour mettre à jour un compte
async function updateAccount(userId, updates) {
  const client = await pool.connect();
  try {
    const queryText = 'UPDATE accounts SET access_token = $1 WHERE user_id = $2 RETURNING *';
    const values = [updates.access_token, userId];
    const result = await client.query(queryText, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export default {
  query: (text, params) => pool.query(text, params),
  updateAccount, // Ajoute la fonction updateAccount à l'export
};
