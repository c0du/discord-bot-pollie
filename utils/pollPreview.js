// utils/pollPreview.js
const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

async function showPollPreview(interaction, pollData) {
  const voteModeSelect = new StringSelectMenuBuilder()
    .setCustomId("voteMode-" + interaction.id) // Ensure unique custom_id
    .setPlaceholder("Select voting mode")
    .addOptions([
      { label: "Single choice", value: "single" },
      { label: "Multiple choices", value: "multiple" },
    ]);

  const pollDurationSelect = new StringSelectMenuBuilder()
    .setCustomId("pollDuration-" + interaction.id) // Ensure unique custom_id
    .setPlaceholder("Select poll duration")
    .addOptions([
      { label: "1 minute", value: "1m" },
      { label: "5 minutes", value: "5m" },
      { label: "10 minutes", value: "10m" },
      { label: "1 hour", value: "1h" },
      { label: "1 day", value: "1d" },
    ]);

  const pollRecurrenceSelect = new StringSelectMenuBuilder()
    .setCustomId("pollRecurrence-" + interaction.id) // Ensure unique custom_id
    .setPlaceholder("Select poll recurrence")
    .addOptions([
      { label: "Does not repeat", value: "none" },
      { label: "Every 1 minute", value: "1m" },
      { label: "Every 5 minutes", value: "5m" },
      { label: "Every 1 hour", value: "1h" },
      { label: "Every day", value: "1d" },
    ]);

  const voteModeRow = new ActionRowBuilder().addComponents(voteModeSelect);
  const durationRow = new ActionRowBuilder().addComponents(pollDurationSelect);
  const recurrenceRow = new ActionRowBuilder().addComponents(
    pollRecurrenceSelect,
  );

  const submitButton = new ButtonBuilder()
    .setCustomId("submitPoll-" + interaction.id) // Ensure unique custom_id
    .setLabel("Submit Poll")
    .setStyle(ButtonStyle.Primary);

  const cancelButton = new ButtonBuilder()
    .setCustomId("cancelPoll-" + interaction.id) // Ensure unique custom_id
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder().addComponents(
    submitButton,
    cancelButton,
  );

  // Embed for poll preview
  const pollPreviewEmbed = new EmbedBuilder()
    .setTitle("Poll Preview")
    .setDescription(
      `**${pollData.question}**\n${pollData.choices
        .map((choice, index) => `${index + 1}. ${choice}`)
        .join("\n")}`,
    )
    .setAuthor({
      name: interaction.user.username, // Show author's name in the preview
      iconURL: interaction.user.displayAvatarURL(), // Show author's icon
    })
    .setFooter({ text: "Poll Preview" })
    .setTimestamp();

  // Step 2: Show dropdowns for voting mode, poll duration, and poll recurrence
  await interaction.reply({
    embeds: [pollPreviewEmbed],
    components: [voteModeRow, durationRow, recurrenceRow, buttonRow], // Include the recurrenceRow
  });
}

module.exports = { showPollPreview };
