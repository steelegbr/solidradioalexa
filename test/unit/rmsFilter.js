const nock = require('nock')
const domain = 'https://solidradio.example.org'

module.exports = {
    onTestStart: test => {
        NowPlayingFilter(true);
        StationFilter('Solid Radio', true);
        EpgFilter(true),
            LinersFilter(true)
    }
}

function NowPlayingFilter(success) {
    if (success) {
        nock(domain)
            .get('/api/songplay/Solid%20Radio/?page_size=1')
            .reply(
                200,
                '{"results": [{"song": {"title": "Song Title", "display_artist": "Song Artist"}}]}'
            )
    }
}

function StationFilter(station_name, success) {
    if (success) {
        nock(domain)
            .get('/api/station/Solid%20Radio/')
            .reply(
                200,
                '{"name": "' + station_name + '", "logo_square": "solidradio.png", "slogan": "Great Songs All Day Long", "stream_aac_high": "https://stream.example.org/solidradio", "liner_ratio": 2.0}'
            )
    }
}

function EpgFilter(success) {
    if (success) {
        nock(domain)
            .get('/api/epg/Solid%20Radio/current/')
            .reply(
                200,
                '{"title": "The Show Show"}'
            )
    }
}

function LinersFilter(success) {
    if (success) {
        nock(domain)
            .get('/api/liners/Solid%20Radio/')
            .reply(
                200,
                '[{"line:": "It\'s the same four songs..."}]'
            )
    }
}