/**
    Solid Radio Alexa Skill
    Copyright (C) 2019-2021 Marc Steele
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const Alexa = require('ask-sdk-core');
const https = require('https');
const Settings = require('./settings.json');

/**
 * Intent handler for the play action.
 */

const PlayIntentHandler = {


    canHandle(handlerInput) {

        return handlerInput.requestEnvelope.request.type === 'LaunchRequest' ||
            handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
            (
                handlerInput.requestEnvelope.request.intent.name === 'PlayIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'NowPlayingIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'CurrentShowIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ResumeIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOnIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NextIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PreviousIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ShuffleOnIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StartOverIntent'
            );

    },

    async handle(handlerInput) {

        console.log('Play stream intent triggered.');

        // Get basic station, EPG and songplay information from MusicStats

        let station, songplay, epgEntry = null;
        let liner = '';

        try {

            songplay = await getNowPlaying();
            station = await getStation();
            epgEntry = await getEpgEntry();
            liner = await getMarketingLiner(station);

        } catch (error) {
            console.log('Bailed out of the process.')
            handlerInput.responseBuilder
                .speak(`I've hit a problem trying to do that for you. Sorry. Please try again later!`);
            return handlerInput.responseBuilder.getResponse();
        }

        // Either read out the EPG entry or current song

        var nowPlayingSpeech = null;

        if (handlerInput.requestEnvelope.request.type === 'IntentRequest' && handlerInput.requestEnvelope.request.intent.name === 'CurrentShowIntent') {
            nowPlayingSpeech = `It's currently ${epgEntry.title} on ${station.name}. ${liner}`;
        } else {
            nowPlayingSpeech = `Now playing ${songplay.song.title} by ${songplay.song.display_artist} on ${station.name}. ${liner}`;
        }

        nowPlayingSpeech = nowPlayingSpeech.replace(/&/g, 'and');
        handlerInput.responseBuilder.speak(nowPlayingSpeech);

        // Show a card

        handlerInput.responseBuilder.withStandardCard(
            station.name,
            `${epgEntry.title} on ${station.name}. Now playing ${songplay.song.title} by ${songplay.song.display_artist}.`,
            makeUrlSecure(station.logo_square),
            makeUrlSecure(station.logo_square)
        );

        // Stream the station

        var metadata = {
            "title": station.slogan,
            "subtitle": station.name,
            "art": {
                "sources": [
                    {
                        "contentDescription": station.name,
                        "url": makeUrlSecure(station.logo_square),
                    }
                ]
            }
        };

        handlerInput.responseBuilder
            .addAudioPlayerPlayDirective('REPLACE_ALL', station.stream_aac_high, Settings.metadata_token, 0, null, metadata);

        // Punt it back to Alexa

        const response = handlerInput.responseBuilder.getResponse();
        console.log('Play intent handling complete.');
        console.log(`Response: ${JSON.stringify(response)}`);
        return response;

    }

}

/**
 * Makes a URL use HTTPS rather than HTTP
 */

function makeUrlSecure(url) {

    if (!url.includes('https')) {
        return url.replace('http', 'https');
    }

    return url;

}

/**
 * Marketing liners.
 */

function getMarketingLiner(station) {

    return new Promise((resolve, reject) => {

        // Check if we should even go any further

        if (!station.use_liners) {
            console.log(`No liners to be used for ${station.name}.`);
            resolve('');
        }

        // Get our list of liners

        const options = {
            host: Settings.server,
            path: `/api/liners/${Settings.station}/`,
            headers: {
                'Authorization': `Token ${Settings.token}`
            }
        };

        console.log(`Getting marketing liners for ${station.name}`);

        const request = https.get(options, result => {

            let data = '';

            // Error out as needed

            if (result.statusCode !== 200) {
                console.log(`HTTP error code ${request.statusCode} encountered.`);
                return reject(new Error(`HTTP error code ${request.statusCode} encountered.`));
            }

            // Handle incoming data

            result.on('data', (chunk) => {
                data += chunk;
            });

            // Tell the user when we're done

            result.on('end', () => {

                var liners = JSON.parse(data);
                if (liners && liners.length > 0) {

                    // We got some liners

                    console.log(`Received the following marketing liners: ${JSON.stringify(liners)}`)

                    // Determine if we want to use one

                    const threshold = 1.0 - station.liner_ratio;
                    var liner = '';

                    if (Math.random() > threshold) {

                        var selectedIndex = Math.floor(Math.random() * liners.length);
                        liner = liners[selectedIndex]['line'];
                        console.log(`Selected liner: ${liner}`);

                    } else {
                        console.log('Liner threshold not reached.');
                    }


                    resolve(liner);

                } else {
                    console.log(`Weird marketing liners response: ${data}`);
                    reject(new Error(`Got an odd response asking for marketing liners.`));
                }

            });

            // Error handling

            result.on('error', (error) => {

                console.log(`Ran into the following error obtaining marketing liners: ${error}`)
                reject(new Error(`Ran into an error acquiring the marketing liners.`));

            });

        });

        request.end();

    });

}

/**
 * Makes the actual now playing request
 */

