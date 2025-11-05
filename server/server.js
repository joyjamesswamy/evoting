import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7100;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ----- Mongo -----
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/evotingDB";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// ----- Models -----
const userSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true }
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const pollSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    options: [{ type: String, required: true }],
    status: { type: String, enum: ["active", "closed"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

const voteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pollId: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", required: true },
    selectedOption: { type: String, required: true }
  },
  { timestamps: true }
);
voteSchema.index({ userId: 1, pollId: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
const Poll = mongoose.model("Poll", pollSchema);
const Vote = mongoose.model("Vote", voteSchema);

// ----- Auth middleware -----
const auth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ----- Routes -----
app.get("/", (req, res) => res.send("E-Voting API is up"));

// Registration: full_name, username, email, password
app.post("/api/auth/register", async (req, res) => {
  try {
    const { full_name, username, email, password } = req.body;
    if (!full_name || !username || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(400).json({ error: "Username or email already exists" });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ full_name, username, email, password: hash });
    return res.json({ user });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Login: loginId (username or email) + password
app.post("/api/auth/login", async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) return res.status(400).json({ error: "All fields required" });
    const user = await User.findOne({ $or: [{ email: loginId }, { username: loginId }] });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      { id: user._id, email: user.email, username: user.username, name: user.full_name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.json({ token, user: user.toJSON() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Create a poll (any authenticated user for demo)
app.post("/api/polls", auth, async (req, res) => {
  try {
    const { title, options } = req.body;
    if (!title || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: "Title and at least 2 options required" });
    }
    const poll = await Poll.create({ title, options, createdBy: req.user.id });
    res.json({ poll });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List polls (optionally filter by status)
app.get("/api/polls", async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const polls = await Poll.find(where).sort({ createdAt: -1 });
  res.json({ polls });
});

// Close a poll
app.post("/api/polls/:id/close", auth, async (req, res) => {
  try {
    const poll = await Poll.findByIdAndUpdate(req.params.id, { status: "closed" }, { new: true });
    res.json({ poll });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Vote on a poll
app.post("/api/polls/:id/vote", auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    if (poll.status !== "active") return res.status(400).json({ error: "Poll is closed" });
    const { option } = req.body;
    if (!option || !poll.options.includes(option)) return res.status(400).json({ error: "Invalid option" });
    const vote = await Vote.create({ userId: req.user.id, pollId: poll._id, selectedOption: option });
    res.json({ vote, message: "Vote recorded successfully" });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: "You have already voted in this poll" });
    res.status(500).json({ error: e.message });
  }
});

// Poll results
app.get("/api/polls/:id/results", async (req, res) => {
  try {
    const pollId = req.params.id;
    const poll = await Poll.findById(pollId);
    if (!poll) return res.status(404).json({ error: "Poll not found" });

    const agg = await Vote.aggregate([
      { $match: { pollId: new mongoose.Types.ObjectId(pollId) } },
      { $group: { _id: "$selectedOption", count: { $sum: 1 } } }
    ]);

    const counts = Object.fromEntries(poll.options.map(o => [o, 0]));
    agg.forEach(row => {
      counts[row._id] = row.count;
    });

    res.json({
      poll: { id: poll._id, title: poll.title, options: poll.options, status: poll.status },
      counts
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
