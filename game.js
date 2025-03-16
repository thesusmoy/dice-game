const crypto = require('crypto');
const prompt = require('prompt-sync')();
const Table = require('cli-table3');

class Dice {
    constructor(values) {
        if (values.length !== 6)
            throw new Error('Dice must have exactly 6 values.');

        this.values = values.map(Number);
    }
}
class DiceParser {
    static parseDiceSets(args) {
        if (args.length < 3) {
            throw new Error('Not enough dice configurations provided.');
        }

        const diceSets = args.map((arg) => {
            const values = arg.split(',').map(Number);

            if (
                values.length !== 6 ||
                values.some((v) => !Number.isInteger(v))
            ) {
                throw new Error(
                    'Each dice must have exactly 6 integer values.'
                );
            }

            return new Dice(values);
        });

        return diceSets;
    }
}
class SecureRandomizer {
    static generateSecureNumber(range) {
        const key = crypto.randomBytes(32).toString('hex');
        const number = crypto.randomInt(range);
        const hmac = crypto
            .createHmac('sha3-256', key)
            .update(number.toString())
            .digest('hex');

        return { number, key, hmac };
    }

    static validateRandomValue(key, number) {
        return crypto
            .createHmac('sha3-256', key)
            .update(number.toString())
            .digest('hex');
    }
}
class ProbabilityCalculator {
    static calculateProbabilities(diceSets) {
        const probabilities = [];

        diceSets.forEach((diceA, i) => {
            probabilities[i] = [];

            diceSets.forEach((diceB, j) => {
                probabilities[i][j] = this.calculateWinProbability(
                    diceA,
                    diceB
                );
            });
        });
        return probabilities;
    }

    static calculateWinProbability(diceA, diceB) {
        let wins = 0,
            total = 0;

        diceA.values.forEach((valueA) => {
            diceB.values.forEach((valueB) => {
                if (valueA > valueB) wins++;
                total++;
            });
        });

        return wins / total;
    }
}
class ProbabilityTable {
    static display(probabilities, diceSets) {
        console.log('Probability of the win for the user:');

        const table = new Table({
            head: [
                'User dice v',
                ...diceSets.map((dice) => dice.values.join(',')),
            ],

            colWidths: Array(diceSets.length + 1).fill(15),
        });

        probabilities.forEach((row, i) => {
            const rowData = [diceSets[i].values.join(',')];

            row.forEach((prob, j) => {
                if (i === j) {
                    rowData.push(`- (${prob.toFixed(4)})`);
                } else {
                    rowData.push(prob.toFixed(4));
                }
            });

            table.push(rowData);
        });

        console.log(table.toString());
    }
}
class Game {
    constructor(diceSets) {
        this.diceSets = diceSets;
    }

    start() {
        const probabilities = ProbabilityCalculator.calculateProbabilities(
            this.diceSets
        );

        console.log("Let's determine who makes the first move.");
        const { number, key, hmac } = SecureRandomizer.generateSecureNumber(2);

        console.log(
            `I selected a random value in the range 0..1 (HMAC=${hmac}).`
        );

        const guess = this.promptUser(
            'Try to guess my selection.',
            ['0', '1', 'X', '?'],
            probabilities
        );
        if (guess === 'X') return;

        const guessedNumber = parseInt(guess, 10);
        const verifiedHmac = SecureRandomizer.validateRandomValue(key, number);

        console.log(
            `My selection: ${number} (KEY=${key}, HMAC=${verifiedHmac}).`
        );

        if (guessedNumber === number) {
            console.log('You make the first move.');
        } else {
            console.log(
                `I make the first move and choose the [${this.diceSets[1].values.join(
                    ','
                )}] dice.`
            );
        }

        const diceChoice = this.promptUser(
            'Choose your dice:',
            this.diceSets
                .map((_, index) => index.toString())
                .concat(['X', '?']),
            probabilities
        );

        if (diceChoice === 'X') return;

        const playerDice = this.diceSets[parseInt(diceChoice, 10)];
        console.log(`You choose the [${playerDice.values.join(',')}] dice.`);

        this.playRound(playerDice, probabilities);
    }

    playRound(playerDice, probabilities) {
        console.log("It's time for my throw.");

        let {
            number: myNumber,
            key: myKey,
            hmac: myHmac,
        } = SecureRandomizer.generateSecureNumber(6);

        console.log(
            `I selected a random value in the range 0..5 (HMAC=${myHmac}).`
        );

        const playerNumber = this.promptForNumber(probabilities);
        if (playerNumber === 'X') return;

        const verifiedHmac = SecureRandomizer.validateRandomValue(
            myKey,
            myNumber
        );
        console.log(
            `My number is ${myNumber} (KEY=${myKey}, HMAC=${verifiedHmac}).`
        );

        const result = (myNumber + parseInt(playerNumber, 10)) % 6;
        console.log(
            `The result is ${myNumber} + ${playerNumber} = ${result} (mod 6).`
        );

        const myThrow = this.diceSets[1].values[myNumber];
        console.log(`My throw is ${myThrow}.`);

        console.log("It's time for your throw.");

        let {
            number: playerThrowNumber,
            key: playerThrowKey,
            hmac: playerThrowHmac,
        } = SecureRandomizer.generateSecureNumber(6);

        console.log(
            `I selected a random value in the range 0..5 (HMAC=${playerThrowHmac}).`
        );

        const playerThrowSelection = this.promptForNumber(probabilities);
        if (playerThrowSelection === 'X') return;

        const verifiedPlayerHmac = SecureRandomizer.validateRandomValue(
            playerThrowKey,
            playerThrowNumber
        );

        console.log(
            `My number is ${playerThrowNumber} (KEY=${playerThrowKey}, HMAC=${verifiedPlayerHmac}).`
        );

        const playerResult =
            (playerThrowNumber + parseInt(playerThrowSelection, 10)) % 6;

        console.log(
            `The result is ${playerThrowNumber} + ${playerThrowSelection} = ${playerResult} (mod 6).`
        );

        const playerThrow = playerDice.values[playerResult];
        console.log(`Your throw is ${playerThrow}.`);

        if (playerThrow > myThrow) {
            console.log(`You win (${playerThrow} > ${myThrow})!`);
        } else {
            console.log(`I win (${myThrow} >= ${playerThrow})!`);
        }
    }

    promptForNumber(probabilities) {
        return this.promptUser(
            'Add your number modulo 6.',
            ['0', '1', '2', '3', '4', '5', 'X', '?'],
            probabilities
        );
    }

    promptUser(message, validInputs, probabilities) {
        console.log(message);

        validInputs.forEach((input) =>
            console.log(
                `${
                    input === 'X' ? 'exit' : input === '?' ? 'help' : input
                } - ${input}`
            )
        );

        let input;
        while (true) {
            input = prompt('Your selection: ');

            if (validInputs.includes(input)) {
                if (input === '?') {
                    ProbabilityTable.display(probabilities, this.diceSets);
                } else {
                    return input;
                }
            } else {
                console.log(
                    `Invalid input. Please enter one of the following: ${validInputs.join(
                        ', '
                    )}.`
                );
            }
        }
    }
}

function handleError(error) {
    console.error(`Error: ${error.message}`);
    console.log(
        'Usage: node Game.js <dice1> <dice2> <dice3> ...\nExample: node Game.js 2,2,4,4,9,9 6,8,1,1,8,6 7,5,3,7,5,3'
    );
}

try {
    const diceSets = DiceParser.parseDiceSets(process.argv.slice(2));
    const game = new Game(diceSets);
    game.start();
} catch (error) {
    handleError(error);
}
