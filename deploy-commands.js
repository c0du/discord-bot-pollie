const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Initialize REST API client
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Path to the commands folder
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

// Array to store all command data
const commands = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    console.log(`Registering command: ${command.data.name}`); // Debugging to ensure commands are being loaded
    commands.push(command.data.toJSON());
  }
}

// Deploy commands
(async () => {
  try {
    console.log(`Started refreshing application (/) commands.`);

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log(`Successfully reloaded application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
