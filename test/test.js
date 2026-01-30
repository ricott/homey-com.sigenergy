'use strict';

var modbus = require('jsmodbus');
var net = require('net');

let socket = new net.Socket();
let client100 = new modbus.client.TCP(socket, 247, 5000);
let options = {
    host: "192.168.200.66",
    port: 502,
};

socket.on('connect', function () {
    console.log(`Client connected on IP '${options.host}'`);
    let startTime = new Date().getTime();
    Promise.all([

        client100.readHoldingRegisters(30282, 2),
        client100.readHoldingRegisters(30284, 2),


    ]).then((results) => {
        let endTime = new Date().getTime();

        for (let index = 0; index < results.length; index++) {
            let result = results[index];

            //console.log(result.response);
            // console.log(result.response._body._valuesAsBuffer.readUInt16BE(0));
            console.log(result.response._body._valuesAsBuffer.readUInt32BE(0));
        }

        console.log(`Execution time: ${endTime-startTime}`);

    }).catch((err) => {
        console.log('error', err);
    }).finally(function () {
        socket.destroy();
    });
});

socket.on('error', function (err) {
    console.log('error', err);
});

socket.on('close', function () {
    console.log(`Client closed for IP '${options.host}'`);
});

socket.connect(options);



