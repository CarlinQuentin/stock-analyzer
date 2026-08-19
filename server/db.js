import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "users.json");
const savedStocksDbPath = path.join(dataDir, "saved_stocks.json");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure database files exist
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2), "utf-8");
}
if (!fs.existsSync(savedStocksDbPath)) {
  fs.writeFileSync(savedStocksDbPath, JSON.stringify([], null, 2), "utf-8");
}

class JsonDatabase {
  getUsers() {
    try {
      const data = fs.readFileSync(dbPath, "utf-8");
      return JSON.parse(data) || [];
    } catch (err) {
      return [];
    }
  }

  saveUsers(users) {
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2), "utf-8");
  }

  findUserByEmail(email) {
    const users = this.getUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  findUserById(id) {
    const users = this.getUsers();
    return users.find((u) => u.id === id) || null;
  }

  createUser(name, email, password_hash) {
    const users = this.getUsers();
    const newId = users.length > 0 ? Math.max(...users.map((u) => u.id || 0)) + 1 : 1;
    const newUser = {
      id: newId,
      name,
      email: email.toLowerCase(),
      password_hash,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    this.saveUsers(users);
    return newUser;
  }

  // --- Saved Stocks Database Store ---
  getAllSavedStocks() {
    try {
      const data = fs.readFileSync(savedStocksDbPath, "utf-8");
      return JSON.parse(data) || [];
    } catch (err) {
      return [];
    }
  }

  saveAllSavedStocks(records) {
    fs.writeFileSync(savedStocksDbPath, JSON.stringify(records, null, 2), "utf-8");
  }

  getSavedStocks(userId) {
    if (!userId) return [];
    const all = this.getAllSavedStocks();
    const strUserId = String(userId);
    return all.filter((s) => String(s.user_id) === strUserId);
  }

  saveStock(userId, ticker) {
    if (!userId || !ticker) return [];
    const cleanTicker = ticker.trim().toUpperCase();
    const strUserId = String(userId);
    const all = this.getAllSavedStocks();

    const existingIndex = all.findIndex(
      (s) => String(s.user_id) === strUserId && s.ticker.toUpperCase() === cleanTicker
    );

    if (existingIndex < 0) {
      const newRecord = {
        id: `stock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: strUserId,
        ticker: cleanTicker,
        created_at: new Date().toISOString(),
      };
      all.unshift(newRecord);
      this.saveAllSavedStocks(all);
    }

    return this.getSavedStocks(userId);
  }

  removeStock(userId, ticker) {
    if (!userId || !ticker) return [];
    const cleanTicker = ticker.trim().toUpperCase();
    const strUserId = String(userId);
    const all = this.getAllSavedStocks();

    const filtered = all.filter(
      (s) => !(String(s.user_id) === strUserId && s.ticker.toUpperCase() === cleanTicker)
    );
    this.saveAllSavedStocks(filtered);

    return this.getSavedStocks(userId);
  }
}

export const db = new JsonDatabase();
export default db;
