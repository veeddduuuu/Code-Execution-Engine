import fs from "fs";
import { pool } from "./pool";
import dotenv from "dotenv";
dotenv.config();


const sql1 = fs.readFileSync('./packages/db/migrations/001_create_jobs_table.sql', 'utf-8');
const sql2 = fs.readFileSync('./packages/db/migrations/002_remove_attempt_columns.sql', 'utf-8');
const sql3 = fs.readFileSync('./packages/db/migrations/003_create_idempotency_table.sql', 'utf-8');
const sql4 = fs.readFileSync('./packages/db/migrations/004_add_cancelled_jobs_enum.sql', 'utf-8');

export const runMigrations = async () => {
    try {
        await pool.query(sql1);
        await pool.query(sql2);
        await pool.query(sql3);
        await pool.query(sql4);
        console.log('Migrations ran successfully');
    } catch (error) {
        console.error('Error running migrations:', error);
    } finally {
        await pool.end();
    }
};

runMigrations();