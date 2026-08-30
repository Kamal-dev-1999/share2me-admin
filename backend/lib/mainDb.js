'use strict';

const { Pool } = require('pg');

const mainPool = new Pool({
  connectionString: process.env.MAIN_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

module.exports = {
  query: (text, params) => mainPool.query(text, params),
  pool: mainPool,
};
