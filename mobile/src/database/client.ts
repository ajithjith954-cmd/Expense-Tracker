import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import { APP_DATABASE_NAME, type SqlClient } from "./sql";

let opening: Promise<SqlClient> | null = null;

export function getDatabase(): Promise<SqlClient> {
  opening ??= openDatabase();
  return opening;
}

async function openDatabase(): Promise<SqlClient> {
  const database = await SQLite.openDatabaseAsync(APP_DATABASE_NAME);
  await database.execAsync("PRAGMA foreign_keys = ON");
  if (Platform.OS !== "web") {
    await database.execAsync("PRAGMA journal_mode = WAL");
  }
  return {
    exec: (sql) => database.execAsync(sql),
    run: (sql, params = []) => database.runAsync(sql, params).then(() => undefined),
    all: (sql, params = []) => database.getAllAsync(sql, params),
    get: (sql, params = []) => database.getFirstAsync(sql, params),
  };
}
