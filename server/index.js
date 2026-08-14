import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./db.js";

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "stock-analyzer-secret-jwt-key-2026";

app.use(cors());
app.use(express.json());

// Auth Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = db.findUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user into DB
    const newUser = db.createUser(name.trim(), cleanEmail, password_hash);

    const userPayload = { id: newUser.id, name: newUser.name, email: newUser.email };

    // Sign JWT token
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: userPayload,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find user in DB
    const user = db.findUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const userPayload = { id: user.id, name: user.name, email: user.email };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Logged in successfully",
      token,
      user: userPayload,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", authenticateToken, (req, res) => {
  try {
    const user = db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const { password_hash, ...userProfile } = user;
    res.json({ user: userProfile });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error fetching user profile" });
  }
});

import { getStockNewsServer } from "./newsService.js";

// GET /api/stocks/:ticker/news
app.get("/api/stocks/:ticker/news", async (req, res) => {
  try {
    const { ticker } = req.params;
    const { companyName, refresh, limit } = req.query;

    if (!ticker) {
      return res.status(400).json({ message: "Stock ticker is required" });
    }

    const isForceRefresh = refresh === "true";
    const limitNum = parseInt(limit, 10) || 8;

    const result = await getStockNewsServer(ticker, companyName, isForceRefresh, limitNum);
    res.json(result);
  } catch (error) {
    console.error("[News API Error]:", error);
    res.status(500).json({
      ticker: req.params.ticker || "",
      news: [],
      source: "error",
      message: "Server error fetching stock news",
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
