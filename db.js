// Shared database connection - used by all routes
const knex = require("knex");

// Support both local .env (DB_*) and AWS Elastic Beanstalk RDS (RDS_*)
const db = knex({
  client: "pg",
  connection: {
    host: process.env.RDS_HOSTNAME || process.env.DB_HOST,
    user: process.env.RDS_USERNAME || process.env.DB_USER,
    password: process.env.RDS_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.RDS_DB_NAME || process.env.DB_NAME,
    port: process.env.RDS_PORT || 5432,
    ssl: process.env.RDS_SSL ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
});

module.exports = db;

