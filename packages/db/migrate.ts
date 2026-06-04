import fs from "fs";
import {pool} from "./pool";
import dotenv from "dotenv";
dotenv.config();

const sql = fs.readFileSync('./packages/db/migrations/002_remove_attempt_columns.sql', 'utf-8');

export const runMigrations = async () => {
    try {
        await pool.query(sql);
        console.log('Migrations ran successfully');
    } catch (error) {
        console.error('Error running migrations:', error);
    } finally {
        await pool.end();
    }
};

runMigrations();