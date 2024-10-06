// utils/pollUtils.js
const { EmbedBuilder } = require("discord.js");
const logger = require("winston");
const Poll = require("../actives/poll"); // Adjusted path

// Import activePolls from index.js or manage it here
const activePolls = new Map(); // Using Map instead of Collection for simplicity

// Reaction emojis corresponding to the poll options (A, B, C, etc.)
const reactionEmojis = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];

// Helper function to convert duration to milliseconds
function getDurationInMilliseconds(duration) {
  const timeMap = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "10m": 10 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  };
  return timeMap[duration] || 60 * 1000;
}

// Helper function to parse recurrence
function parseRecurrence(recurrence) {
  const timeMap = {
    "1m": 1 / (60 * 24), // Convert to days
    "5m": 5 / (60 * 24),
    "10m": 10 / (60 * 24),
    "1h": 1 / 24,
    "1d": 1,
  };
  return timeMap[recurrence] || 0;
}

// Helper function to select random options for recurrence
function selectRandomOptions(choices) {
  const shuffled = choices.sort(() => 0.5 - Math.random());
  return shuffled;
}

// Function to post the poll after confirmation
async function postPoll(interaction, pollData, client, options = {}) {
  try {
    let channel, author;

    if (interaction) {
      channel = interaction.channel;
      author = {
        id: interaction.user.id,
        username: interaction.user.username,
        avatarURL: interaction.user.displayAvatarURL(),
      };
    } else if (options.channel && options.author) {
      channel = options.channel;
      author = options.author;
    } else {
      throw new Error(
        "No valid channel or interaction provided for posting the poll.",
      );
    }

    // Create the poll embed with the question and options
    const pollEmbed = new EmbedBuilder()
      .setTitle(pollData.question || "Your Poll Question")
      .setDescription(
        pollData.choices
          .map(
            (choice, index) =>
              `**${String.fromCharCode(65 + index)}**: ${choice}`,
          )
          .join("\n"),
      )
      .setColor(0x00ae86)
      .setFooter({ text: "React to vote!" })
      .setAuthor({
        name: author.username, // Add author's name
        iconURL: author.avatarURL || client.user.displayAvatarURL(), // Add author's icon or default to bot's avatar
      })
      .setTimestamp();

    // Send the poll message to the channel
    const pollMessage = await channel.send({ embeds: [pollEmbed] });

    // Add reactions for each poll choice, using corresponding emojis
    for (let index = 0; index < pollData.choices.length; index++) {
      const emoji = reactionEmojis[index];
      if (emoji) {
        try {
          await pollMessage.react(emoji);
        } catch (err) {
          logger.error(`Failed to add reaction ${emoji}: ${err}`);
        }
      }
    }

    // Enforce single-vote mode if selected
    if (pollData.voteMode === "single") {
      activePolls.set(pollMessage.id, {
        voteMode: pollData.voteMode,
      });
    }

    // Calculate end date
    const durationMs = getDurationInMilliseconds(pollData.duration);
    const endDate = new Date(Date.now() + durationMs);

    // Save poll to the database
    const poll = new Poll({
      guildId: interaction ? interaction.guild.id : options.guildId,
      channelId: channel.id,
      messageId: pollMessage.id,
      question: pollData.question,
      options: pollData.choices,
      randomizerOptions: pollData.randomizerOptions || [],
      voteMode: pollData.voteMode,
      authorId: author.id,
      authorUsername: author.username,
      authorAvatarURL: author.avatarURL,
      startDate: new Date(),
      duration: pollData.duration,
      endDate: endDate,
      recurrence: pollData.recurrence || "none",
      nextRun:
        pollData.recurrence && pollData.recurrence !== "none"
          ? new Date(
              endDate.getTime() +
                parseRecurrence(pollData.recurrence) * 24 * 60 * 60 * 1000,
            )
          : null,
    });

    await poll.save();

    // Schedule poll end
    setTimeout(() => endPoll(poll._id, client), durationMs);

    return pollMessage;
  } catch (error) {
    logger.error(`Error posting poll: ${error.message}`);
    if (interaction && typeof interaction.reply === "function") {
      await interaction.reply({
        content: "There was an error posting the poll.",
        ephemeral: true,
      });
    }
  }
}

