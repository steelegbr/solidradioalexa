const nock = require('nock')
const domain = 'https://solidradio.example.org'

module.exports = {
    onTestStart: test => {
        nock.cleanAll()
        happy_path = !test._description.includes("Unhappy")
        NowPlayingFilter(happy_path);
        StationFilter(happy_path);
        EpgFilter(happy_path);
        LinersFilter(happy_path);
    }
}

function setEndpointNoAccess(endpoint) {
    nock(domain)
        .get(endpoint)
        .reply(401, 'No Access');
}

function NowPlayingFilter(success) {
    if (success) {
        nock(domain)
            .get('/api/songplay/Solid%20Radio/?page_size=1')
            .reply(
                200,
                '{"results": [{"song": {"title": "Song Title", "display_artist": "Song Artist"}}]}'
            )
            .get('/api/songplay/Solid%20Classics/?page_size=1')
            .reply(
                200,
                '{"results": [{"song": {"title": "Classic Hit", "display_artist": "Classic Artist"}}]}'
            );
    } else {
        setEndpointNoAccess('/api/songplay/Solid%20Radio/?page_size=1');
    }
}

function StationFilter(success) {
    if (success) {
        nock(domain)
            .get('/api/station/Solid%20Radio/')
            .reply(
                200,
                '{"name": "Solid Radio", "logo_square": "solidradio.png", "slogan": "Great Songs All Day Long", "stream_aac_high": "https://stream.example.org/solidradio", "liner_ratio": 2.0}'
            )
            .get('/api/station/Solid%20Classics/')
            .reply(
                200,
                '{"name": "Solid Classics", "logo_square": "solidclassics.png", "slogan": "Only the Classics", "stream_aac_high": "https://stream.example.org/solidclassics", "liner_ratio": 2.0}'
            );
    } else {
        setEndpointNoAccess('/api/station/Solid%20Radio/');
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
            .get('/api/epg/Solid%20Classics/current/')
            .reply(
                200,
                '{"title": "The Classics Show"}'
            );
    } else {
        setEndpointNoAccess('/api/epg/Solid%20Radio/current/');
    }
}

function LinersFilter(success) {
    if (success) {
        nock(domain)
            .get('/api/liners/Solid%20Radio/')
            .reply(
                200,
                '[{"line": "Our mum\'s number one radio station. If you ignore her actual favourite."},{"line": "My nan, a ZX spectrum, loves this one."}]'
            )
            .get('/api/liners/Solid%20Classics/')
            .reply(
                200,
                '[{"line": "More classic than black and white."},{"line": "Songs old enough to drink."}]'
            );
    } else {
        setEndpointNoAccess('/api/liners/Solid%20Radio/');
    }
}