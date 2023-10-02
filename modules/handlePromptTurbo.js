const { Configuration, OpenAIApi } = require('openai');
const handleVoicePrompt = require('./handleVoicePrompt');
const botcontext = require('../context');

const configuration = new Configuration({
	apiKey: process.env.OPENAI_TOKEN
});

const openai = new OpenAIApi(configuration);

async function handlePrompt(message) {
	if (connection && connection._state.status == 'ready') {
		let joinedVoiceChannel = connection.joinConfig.channelId;
		let channel = await client.channels.fetch(joinedVoiceChannel, { force: true });
		let members = channel.members;
		let foundMember = false;
		members.forEach(async (member) => {
			const memberId = member.user.id;
			if (message.author.id == memberId) {
				foundMember = true; //found in voice chat
				await handleVoicePrompt(message);
				return;
			}
		});
		if (foundMember) return; //we dont need to send a text message therefore we return
	}

	let response = await generateTextPrompt(message);
	if (response) {
		let messageChannel = client.channels.cache.get(message.channelId);
		await messageChannel.sendTyping();
		await delay(parseInt(response.length * 25));
		message.reply(response);
	} else {
		message.reply("Sorry, I cant speak. I don't feel ok right now.");
	}
}

async function generateTextPrompt(discordMessage) {
	let askerUsername = discordMessage.author.username.replace(/[^a-zA-Z ]/g, '');
	let userId = discordMessage.author.id;
	let userBehaviour = botcontext.other_users.user_context;
	if (botcontext.processedContext[userId]) {
		userBehaviour = botcontext.processedContext[userId].user_context;
	}

	let errorStatus = 429;
	let retryCounter = 0;
	while (errorStatus == 429 && retryCounter < 4) {
		retryCounter += 1;
		errorStatus = 0;
		try {
			let systemMessage = `${botcontext.about}
Impersonate: ${botcontext.behaviour}
Optional to Impersionate: ${userBehaviour}
Keep messages short.`;

			let messages = [];
			let repliesPass = 0;
			let analyzedDiscordMessage = discordMessage;
			for (var i = 0; i < 12; i++) {
				repliesPass += 1;
				if (analyzedDiscordMessage?.reference?.messageId) {
					let reply = await discordMessage.channel.messages.fetch(analyzedDiscordMessage.reference.messageId);
					let replyUsername = reply.author.username.replace(/[^a-zA-Z ]/g, '');
					if (reply.author.id == client.user.id) {
						messages.unshift({ role: 'assistant', content: `Catalina: ${reply.content}` });
					} else {
						messages.unshift({ role: 'user', content: `${replyUsername}: ${reply.content}` });
					}
					analyzedDiscordMessage = reply;
				} else {
					break;
				}
			}
			messages.unshift({
				role: 'system',
				content: systemMessage
			});

			messages.push({ role: 'user', content: `${askerUsername}: ${discordMessage.content}` });

			const completion = await openai.createChatCompletion({
				model: 'gpt-3.5-turbo',
				temperature: 0.85,
				messages: messages
			});
			console.log(`Replies Pass: ${repliesPass} Total Tokens: ${completion.data.usage.total_tokens} - ${parseFloat(parseInt(completion.data.usage.total_tokens) * 0.000002).toFixed(4)}$`);
			let response = completion.data.choices[0].message.content.split(':');
			response.shift();
			return response.join(':');
		} catch (error) {
			console.log('Errror prompting ' + retryCounter);
			if (error.response) {
				errorStatus = error.response.status;
				if (errorStatus != 429) {
					console.log(error.response.status);
					console.log(error.response.data);
				}
			} else console.log(error);
		}
		await delay(2000);
	}

	return false;
}
module.exports = handlePrompt;