function getNowPlaying() {

    return new Promise((resolve, reject) => {

        const options = {
            host: Settings.server,
            path: `/api/songplay/${Settings.station}/?page_size=1`,
            headers: {
                'Authorization': `Token ${Settings.token}`
            }
        };

        console.log(`Getting now playing information from ${Settings.server}.`)

        const request = https.get(options, result => {

            let data = '';

            // Error out as needed

            if (result.statusCode !== 200) {
                console.log(`HTTP error code ${request.statusCode} encountered.`);
                return reject(new Error(`HTTP error code ${request.statusCode} encountered.`));
            }

            // Handle incoming data

            result.on('data', (chunk) => {
                data += chunk;
            });

            // Tell the user when we're done

            result.on('end', () => {

                const json_data = JSON.parse(data);
                const songplays = json_data['results'];

                if (songplays && songplays.length > 0) {

                    var songplay = songplays[0];
                    console.log(`Received the following song play information: ${JSON.stringify(songplay)}`)
                    resolve(songplay);

                } else {
                    console.log(`Weird song play response: ${data}`);
                    reject(new Error(`Got an odd response asking for now playing information.`));
                }

            });

            // Error handling

            result.on('error', (error) => {

                console.log(`Ran into the following error obtaining songplay information: ${error}`)
                reject(new Error(`Ran into an error acquiring the now playing information.`));

            });

        });

        request.end();

    });

}

/**
 * Station information
 */

async function getStation() {

    return new Promise((resolve, reject) => {

        const options = {
            host: Settings.server,
            path: `/api/station/${Settings.station}/`,
            headers: {
                'Authorization': `Token ${Settings.token}`
            }
        };

        console.log(`Getting now station informaion from ${Settings.server}.`)

        const request = https.get(options, result => {

            let data = '';

            // Error out as needed

            if (result.statusCode !== 200) {
                console.log(`HTTP error code ${request.statusCode} encountered.`);
                return reject(new Error(`HTTP error code ${request.statusCode} encountered.`));
            }

            // Handle incoming data

            result.on('data', (chunk) => {
                data += chunk;
            });

            // Tell the user when we're done

            result.on('end', () => {

                const station = JSON.parse(data);
                console.log(`Received the following station information: ${data}`);
                resolve(station);

            });

            // Error handling

            result.on('error', (error) => {

                console.log(`Ran into the following error obtaining station informaion: ${error}`)
                reject(new Error(`Ran into an error acquiring the station information.`));

            });

        });

        request.end();

    });

}

/**
 * EPG entry
 */

async function getEpgEntry() {

    return new Promise((resolve, reject) => {

        const options = {
            host: Settings.server,
            path: `/api/epg/${Settings.station}/current/`,
            headers: {
                'Authorization': `Token ${Settings.token}`
            }
        };

        console.log(`Getting EPG informaion from ${Settings.server}.`)

        const request = https.get(options, result => {

            let data = '';

            // Error out as needed

            if (result.statusCode !== 200) {
                console.log(`HTTP error code ${request.statusCode} encountered.`);
                return reject(new Error(`HTTP error code ${request.statusCode} encountered.`));
            }

            // Handle incoming data

            result.on('data', (chunk) => {
                data += chunk;
            });

            // Tell the user when we're done

            result.on('end', () => {

                const epgEntry = JSON.parse(data);
                console.log(`Received the following EPG entry: ${data}`);
                resolve(epgEntry);

            });

            // Error handling

            result.on('error', (error) => {

                console.log(`Ran into the following error obtaining EPG entry: ${error}`)
                reject(new Error(`Ran into an error acquiring the EPG entry.`));

            });

        });

        request.end();

    });

}

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = `This skill plays ${Settings.stationName}. It can also tell you the currently playing song.`;

        return handlerInput.responseBuilder
            .speak(speechText)
            .getResponse();
    },
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.PauseIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.LoopOffIntent' ||
                handlerInput.requestEnvelope.request.intent.name === 'AMAZON.ShuffleOffIntent'
            );
    },
    handle(handlerInput) {

        handlerInput.responseBuilder
            .addAudioPlayerClearQueueDirective('CLEAR_ALL')
            .addAudioPlayerStopDirective();

        return handlerInput.responseBuilder
            .getResponse();
    },
};

const PlaybackStoppedIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'PlaybackController.PauseCommandIssued' ||
            handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackStopped';
    },
    handle(handlerInput) {
        handlerInput.responseBuilder
            .addAudioPlayerClearQueueDirective('CLEAR_ALL')
            .addAudioPlayerStopDirective();

        return handlerInput.responseBuilder
            .getResponse();
    },
};


const PlaybackStartedIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'AudioPlayer.PlaybackStarted';
    },
    handle(handlerInput) {

        console.log('Audio playback start detected.')
        handlerInput.responseBuilder.addAudioPlayerClearQueueDirective('CLEAR_ENQUEUED');
        return handlerInput.responseBuilder.getResponse();

    },
};

const NearlyFinishedIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === "AudioPlayer.PlaybackNearlyFinished";
    },
    handle(handlerInput) {
        console.log('Audio nearly finished triggered!');
    }
}

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        console.log(JSON.stringify(handlerInput));

        return handlerInput.responseBuilder
            .getResponse();
    },
};

//System.ExceptionEncountered
const ExceptionEncounteredRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'System.ExceptionEncountered';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

        return true;
    },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`Error handled: ${error.message}`);
        console.log(`Handler input: ${JSON.stringify(handlerInput)}`);

        return handlerInput.responseBuilder
            .addAudioPlayerClearQueueDirective('CLEAR_ALL')
            .addAudioPlayerStopDirective()
            .getResponse();
    },
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
    .addRequestHandlers(
        PlayIntentHandler,
        PlaybackStartedIntentHandler,
        CancelAndStopIntentHandler,
        PlaybackStoppedIntentHandler,
        NearlyFinishedIntentHandler,
        HelpIntentHandler,
        ExceptionEncounteredRequestHandler,
        SessionEndedRequestHandler,
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();