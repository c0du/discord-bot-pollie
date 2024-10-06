// index.js
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const dotenv = require("dotenv");
const winston = require("winston");
const express = require("express");
const path = require("node:path");
const fs = require("fs");
const { showPollPreview } = require("./utils/pollPreview");
const { postPoll, endPoll, activePolls } = require("./utils/pollUtils");
const Poll = require("./actives/poll"); // Updated path
const mongoose = require("mongoose");

// Load environment variables from .env file
dotenv.config();

// Initialize Winston logger for structured logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
      ({ timestamp, level, message }) =>
        `${timestamp} [${level.toUpperCase()}]: ${message}`,
    ),
  ),
  transports: [new winston.transports.Console()],
});

// Add file transport in production
if (process.env.NODE_ENV === "production") {
  logger.add(new winston.transports.File({ filename: "app.log" }));
}

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions, // Added to handle reactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Collection to store commands
client.commands = new Collection();

// Load command files from the 'commands' directory
const commandsPath = path.join(__dirname, "commands");
const commandFilesList = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFilesList) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (command.data && command.data.name) {
    client.commands.set(command.data.name, command);
  }
}

// Store selected poll data globally
let storedPollData = null;

// Event: Bot is ready
client.once("ready", async () => {
  logger.info(`✅ Logged in as ${client.user.tag}!`);

  // Connect to MongoDB without deprecated options
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => logger.info("✅ Connected to MongoDB"))
    .catch((error) =>
      logger.error(`❌ MongoDB connection error: ${error.message}`),
    );

  // Load active polls from the database
  const activePollsDB = await Poll.find({ endDate: { $gt: new Date() } });
  activePollsDB.forEach((poll) => {
    activePolls.set(poll.messageId, { voteMode: poll.voteMode });

    const timeUntilEnd = poll.endDate.getTime() - Date.now();
    if (timeUntilEnd > 0) {
      setTimeout(() => endPoll(poll._id, client), timeUntilEnd);
    } else {
      endPoll(poll._id, client);
    }
  });
});