// Function to end the poll
async function endPoll(pollId, client) {
  try {
    const poll = await Poll.findById(pollId);
    if (!poll) return;

    const channel = await client.channels.fetch(poll.channelId);
    if (!channel) return;

    const pollMessage = await channel.messages.fetch(poll.messageId);
    if (!pollMessage) return;

    // Disable further reactions
    await pollMessage.reactions.removeAll();

    // Tally votes
    const voteCounts = {};
    poll.options.forEach((option, index) => {
      const emoji = reactionEmojis[index];
      const reaction = pollMessage.reactions.cache.get(emoji);
      voteCounts[option] = reaction ? reaction.count - 1 : 0; // Subtract bot's own reaction
    });

    // Create results embed with original author's info
    const resultsEmbed = new EmbedBuilder()
      .setTitle(`Poll Ended: ${poll.question}`)
      .setDescription(
        Object.entries(voteCounts)
          .map(([option, count]) => `**${option}**: ${count} vote(s)`)
          .join("\n"),
      )
      .setColor(0x00ae86)
      .setFooter({ text: "Poll Results" })
      .setAuthor({
        name: poll.authorUsername,
        iconURL: poll.authorAvatarURL || client.user.displayAvatarURL(),
      })
      .setTimestamp();

    await channel.send({ embeds: [resultsEmbed] });

    // Handle recurrence
    if (poll.recurrence !== "none" && poll.randomizerOptions.length > 0) {
      // Select random options for the new poll
      const randomizedOptions = selectRandomOptions(poll.randomizerOptions);
      // Take first 6 options or all if less
      const newOptions = randomizedOptions.slice(0, 6);

      const newPollData = {
        question: poll.question,
        choices: newOptions,
        voteMode: poll.voteMode,
        duration: poll.duration,
        recurrence: poll.recurrence,
        randomizerOptions: poll.randomizerOptions, // Keep the same randomizer options
      };

      // Remove the old messageId from activePolls to prevent multiple schedules
      activePolls.delete(poll.messageId);

      // Re-post the poll using the stored author info
      const newPollMessage = await postPoll(null, newPollData, client, {
        channel: channel,
        author: {
          id: poll.authorId,
          username: poll.authorUsername,
          avatarURL: poll.authorAvatarURL,
        },
        guildId: poll.guildId,
      });

      if (!newPollMessage) {
        logger.error("Failed to re-post the poll during recurrence.");
        return;
      }

      // Update poll with new message ID and end date
      poll.messageId = newPollMessage.id;
      poll.startDate = new Date();
      poll.endDate = new Date(
        Date.now() + getDurationInMilliseconds(poll.duration),
      );
      poll.nextRun = new Date(
        poll.endDate.getTime() +
          parseRecurrence(poll.recurrence) * 24 * 60 * 60 * 1000,
      );
      await poll.save();

      // Schedule next poll end
      setTimeout(
        () => endPoll(poll._id, client),
        getDurationInMilliseconds(poll.duration),
      );
    } else {
      // Remove poll from activePolls
      activePolls.delete(poll.messageId);
      await poll.deleteOne();
    }
  } catch (error) {
    logger.error("Error ending poll:", error);
  }
}

// Function to re-post the poll for recurrence (optional, based on your design)
async function postPollAgain(pollId, client) {
  try {
    const poll = await Poll.findById(pollId);
    if (!poll) return;

    const channel = await client.channels.fetch(poll.channelId);
    if (!channel) return;

    // Reuse the postPoll function to create a new poll message
    const pollMessage = await postPoll(
      null,
      {
        question: poll.question,
        choices: poll.options,
        voteMode: poll.voteMode,
        duration: poll.duration,
        recurrence: poll.recurrence,
        randomizerOptions: poll.randomizerOptions,
      },
      client,
      {
        channel: channel,
        author: {
          id: poll.authorId,
          username: poll.authorUsername,
          avatarURL: poll.authorAvatarURL,
        },
        guildId: poll.guildId,
      },
    );

    // Update poll with new message ID and end date
    poll.messageId = pollMessage.id;
    poll.startDate = new Date();
    poll.endDate = new Date(
      Date.now() + getDurationInMilliseconds(poll.duration),
    );
    poll.nextRun = new Date(
      poll.endDate.getTime() +
        parseRecurrence(poll.recurrence) * 24 * 60 * 60 * 1000,
    );
    await poll.save();

    // Schedule next poll end
    setTimeout(
      () => endPoll(poll._id, client),
      getDurationInMilliseconds(poll.duration),
    );
  } catch (error) {
    logger.error("Error reposting poll:", error);
  }
}

module.exports = { postPoll, endPoll, postPollAgain, activePolls };
