'use strict';

const debug = require('debug')('arris-agent');
const Influx = require('influx');

const status = require('@chriskinsman/arris-status');

// Minimum interval = 5M
let _interval = 1000 * 60 * 5;
if (process.env.INTERVAL) {
    debug('INTERVAL found in environment variable');
    let interval = parseInt(process.env.INTERVAl);
    if (interval > _interval) {
        _interval = interval;
    }
    else {
        console.error(`Interval of ${interval} ms below minimum threshold of ${_interval} ms`);
    }
}
debug(`using interval of ${_interval} ms`);

// Default Arris Surfboard 8200 ip address
let _uri = 'http://192.168.100.1';
if (process.env.ARRIS_IP) {
    debug('ARRIS_IP found in env');
    _uri = `http://${process.env.ARRIS_IP}`;
}
debug(`using uri: ${_uri}`);

const influxDownloadChannels = new Influx.InfluxDB({
    host: process.env.INFLUXDB_HOST,
    database: process.env.INFLUXDB_DB,
    username: process.env.INFLUXDB_USER,
    password: process.env.INFLUXDB_USER_PASSWORD,
    schema: [
        {
            measurement: 'qam_download_channels',
            fields: {
                power: Influx.FieldType.FLOAT,
                snr: Influx.FieldType.FLOAT,
                corrected: Influx.FieldType.INTEGER,
                uncorrected: Influx.FieldType.INTEGER
            },
            tags: [
                'channelid',
                'lockstatus',
                'modulation',
                'frequency'
            ]
        }
    ]
})

const influxUploadChannels = new Influx.InfluxDB({
    host: process.env.INFLUXDB_HOST,
    database: process.env.INFLUXDB_DB,
    username: process.env.INFLUXDB_USER,
    password: process.env.INFLUXDB_USER_PASSWORD,
    schema: [
        {
            measurement: 'qam_upload_channels',
            fields: {
                power: Influx.FieldType.FLOAT
            },
            tags: [
                'channelid',
                'lockstatus',
                'uschanneltype',
                'frequency',
                'width'
            ]
        }
    ]
})

async function getStatus() {
    debug('Starting getStatus')
    const channels = await status.get(_uri);
    debug('Channel data: %O', channels);
    const downloadPoints = [];
    channels.downstream.forEach((channel) => {
        downloadPoints.push({
            measurement: 'qam_download_channels',
            tags: {
                channelid: channel.channelId,
                lockstatus: channel.lockStatus,
                modulation: channel.modulation,
                frequency: channel.frequency
            },
            fields: {
                power: channel.power,
                snr: channel.SNRMER,
                corrected: channel.corrected,
                uncorrected: channel.uncorrected
            }
        });
    });
    debug('downloadPoints: %O', downloadPoints);
    await influxDownloadChannels.writePoints(downloadPoints);

    const uploadPoints = [];
    channels.upstream.forEach((channel) => {
        uploadPoints.push({
            measurement: 'qam_upload_channels',
            tags: {
                channelid: channel.channelId,
                lockstatus: channel.lockStatus,
                uschanneltype: channel.usChannelType,
                frequency: channel.frequency,
                width: channel.width
            },
            fields: {
                power: channel.power
            }
        });
    });
    debug('uploadPoints: %O', uploadPoints);
    await influxUploadChannels.writePoints(uploadPoints);
    debug('Ending getStatus');
}

setInterval(getStatus, _interval);
getStatus();