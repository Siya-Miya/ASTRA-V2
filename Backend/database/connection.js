const Database = require("better-sqlite3");
const path = require("path");

// Define where our database will live
const dbPath = path.join(__dirname, "../data/astra.db");

// Create or open the database
const db = new Database(dbPath);

// Enable foreign key relationships
db.pragma("foreign_keys = ON");

console.log("ASTRA V2 database connected!");

module.exports = db;