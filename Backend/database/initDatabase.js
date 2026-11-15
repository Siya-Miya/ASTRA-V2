const fs = require("fs");
const path = require("path");

const db = require("./connection");

// Read and execute the SQL schema.
const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema);

// Add a column only if it does not already exist.
function ensureColumn(tableName, columnName, columnDefinition) {

    const columns = db.prepare(
        `PRAGMA table_info(${tableName})`
    ).all();

    const columnExists = columns.some(
        column => column.name === columnName
    );

    if (!columnExists) {
        db.exec(
            `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
        );
    }

}

// Store ASTRA's response alongside each event.
ensureColumn(
    "alerts",
    "astra_response_json",
    "TEXT"
);

ensureColumn(
    "health_reports",
    "astra_response_json",
    "TEXT"
);

ensureColumn(
    "alerts",
    "report_id",
    "INTEGER REFERENCES health_reports(id)"
);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_alerts_report_id
    ON alerts(report_id)
`);

console.log("ASTRA V2 database tables initialized!");