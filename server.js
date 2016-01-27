#!/usr/bin/env node

// server.js
//===========

/*
 * This is where all the magic happens.
 * The xway dashboard calls this script as is
 * `node server.js --port <free port number>`
 * after that everyline here will be executed.
 *
 * You can install extra modules thanks to the work
 * of npm. Also you can create a shell script to
 * install any missing system package.
 */

/* Requires node.js libraries */
var express = require('express');
var beast = require('netbeast')
var mustache = require('mustache');
var app = express();

// xyos apps can accept the port to be launched by parameters
var argv = require('minimist')(process.argv.slice(2));
port = argv.port || 31416;

if (isNaN(port)) {
    console.log("Port \"%s\" is not a number.", port);
    process.kill(1);
}

var gameState = newGame();
app.use(express.static(__dirname));
var bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
var beastResource = beast.resource;

var indexTemplate = readIndexTemplate();

var LifxClient = require('node-lifx').Client;
var client = new LifxClient();

client.on('light-new', function (light) {
    console.log(light);
    console.log('light-new');
    light.color(270, 100, 100);
});

client.on('light-online', function (light) {
    console.log(light);
    console.log('light-online');
    light.color(0, 100, 100);
});

client.startDiscovery();
console.log('start');
setTimeout(function () {
    client.stopDiscovery();
    console.log('stop');
}, 7000);

client.init();


function isRestart(request) {
    return request.body.restart == "true";
}

function newGame() {
    return {
        levelNo: 0,
        points: 0,
        stepInLevel: 0,
        finished: false,

    }
}

function nextColorToMatch(gameState) {
    return levels[gameState.levelNo].colors[gameState.stepInLevel];
}
function userInputColor(request) {
    return Object.keys(request.body)[0];
}
function goToNextLevel(gameState) {
    gameState.levelNo++;
    gameState.stepInLevel = 0;
    return gameState;
}
function getMaxStepOfLevel(levelNo) {
    return levels[levelNo].colors.length;
}
function isLevelFinished(gameState) {
    return gameState.stepInLevel >= getMaxStepOfLevel(gameState.levelNo);
}

function getMaxLevels() {
    return levels.length;
}

function isGameFinished(gameState) {
    return gameState.levelNo >= getMaxLevels();
}
function getColorsForLevel(levelNo) {
    return levels[levelNo].colors.slice();
}

function flashColors(colorsForLevel) {
    colorsForLevel.forEach(function (color, index) {
            console.log("index= "+index);
            var multiplier = (index + 1);
            setTimeout(function () {
                flashLight(color);
                flashLight(color);
            }, multiplier * 3000 -1000);

            setTimeout(function () {
                turnLightOff();
                turnLightOff();
            }, multiplier * 3000);
        }
    )
    ;
}
function flashLevel(gameState) {
    var colorsForLevel = getColorsForLevel(gameState.levelNo);
    flashColors(colorsForLevel);
}
function nextStep(gameState, request) {
    if (nextColorToMatch(gameState) == userInputColor(request)) {
        gameState.stepInLevel++;

        if (isLevelFinished(gameState)) {
            gameState = goToNextLevel(gameState);
            flashLevel(gameState);
        }

        if (isGameFinished(gameState)) {
            gameState.finished = true;
        }
    }
}

function printGameState(gameState) {
    return mustache.render(indexTemplate, gameState);
}
function printMessage(message) {
    return mustache.render(indexTemplate, {infoMessage: message});
}
function printResponse(response, gameState) {

    if (gameState.finished) {
        response.send(printMessage("Congratulations you finished!"));
    } else {
        response.send(printGameState(gameState));
    }
}

app.post("/restart", function (request, response) {
    console.log("restart");
    gameState = newGame();
    response.send(printMessage("you have restarted"));
    //flashLevel(gameState);
    printResponse(response, gameState);
});

function logGameState(gameState) {
    return gameState.stepInLevel + "," + gameState.levelNo;
}
app.post("/",
    function (request, response) {
        if (gameState.finished) {
            console.log("post/newgame" + logGameState(gameState));
            gameState = newGame();
        }

        nextStep(gameState, request);
        printResponse(response, gameState);
    }
)

var server = app.listen(port, function () {
    console.log('Example app listening at http://%s:%s',
        server.address().address,
        server.address().port);
});

var levels = [
    {colors: ["red"]},
    {colors: ["red", "green"]},
    {colors: ["red", "green", "blue"]},
    {colors: ["red", "green", "blue", "green"]},
    {colors: ["red", "green", "blue", "green", "yellow"]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue"]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue", "red"]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue", "red", "green"]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue", "red", "green", "blue"]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue", "red", "green", "blue", "blue",]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue", "red", "green", "blue", "blue", "red"]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue", "red", "green", "blue", "blue", "red", "yellow"]},
    {colors: ["red", "green", "blue", "green", "yellow", "blue", "red", "green", "blue", "blue", "red", "yellow", "red"]},
]

function readIndexTemplate() {
    var fs = require('fs');
    return fs.readFile(__dirname + '/index.mu', function (err, data) {
        if (err) {
            throw err;
        }
        indexTemplate = data.toString();
    });
    return indexTemplate;

}

function turnLightOff() {
    console.log("time=" + Date.now() + " turnoff");
    var lightsarray = client.lights();
    if (lightsarray.length == 0) {
        console.log('shit, no light available...')
    }
    lightsarray.forEach(function (light) {
        light.color(0, 0, 0);
    });
}

function flashLight(color) {
    console.log("time=" + Date.now() + "color to flash" + color);
    colornumber = 0;
    if (color == 'yellow') {
        colornumber = 60;
    }
    if (color == 'green') {
        colornumber = 120;
    }
    if (color == 'blue') {
        colornumber = 240;
    }
    if (color == 'red') {
        colornumber = 0;
    }

    var lightsarray = client.lights();
    if (lightsarray.length == 0) {
        console.log('shit, no light available...')
    }
    lightsarray.forEach(function (light) {
        light.color(colornumber, 100, 100);
    });
}




