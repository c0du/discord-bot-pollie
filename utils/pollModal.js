// utils/pollModal.js

const {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} = require("discord.js");

// Function to display the modal to the user
async function showPollModal(interaction) {
  try {
    // Create the modal
    const modal = new ModalBuilder()
      .setCustomId("pollModal")
      .setTitle("Create a New Poll");

    // Create text input fields for poll creation
    const questionInput = new TextInputBuilder()
      .setCustomId("pollQuestion")
      .setLabel("Poll Question")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const firstChoiceInput = new TextInputBuilder()
      .setCustomId("firstChoice")
      .setLabel("First Choice")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const secondChoiceInput = new TextInputBuilder()
      .setCustomId("secondChoice")
      .setLabel("Second Choice")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const thirdChoiceInput = new TextInputBuilder()
      .setCustomId("thirdChoice")
      .setLabel("Third Choice (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const otherChoicesInput = new TextInputBuilder()
      .setCustomId("otherChoices")
      .setLabel("Other Choices (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    // Add components to modal in rows
    const firstRow = new ActionRowBuilder().addComponents(questionInput);
    const secondRow = new ActionRowBuilder().addComponents(firstChoiceInput);
    const thirdRow = new ActionRowBuilder().addComponents(secondChoiceInput);
    const fourthRow = new ActionRowBuilder().addComponents(thirdChoiceInput);
    const fifthRow = new ActionRowBuilder().addComponents(otherChoicesInput);

    // Add rows to the modal
    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

    // Show the modal to the user
    await interaction.showModal(modal);

    console.log("✅ Modal successfully displayed");
  } catch (error) {
    console.error("❌ Error displaying modal:", error);
    await interaction.reply({
      content: "There was an error showing the poll creation modal.",
      ephemeral: true,
    });
  }
}

module.exports = { showPollModal };
