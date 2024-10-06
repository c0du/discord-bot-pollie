// actives/poll.js
const mongoose = require("mongoose");

const PollSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true }, // Track the poll message
  question: { type: String, required: true },
  options: { type: [String], required: true }, // Main poll choices
  randomizerOptions: { type: [String], required: false }, // Options for recurrence
  voteMode: { type: String, enum: ["single", "multiple"], required: true },
  authorId: { type: String, required: true },
  authorUsername: { type: String, required: true },
  authorAvatarURL: { type: String, required: false },
  startDate: { type: Date, required: true },
  duration: { type: String, required: true }, // e.g., "1m", "5m"
  endDate: { type: Date, required: true },
  recurrence: { type: String, default: "none" }, // e.g., "1m", "5m", "1h", etc.
  nextRun: { type: Date, required: false },
});

module.exports = mongoose.model("Poll", PollSchema);
