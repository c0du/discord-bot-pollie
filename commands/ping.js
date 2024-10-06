// commands/ping.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping") // Use 'ping' as a standalone command
    .setDescription("Replies with Pong!"),

  async execute(interaction) {
    await interaction.reply("Pong!");
  },
};
