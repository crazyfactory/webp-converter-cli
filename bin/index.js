#!/usr/bin/env node

const fs = require('fs');
const execFile = require('child_process').execFile;
const readChunk = require('read-chunk');
const imageType = require('image-type');
const cwebp = require('cwebp-bin');
const program = require('commander');
const chalk = require('chalk');

const updateNotifier = require('update-notifier');
const pkg = require('../package.json');

updateNotifier({pkg}).notify();

let fileList = [];

function queryExtName(fileName) {
    return /\.[^.]+$/.exec(fileName);
}

function walk(path) {
    const dirList = fs.readdirSync(path);
    dirList.forEach(item => {
        if (fs.statSync(path + '/' + item).isFile()) {
            const imageTypeData = imageType(readChunk.sync(path + '/' + item, 0, 12));
            if (imageTypeData) {
                if (imageTypeData.ext === 'jpg' || imageTypeData.ext === 'png') {
                    fileList.push(path + '/' + item);
                }
            }
        }
    });

    if (program.recursive) {
        dirList.forEach(item => {
            if (fs.statSync(path + '/' + item).isDirectory()) {
                walk(path + '/' + item);
            }
        });
    }
}

program
    .version(pkg.version || 'dev')
    .option('-r, --recursive', 'Walk given directory recursively')
    .option('-f, --files <items>', 'the files you want to convert,split by \',\'', v => v.split(','))
    .parse(process.argv);

if (program.files) {
    fileList = program.files;
} else {
    walk(process.cwd());
}

console.log(chalk.yellow('Found ' + fileList.length + ' image file(s) !'));
fileList.forEach(file => {
    execFile(cwebp, [file, '-o', file.replace(queryExtName(file), '.webp')], err => {
        if (err) {
            throw err;
        }
        console.log(chalk.green(file + ' is converted!'));
    });
});