// Event: Handling interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
      logger.info(`✅ Executed command: ${interaction.commandName}`);
    } catch (error) {
      logger.error(`❌ Error executing command: ${error.message}`);
      await interaction.reply({
        content: "There was an error executing this command.",
        ephemeral: true,
      });
    }
  } else if (interaction.isModalSubmit()) {
    try {
      const pollQuestion = interaction.fields.getTextInputValue("pollQuestion");
      const firstChoice = interaction.fields.getTextInputValue("firstChoice");
      const secondChoice = interaction.fields.getTextInputValue("secondChoice");
      const additionalChoicesRaw =
        interaction.fields.getTextInputValue("additionalChoices") || "";
      const recurrenceRandomizerRaw =
        interaction.fields.getTextInputValue("recurrenceRandomizer") || "";

      const additionalChoices = additionalChoicesRaw
        .split("\n")
        .map((choice) => choice.trim())
        .filter((choice) => choice.length > 0);

      const recurrenceRandomizer = recurrenceRandomizerRaw
        .split("\n")
        .map((choice) => choice.trim())
        .filter((choice) => choice.length > 0);

      const pollData = {
        question: pollQuestion,
        choices: [firstChoice, secondChoice, ...additionalChoices],
        randomizerOptions: recurrenceRandomizer,
      };

      storedPollData = pollData; // Store the poll data globally

      await showPollPreview(interaction, pollData);
    } catch (error) {
      logger.error(`❌ Error processing modal submission: ${error.message}`);
      await interaction.reply({
        content: "There was an error processing the poll.",
        ephemeral: true,
      });
    }
  } else if (interaction.isStringSelectMenu()) {
    try {
      logger.info(
        `📥 Dropdown interaction: ${interaction.customId} selected: ${interaction.values}`,
      );

      let updatedVoteModeSelect;
      let updatedDurationSelect;
      let updatedRecurrenceSelect;

      // Ensure custom_id is unique
      if (interaction.customId.startsWith("voteMode")) {
        const voteMode = interaction.values[0];
        storedPollData.voteMode = voteMode;

        updatedVoteModeSelect = new StringSelectMenuBuilder()
          .setCustomId("voteMode-" + interaction.id)
          .setPlaceholder("Select voting mode")
          .addOptions([
            {
              label: "Single choice",
              value: "single",
              default: voteMode === "single",
            },
            {
              label: "Multiple choices",
              value: "multiple",
              default: voteMode === "multiple",
            },
          ]);
        updatedDurationSelect = interaction.message.components[1].components[0];
        updatedRecurrenceSelect =
          interaction.message.components[2].components[0];
      } else if (interaction.customId.startsWith("pollDuration")) {
        const duration = interaction.values[0];
        storedPollData.duration = duration;

        updatedDurationSelect = new StringSelectMenuBuilder()
          .setCustomId("pollDuration-" + interaction.id)
          .setPlaceholder("Select poll duration")
          .addOptions([
            { label: "1 minute", value: "1m", default: duration === "1m" },
            { label: "5 minutes", value: "5m", default: duration === "5m" },
            { label: "10 minutes", value: "10m", default: duration === "10m" },
            { label: "1 hour", value: "1h", default: duration === "1h" },
            { label: "1 day", value: "1d", default: duration === "1d" },
          ]);
        updatedVoteModeSelect = interaction.message.components[0].components[0];
        updatedRecurrenceSelect =
          interaction.message.components[2].components[0];
      } else if (interaction.customId.startsWith("pollRecurrence")) {
        const recurrence = interaction.values[0];
        storedPollData.recurrence = recurrence;

        updatedRecurrenceSelect = new StringSelectMenuBuilder()
          .setCustomId("pollRecurrence-" + interaction.id)
          .setPlaceholder("Select poll recurrence")
          .addOptions([
            {
              label: "Does not repeat",
              value: "none",
              default: recurrence === "none",
            },
            {
              label: "Every 1 minute",
              value: "1m",
              default: recurrence === "1m",
            },
            {
              label: "Every 5 minutes",
              value: "5m",
              default: recurrence === "5m",
            },
            {
              label: "Every 1 hour",
              value: "1h",
              default: recurrence === "1h",
            },
            { label: "Every day", value: "1d", default: recurrence === "1d" },
          ]);
        updatedVoteModeSelect = interaction.message.components[0].components[0];
        updatedDurationSelect = interaction.message.components[1].components[0];
      }

      const voteModeRow = new ActionRowBuilder().addComponents(
        updatedVoteModeSelect,
      );
      const durationRow = new ActionRowBuilder().addComponents(
        updatedDurationSelect,
      );
      const recurrenceRow = new ActionRowBuilder().addComponents(
        updatedRecurrenceSelect,
      );

      const submitButton = new ButtonBuilder()
        .setCustomId("submitPoll-" + interaction.id) // Unique ID
        .setLabel("Submit Poll")
        .setStyle(ButtonStyle.Primary);

      const cancelButton = new ButtonBuilder()
        .setCustomId("cancelPoll-" + interaction.id) // Unique ID
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder().addComponents(
        submitButton,
        cancelButton,
      );

      await interaction.update({
        content: `Voting mode, poll duration, and recurrence are being selected.`,
        components: [voteModeRow, durationRow, recurrenceRow, buttonRow],
      });
    } catch (error) {
      logger.error(
        `❌ Error handling select menu interaction: ${error.message}`,
      );
      await interaction.reply({
        content: "There was an error handling your selection.",
        ephemeral: true,
      });
    }
  } else if (interaction.isButton()) {
    try {
      await interaction.deferReply();

      if (interaction.customId.startsWith("submitPoll")) {
        if (!storedPollData) {
          return interaction.followUp({
            content: "No poll data found. Please recreate the poll.",
            ephemeral: true,
          });
        }

        const pollChannel = interaction.channel;

        logger.info(`📢 Poll will be posted in channel: ${pollChannel.name}`);

        const pollMessage = await postPoll(interaction, storedPollData, client);

        // **Poll Preview Removal after Submission**
        if (interaction.message) {
          await interaction.message.delete();
        }

        if (pollMessage) {
          await interaction.editReply({
            content: `@${interaction.user.username}, the poll has been created here:`,
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setLabel("Jump to message")
                  .setStyle(ButtonStyle.Link)
                  .setURL(pollMessage.url),
              ),
            ],
          });
        } else {
          await interaction.editReply({
            content: "Failed to create the poll.",
            ephemeral: true,
          });
        }
      } else if (interaction.customId.startsWith("cancelPoll")) {
        await interaction.followUp({
          content: "Poll creation has been canceled.",
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error(`❌ Error submitting the poll: ${error.message}`);
      await interaction.followUp({
        content: "There was an error submitting the poll.",
        ephemeral: true,
      });
    }
  }
});

// Global Reaction Handler
client.on("messageReactionAdd", async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;

  // Fetch partials if necessary
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      logger.error("Failed to fetch reaction:", error);
      return;
    }
  }

  const pollConfig = activePolls.get(reaction.message.id);
  if (!pollConfig) return; // Not an active poll

  if (pollConfig.voteMode === "single") {
    const userReactions = reaction.message.reactions.cache.filter((r) =>
      r.users.cache.has(user.id),
    );

    if (userReactions.size > 1) {
      for (const userReaction of userReactions.values()) {
        if (userReaction.emoji.name !== reaction.emoji.name) {
          await userReaction.users.remove(user.id);
        }
      }
    }
  }
});

// Express web server for uptime monitoring (Replit)
const app = express();
app.get("/", (req, res) => res.send("Poll bot is running."));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`🌐 Web server running on port ${PORT}`));

// Log in to Discord
client.login(process.env.DISCORD_TOKEN);
