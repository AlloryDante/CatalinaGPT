const { entersState, joinVoiceChannel, VoiceConnectionStatus, EndBehaviorType } = require('@discordjs/voice');
const { Readable } = require('stream');
const { Wit } = require('node-wit');
const { OpusEncoder } = require('@discordjs/opus');

//const witClient = new Wit({ accessToken: process.env.WITHAI_TOKEN });

async function handleVoice(newState) {
	if (newState.member.user.id == ownerID) {
		if (!newState.channelId) {
			if (newState.member.user.id == ownerID) {
				if (!connection) return;
				console.log('Destroying VC');
				await delay(getRandomInt(5000, 20000));
				console.log('Destroy');
				connection.destroy();
				connection = null;
			}
		} else {
			if (connection) return;
			console.log('Joining VC');
			await delay(getRandomInt(5000, 25000));
			console.log('Joined');
			let voiceChannel = client.channels.cache.get(newState.channelId);
			connection = joinVoiceChannel({
				channelId: newState.channelId,
				guildId: newState.guild.id,
				adapterCreator: voiceChannel.guild.voiceAdapterCreator,
				selfDeaf: false
			});

			await entersState(connection, VoiceConnectionStatus.Ready, 20e3);
			const receiver = connection.receiver;

			/* When user speaks in vc*/
			receiver.speaking.on('start', async (userId) => {
				//createListeningStream(receiver, userId);
			});
		}
	}
}
function createListeningStream(receiver, userId) {
	const opusStream = receiver.subscribe(userId, {
		//here the error happens.
		end: {
			behavior: EndBehaviorType.AfterSilence,
			duration: 100
		}
	});

	const buffing = [];
	const encodere = new OpusEncoder(48000, 2);
	opusStream.on('data', (chunk) => {
		buffing.push(encodere.decode(chunk));
	});
	opusStream.once('end', async () => {
		console.log(userId);
		let buffer = Buffer.concat(buffing);
		const duration = buffer.length / 48000 / 4;
		console.log('duration: ' + duration);
		if (duration < 2.0 || duration > 19) {
			// 20 seconds max dur
			console.log('TOO SHORT / TOO LONG; SKPPING');
			return;
		}
		let new_buffer = await convert_audio(buffer);
		let result = await transcribe(new_buffer);
		console.log(result);
	});
}
function convert_audio(input) {
	try {
		// stereo to mono channel
		const data = new Int16Array(input);
		const ndata = new Int16Array(data.length / 2);
		for (let i = 0, j = 0; i < data.length; i += 4) {
			ndata[j++] = data[i];
			ndata[j++] = data[i + 1];
		}
		return Buffer.from(ndata);
	} catch (e) {
		console.log(e);
		console.log('convert_audio: ' + e);
		throw e;
	}
}

let witAI_lastcallTS = null;

async function transcribe(buffer) {
	try {
		// ensure we do not send more than one request per second
		if (witAI_lastcallTS != null) {
			let now = Math.floor(new Date());
			while (now - witAI_lastcallTS < 1000) {
				console.log('sleep');
				await delay(100);
				now = Math.floor(new Date());
			}
		}
	} catch (e) {
		console.log('transcribe_witai ERR:' + e);
	}
	try {
		witAI_lastcallTS = Math.floor(new Date());
		var stream = Readable.from(buffer);
		const contenttype = 'audio/raw;encoding=signed-integer;bits=16;rate=48k;endian=little';
		return await witClient.speech(contenttype, stream);
	} catch (e) {
		console.log('transcribe_witai 851:' + e);
		console.log(e);
	}
}

module.exports = handleVoice;
