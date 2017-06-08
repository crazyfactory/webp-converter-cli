#!/usr/bin/env node

const fs = require('fs');
const execFile = require('child_process').execFile;
const cwebp = require('cwebp-bin');
const program = require('commander');
const chalk = require('chalk');
const throat = require('throat');

const updateNotifier = require('update-notifier');
const pkg = require('../package.json');

const findImages = require('../src/find-images');

// Respect semantic-release
pkg.version = pkg.version || 'dev';
updateNotifier({pkg}).notify();

// Define commander
program
    .version(pkg.version || 'dev')
    .option('-r, --recursive', 'Walk given directory recursively')
    .option('-p, --path <path>', 'A path to crawl, defaults to current working directory')
    .option('-f, --files <items>', 'the files you want to convert,split by \',\'', v => v.split(','))
    .option('-c, --concurrency <number>', 'Parallel compression tasks, default 4', parseInt)
    .option('-v, --verbose', 'display additional information')
    .parse(process.argv);

// Determine Files
const files = program.files
    ? program.files
    : findImages(process.path || process.cwd(), ['png', 'jpg'], program.recursive);
console.log(chalk.yellow('Found ' + files.length + ' image file(s)!'));

// Create Queue
const concurrency = program.concurrency || 4;
const t = throat(concurrency);

// Helper func
function queryExtName(fileName) {
    return /\.[^.]+$/.exec(fileName);
}

// Fill Queue
let totalSize = 0;
let totalSaved = 0;
let convertedCount = 0;
const jobs = files.map(file => file && t(() =>
    new Promise(resolve => {
        const output = file.replace(queryExtName(file), '.webp');
        const size = fs.statSync(file).size;
        totalSize += size;

        // Begin
        if (program.verbose) {
            console.log(chalk.gray(file + ' is being converted'));
        }
        execFile(cwebp, [file, '-o', output], err => {
            if (err) {
                if (program.verbose) {
                    console.log(chalk.gray(err));
                }
                console.log(chalk.red(file + ' failed with error!'));
                resolve();
                return;
            }

            const newSize = fs.statSync(output).size;
            const percDiff = Math.round((1 - (newSize / size)) * 100);

            console.log(chalk.green(file + ' converted, saving ' + (size - newSize) + ' bytes (' + percDiff + '%)'));
            totalSaved += size - newSize;
            convertedCount++;
            resolve();
        });
    }
)));

// Report
Promise.all(jobs).then(err => {
    const failCount = files.length - convertedCount;
    if (err || failCount > 0) {
        console.log(chalk.red('Could not process ' + failCount + ' file(s).'));
    }

    const percDiff = Math.round((totalSaved / totalSize) * 100);
    console.log(chalk.yellow('Converted ' + convertedCount + ' file(s), saving ' + totalSaved + ' bytes (' + percDiff + '%)'));
});
