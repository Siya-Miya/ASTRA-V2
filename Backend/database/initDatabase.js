const fs = require("fs");
const path = require("path");

const db = require("./connection");

// Read the SQL schema file
const schemaPath = path.join(__dirname, "schema.sql");

const schema = fs.readFileSync(schemaPath, "utf8");

// Execute the SQL commands
db.exec(schema);

console.log("ASTRA V2 database tables initialized!");