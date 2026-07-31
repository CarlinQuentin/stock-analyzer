import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "users.json");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure database file exists
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2), "utf-8");
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
}

export const db = new JsonDatabase();
export default db;
