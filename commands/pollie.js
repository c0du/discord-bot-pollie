// pollie.js
const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pollie")
    .setDescription("Create a poll"),

  async execute(interaction) {
    // Step 1: Show the modal to collect poll question and choices
    const modal = new ModalBuilder()
      .setCustomId("pollCreateModal")
      .setTitle("Create a New Poll");

    const pollQuestionInput = new TextInputBuilder()
      .setCustomId("pollQuestion")
      .setLabel("Poll Question")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("What would you like to ask?")
      .setRequired(true);

    const firstChoiceInput = new TextInputBuilder()
      .setCustomId("firstChoice")
      .setLabel("First Choice")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter the first choice")
      .setRequired(true);

    const secondChoiceInput = new TextInputBuilder()
      .setCustomId("secondChoice")
      .setLabel("Second Choice")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter the second choice")
      .setRequired(true);

    const additionalChoicesInput = new TextInputBuilder()
      .setCustomId("additionalChoices")
      .setLabel("Additional Choices (Optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Enter additional choices separated by new lines")
      .setRequired(false);

    const recurrenceRandomizerInput = new TextInputBuilder()
      .setCustomId("recurrenceRandomizer")
      .setLabel("Recurrence Randomizer (Optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        "Enter additional choices for recurrence separated by new lines",
      )
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(pollQuestionInput),
      new ActionRowBuilder().addComponents(firstChoiceInput),
      new ActionRowBuilder().addComponents(secondChoiceInput),
      new ActionRowBuilder().addComponents(additionalChoicesInput),
      new ActionRowBuilder().addComponents(recurrenceRandomizerInput),
    );

    await interaction.showModal(modal); // Display the modal
  },
};
