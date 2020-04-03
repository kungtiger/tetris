(function(fn) {
    if (document.readyState != 'loading') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }

})(function() {
    var floor = function(x) {
        return Math.floor(x);
    };
    var rand = function(min, max) {
        return floor(Math.random() * (max - min + 1)) + min;
    };
    var $ = function(id) {
        return document.getElementById(id);
    };
    var each = function(obj, fn, scope) {
        var p, l;
        if (!obj) {
            return obj;
        }
        scope = scope || obj;
        if (typeof obj.length != 'undefined') {
            for (p = 0, l = obj.length; p < l; p++) {
                if (fn.call(scope, obj[p], p, obj) === false) {
                    return obj;
                }
            }
        } else {
            for (p in obj) {
                if (fn.call(scope, obj[p], p, obj) == false) {
                    return  obj;
                }
            }
        }
        return obj;
    };
    var matrix = function() {
        var m, n, fn;
        if (typeof arguments[1] == 'function') {
            m = Tetriminos[arguments[0]].width;
            n = Tetriminos[arguments[0]].height;
            fn = arguments[1];
        } else {
            m = arguments[0];
            n = arguments[1];
            fn = arguments[2];
        }
        var x, y, r;
        for (x = 0; x < m; x++) {
            for (y = 0; y < n; y++) {
                r = fn(x, y);
                if (r === false) {
                    return false;
                }
            }
        }
        return true;
    };

    var width = 12, // width of the field including walls
    height = 22, // height of the field including walls
    tick = 50, // basic game tick in ms
    difficulty = 60, // every amount of these ticks decrease loop delay
    speed = 30, // after this number of ticks the piece will drop
    minSpeed = 5,
    baseScore = 25,
    lineScore = 100, // 2 ^ lines * lineScore
    size = 18,
    emboss = 2,
    center = size - 2 * emboss;

    var State = [],
    loop, completeLines,
    gameRunning = false,
    next, current, curTheta, curX, curY, gameOver, currentPainter,
    currentSpeed, tickCount, canRotate, canMove, manualDrop, totalTicks, score, level, lines;


    var Highscore = {
        add: function(level, score, lines) {
            var list = Settings.get('highscore', []);
            list.push({level: level, score: score, lines: lines});
            list.sort(this.compare);
            list = list.slice(0, 15);
            Settings.set('highscore', list);
            Settings.save();
        },
        compare: function(a, b) {
            if (a.score > b.score) {
                return -1;
            } else if (b.score > a.score) {
                return 1;
            }
            if (a.lines > b.lines) {
                return -1;
            } else if (b.lines > a.lines) {
                return 1;
            }
            return a.level > b.level ? -1 : (b.level > a.level ? 1 : 0);
        }
    };

    var WHITE = [255, 255, 255], BLACK = [0, 0, 0];
    var mixColors = function(a, b, f) {
        var c;
        switch (f) {
            case 0:
                c = a;
                break;
            case 1:
                c = b;
                break;
            default:
                c = [
                    a[0] + (b[0] - a[0]) * f,
                    a[1] + (b[1] - a[1]) * f,
                    a[2] + (b[2] - a[2]) * f
                ];
        }
        return 'rgb(' + c.join(',') + ')';
    };

    var Painter = {
        embossed: {
            Colors: {},
            setup: function() {
                var color;
                each(Tetriminos, function(tetrimino, type) {
                    color = tetrimino.color;
                    this.Colors[type] = {
                        center: mixColors(color, WHITE, 0),
                        north: mixColors(color, WHITE, .2),
                        east: mixColors(color, BLACK, .2),
                        south: mixColors(color, BLACK, .3),
                        west: mixColors(color, WHITE, .1)
                    };
                }, this);

                color = [20, 20, 20];
                this.Colors[BLANK] = {
                    center: mixColors(color, WHITE, 0),
                    north: mixColors(color, WHITE, .05),
                    east: mixColors(color, BLACK, .1),
                    south: mixColors(color, BLACK, .1),
                    west: mixColors(color, WHITE, .05)
                };

                color = [80, 80, 80];
                this.Colors[WALL] = {
                    center: mixColors(color, WHITE, 0),
                    north: mixColors(color, WHITE, .2),
                    east: mixColors(color, BLACK, .2),
                    south: mixColors(color, BLACK, .3),
                    west: mixColors(color, WHITE, .1)
                };

                var s = size, b = emboss;
                this.Trapezoids = {
                    north: [0, 0, s, 0, s - b, b, b, b],
                    east: [s, 0, s, s, s - b, s - b, s - b, b],
                    south: [0, s, s, s, s - b, s - b, b, s - b],
                    west: [0, 0, 0, s, b, s - b, b, b]
                };
            },
            block: function(canvas, x, y, type) {
                canvas.fillStyle = this.Colors[type].center;
                canvas.fillRect(x + emboss, y + emboss, center, center);

                each(this.Trapezoids, function(v, area) {
                    canvas.fillStyle = this.Colors[type][area];
                    canvas.beginPath();
                    canvas.moveTo(x + v[0], y + v[1]);
                    canvas.lineTo(x + v[2], y + v[3]);
                    canvas.lineTo(x + v[4], y + v[5]);
                    canvas.lineTo(x + v[6], y + v[7]);
                    canvas.fill();
                }, this);
            }
        },
        flat: {
            Colors: {},
            setup: function() {
                each(Tetriminos, function(tetrimino, i) {
                    this.Colors[i] = {
                        fill: 'rgb(' + tetrimino.color.join(', ') + ')',
                        border: mixColors(tetrimino.color, BLACK, .4)
                    };
                }, this);
                this.Colors[BLANK] = {
                    fill: 'rgb(20,20,20)',
                    border: 'rgb(14,14,14)'
                };
                this.Colors[WALL] = {
                    fill: 'rgb(80,80,80)',
                    border: 'rgb(65,65,65)'
                };
            },
            block: function(canvas, x, y, type) {
                canvas.strokeStyle = this.Colors[type].border;
                canvas.fillStyle = this.Colors[type].fill;
                canvas.fillRect(x, y, size, size);
                canvas.strokeRect(x + .5, y + .5, size - 1, size - 1);
            }
        }
    };

    var Game = function() {
        if (!gameRunning) {
            return;
        }

        if (gameOver) {
            endGame();
            return;
        }

        tickCount++;

        Game.move();
        Game.rotate();
        Game.drop();
        Game.autoDrop();

        paintBlocks();
        startLoop();
    };

    Game.move = function() {
        each({left: -1, right: 1}, function(f, cursor) {
            if (Keyboard.current == cursor) {
                if (canMove === true || (canMove < 0 && blockCanFit(current, curX + f, curY, curTheta))) {
                    curX += f;
                }
                if (canMove === true) {
                    canMove = Settings.get('cursorDelay');
                } else {
                    canMove--;
                }
            }
        });
    };
    Game.rotate = function() {
        if (Keyboard.current == 'up') {
            if (canRotate) {
                var translation = getTranslation();
                if (translation) {
                    curX = translation.x;
                    curY = translation.y;
                    curTheta++;
                }
            }
            canRotate = false;
        } else {
            canRotate = true;
        }
    };
    Game.drop = function() {
        manualDrop = false;
        if (Keyboard.current == 'down') {
            if (blockCanFit(current, curX, curY + 1, curTheta)) {
                curY++;
                manualDrop = true;
            }
        }
    };
    Game.autoDrop = function() {
        if (tickCount < currentSpeed) {
            return;
        }

        tickCount = 0;
        totalTicks++;
        if (totalTicks % difficulty == 0 && currentSpeed >= minSpeed) {
            currentSpeed--;
            level++;
        }

        if (blockCanFit(current, curX, curY + 1, curTheta)) {
            curY += manualDrop ? 0 : 1;
            return;
        }

        // place the current tetrimino onto the field
        matrix(current, function(x, y) {
            if (hasBlock(current, x, y, curTheta)) {
                State[(curX + x) + (curY + y) * width] = current;
            }

        });

        // check for complete lines
        var x, y;
        for (y = 0; y < 4; y++) {
            if (curY + y < height - 1) {
                var completedLine = true;
                for (x = 1; x < width - 1; x++) {
                    if (!State[x + (curY + y) * width]) {
                        completedLine = false;
                        break;
                    }
                }

                if (completedLine) {
                    completeLines.push(curY + y);
                    lines++;
                }
            }
        }

        // remove complete lines and add score
        if (completeLines.length > 0) {
            score += (1 << completeLines.length) * lineScore;
            for (var i = 0; i < completeLines.length; i++) {
                for (x = 0; x < width; x++) {
                    for (y = completeLines[i]; y > 1; y--) {
                        State[y * width + x] = State[(y - 1) * width + x];
                    }
                }
            }
            completeLines = [];
        } else {
            score += baseScore;
        }

        nextPiece();

        if (!blockCanFit(current, curX, curY, curTheta)) {
            gameOver = true;
            current = BLANK;
        }
    };

    var getTranslation = function() {
        var translations = [[0, 0], [-1, 0]];
        if (current == 1) {
            translations = Tetriminos[1].kick;
        }
        var x, y;
        for (var i = 0; i < translations.length; i++) {
            x = curX + translations[i][0];
            y = curY + translations[i][1];
            if (blockCanFit(current, x, y, curTheta + 1)) {
                return {x: x, y: y};
            }
        }
        return false;
    };

    var hasBlock = function(type, x, y, theta) {
        var i = x + Tetriminos[type].width * y;
        return !!Tetriminos[type][theta % Tetriminos[type].theta][i];
    };

    var blockCanFit = function(type, x, y, theta) {
        var i;
        return matrix(type, function(_x, _y) {
            if (y + _y >= 0 && x + _x < width && y + _y >= 0 && y + _y < height) {
                i = (x + _x) + width * (y + _y);
                if (hasBlock(type, _x, _y, theta) && State[i]) {
                    return false;
                }
            }
        });
    };

    var isWall = function(x, y) {
        return x == 0 || x == width - 1 || y == 0 || y == height - 1;
    };

    var clearField = function() {
        matrix(width, height, function(x, y) {
            State[x + y * width] = isWall(x, y) ? WALL : BLANK;
        });
    };

    var Bag = {
        _seed: [1, 2, 3, 4, 5, 6, 7],
        _current: [],
        _next: [],
        shuffel: function() {
            var list = this._seed.slice();
            // fisher-yates-shuffle
            for (var i = 6, j, t; i > 0; i--) {
                j = Math.floor(Math.random() * (i + 1));
                t = list[i];
                list[i] = list[j];
                list[j] = t;
            }
            return list;
        },
        reset: function() {
            this._current = this.shuffel();
            this._next = this.shuffel();
        },
        next: function() {
            if (this._current.length == 1) {
                return this._next[0];
            }
            return this._current[1];
        },
        current: function() {
            var item = this._current.shift();
            if (!this._current.length) {
                this._current = this._next;
                this._next = this.shuffel();
            }
            return item;
        }
    };

    var nextPiece = function() {
        if (Settings.get('randomGenerator') == 'bag') {
            next = Bag.next();
            current = Bag.current();
        } else {
            current = next;
            next = rand(1, 7);
        }
        curX = current == 4 ? 5 : 4;
        curY = 1;
        curTheta = 0;
    };

    var paintTetrimino = function(canvas, type, x, y, theta) {
        matrix(type, function(_x, _y) {
            if (hasBlock(type, _x, _y, theta)) {
                paintBlock(canvas, (x + _x), (y + _y), type);
            }
        });
    };

    var paintBlocks = function() {
        if (gameRunning) {
            UI.scoreNum.innerHTML = score;
            UI.levelNum.innerHTML = level;
            UI.linesNum.innerHTML = lines;
        }

        Blocks.clearRect(0, 0, UI.blocks.width, UI.blocks.height);
        matrix(width - 2, height - 2, function(x, y) {
            paintBlock(Blocks, ++x, ++y, State[x + y * width]);
        });

        if (current) {
            paintTetrimino(Blocks, current, curX, curY, curTheta);
        }

        Preview.clearRect(0, 0, 4 * size, 4 * size);
        if (next) {
            paintTetrimino(Preview, next, 0, 0, 0);
        }
    };

    var paintBlock = function(canvas, x, y, type) {
        if (type != BLANK || _paintBlanks) {
            var painter = Painter[currentPainter];
            painter.block.call(painter, canvas, x * size, y * size, type);
        }
    };

    var _paintBlanks = false;
    var paintField = function() {
        _paintBlanks = true;
        Field.clearRect(0, 0, UI.field.width, UI.field.height);
        matrix(width, height, function(x, y) {
            paintBlock(Field, x, y, isWall(x, y) ? WALL : BLANK);
        });
        _paintBlanks = false;
    };

    var startLoop = function() {
        loop = window.setTimeout(Game, tick);
    };
    var stopLoop = function() {
        window.clearTimeout(loop);
    };

    var resetGame = function() {
        next = BLANK;
        current = BLANK;
        score = 0;
        level = 1;
        lines = 0;
        currentSpeed = speed;
        tickCount = 0;
        totalTicks = 0;
        gameOver = false;
        canRotate = true;
        canMove = true;
        manualDrop = false;
        completeLines = [];
        Bag.reset();
        clearField();
    };

    var startGame = function() {
        stopLoop();
        resetGame();

        gameRunning = true;
        nextPiece();

        UI.pause.title = l10n.pause;

        UI.tetris.classList.remove('game-over');
        UI.tetris.classList.remove('game-paused');

        startLoop();
        paintBlocks();
    };

    var pauseGame = function() {
        if (!gameRunning || gameOver) {
            return;
        }

        stopLoop();
        gameRunning = false;

        UI.tetris.classList.add('game-paused');
        UI.pause.title = l10n.resume;
        UI.status.innerHTML = l10n.paused;

        each(Keyboard.cursor, function(cursor) {
            UI[cursor].disabled = true;
        });
    };

    var resumeGame = function() {
        if (gameOver) {
            return;
        }

        UI.tetris.classList.remove('game-paused');
        UI.pause.title = l10n.pause;

        each(Keyboard.cursor, function(cursor) {
            UI[cursor].disabled = false;
        });

        gameRunning = true;
        startLoop();
    };

    var endGame = function() {
        stopLoop();
        gameRunning = false;

        if (gameOver) {
            UI.tetris.classList.add('game-over');
            UI.status.innerHTML = l10n.gameOver;
            Highscore.add(level, score, lines);
        }
    };

    var toggleGame = function() {
        gameRunning ? pauseGame() : resumeGame();
    };

    var UI = {};
    each('tetris,pause,levelNum,scoreNum,linesNum,status,field,blocks,preview,cursors'.split(','), function(id) {
        UI[id] = $(id);
    });

    var Blocks = UI.blocks.getContext('2d'),
    Field = UI.field.getContext('2d'),
    Preview = UI.preview.getContext('2d');

    UI.blocks.width = width * size;
    UI.blocks.height = height * size;

    UI.field.width = UI.blocks.width;
    UI.field.height = UI.blocks.height;

    UI.preview.width = 4 * size;
    UI.preview.height = 4 * size;

    var BLANK = 0, WALL = 8;

    var l10n = {
        play: 'New Game',
        pause: 'Pause',
        paused: 'Paused',
        resume: 'Resume',
        score: 'Score',
        level: 'Level',
        lines: 'Lines',
        next: 'Next',
        gameOver: 'Game Over',
        showCursors: 'Show navigation cursors',
        paintStyle: 'Block appearance',
        randomGenerator: 'Generate blocks',
        bag: 'in random sequence',
        rand: 'completly random',
        cursorDelay: 'Cursor delay',
        ms: '%sms',
        embossed: 'Embossed',
        flat: 'Flat',
        highscore: 'Score: %1 | Level: %3 | Lines: %2',
        noHighscores: 'No Highscores'
    };

    var Tetriminos = {
        1: {
            name: 'I',
            width: 4,
            height: 4,
            theta: 2,
            kick: [[0, 0], [-1, 0], [1, 0], [2, 0]],
            color: [0, 240, 240], // aqua
            0: '0000111100000000',
            1: '0010001000100010',
            2: '0000000011110000',
            3: '0100010001000100'
        },
        2: {
            name: 'J',
            width: 3,
            height: 3,
            theta: 4,
            color: [0, 0, 260], // blue
            0: '100111000',
            1: '110100100',
            2: '111001000',
            3: '010010110'
        },
        3: {
            name: 'L',
            width: 3,
            height: 3,
            theta: 4,
            color: [240, 160, 0], // orange
            0: '001111000',
            1: '100100110',
            2: '111100000',
            3: '110010010'
        },
        4: {
            name: 'O',
            width: 2,
            height: 2,
            theta: 1,
            color: [240, 240, 0], // yellow
            0: '1111'
        },
        5: {
            name: 'S',
            width: 3,
            height: 3,
            theta: 2,
            color: [0, 240, 0], // green
            0: '011110000',
            1: '100110010'
        },
        6: {
            name: 'T',
            width: 3,
            height: 3,
            theta: 4,
            color: [160, 0, 240], // purple
            0: '010111000',
            1: '100110100',
            2: '111010000',
            3: '010110010'
        },
        7: {
            name: 'Z',
            width: 3,
            height: 3,
            theta: 2,
            color: [240, 0, 0], // red
            0: '110011000',
            1: '010110100'
        }
    };

    each(Tetriminos, function(tetrimino) {
        for (var i = 0; i < tetrimino.theta; i++) {
            tetrimino[i] = tetrimino[i].split('').map(function(x) {
                return x == '1';
            });
        }
    });

    each('play,level,score,lines,next'.split(','), function(el) {
        UI[el] = $(el);
        UI[el].innerHTML = l10n[el];
    });

    UI.play.addEventListener('click', startGame);
    UI.pause.addEventListener('click', toggleGame);

    var Keyboard = {
        cursor: {
            ArrowUp: 'up',
            ArrowDown: 'down',
            ArrowLeft: 'left',
            ArrowRight: 'right'
        },
        current: false,
        press: function(event) {
            if (event.repeat) {
                return;
            }

            if (Keyboard.current === false) {
                each(Keyboard.cursor, function(cursor, key) {
                    if (key == event.key) {
                        Keyboard.current = cursor;
                        return false;
                    }
                });
            }

            switch (event.key) {
                case ' ':
                case 'p':
                    toggleGame();
                    break;

                case 'n':
                    startGame();
                    break;
            }
        },
        release: function(event) {
            if (Keyboard.current !== false) {
                each(Keyboard.cursor, function(cursor, key) {
                    if (key == event.key && Keyboard.current == cursor) {
                        Keyboard.current = false;
                        canMove = true;
                        return false;
                    }
                });
            }
        }
    };

    window.addEventListener('keydown', Keyboard.press);
    window.addEventListener('keyup', Keyboard.release);

    each(Keyboard.cursor, function(cursor) {
        UI[cursor] = $(cursor);
        UI[cursor].addEventListener('mousedown', function() {
            if (Keyboard.current === false) {
                Keyboard.current = cursor;
            }
        });
        UI[cursor].addEventListener('mouseup', function() {
            if (Keyboard.current == cursor) {
                Keyboard.current = false;
            }
        });
    });

    var gamePaused = false;
    var Dialogs = {
        highscores: function() {
            var buffer = l10n.noHighscores;
            var list = Settings.get('highscore', []);
            if (list.length) {
                buffer = [];
                var i, n = 0, idx, item;
                for (i = 0; i < 15; i++) {
                    n++;
                    item = list[i];
                    idx = '#' + n + (n < 10 ? ' ' : '');
                    if (item) {
                        buffer.push(idx + ' ' + l10n.highscore
                        .replace('%1', item.score)
                        .replace('%2', item.lines)
                        .replace('%3', item.level));
                    } else {
                        buffer.push(idx);
                    }
                }
                ;
                buffer = buffer.join('\n');
            }
            $('highscoreList').innerHTML = buffer;
        },
        settings: function() {

        }
    };

    each(Dialogs, function(fn, id) {
        var Dialog = $(id);
        $('show_' + id).addEventListener('mousedown', function() {
            gamePaused = !gameRunning;
            pauseGame();
            Dialog.classList.add('shown');
            fn.call(Dialog);
        });
        $('close_' + id).addEventListener('mousedown', function() {
            Dialog.classList.remove('shown');
            !gamePaused && resumeGame();
        });
    });

    var Settings = {
        _key: 'tetris-pure-and-simple',
        _data: {},
        init: function() {
            var value = window.localStorage.getItem(this._key);
            this._data = value ? JSON.parse(value) : {};

            each(Settings.fields, function(init, name) {
                UI[name] = $(name);
                var type;
                if (UI[name].tagName.toLowerCase() == 'select') {
                    type = 'select';
                } else if (UI[name].type == 'checkbox') {
                    type = 'checkbox';
                }
                if (!type) {
                    return;
                }

                UI[name].addEventListener('change', function() {
                    var value;
                    switch (type) {
                        case 'select':
                            value = this.value;
                            break;
                        case 'checkbox':
                            value = this.checked;
                            break;
                    }
                    Settings.set(name, value);
                    Settings.save();
                    init.change && init.change.call(this, value);
                });


                var value = Settings.get(name, init.default);
                if (init.init) {
                    init.init.call(UI[name], UI[name], value);
                }
                switch (type) {
                    case 'select':
                        UI[name].value = value;
                        break;
                    case 'checkbox':
                        UI[name].checked = value;
                        break;
                }

                $(name + 'Label').innerHTML = l10n[name];
                init.change && init.change.call(UI[name], value);
            });
        },
        save: function() {
            window.localStorage.setItem(this._key, JSON.stringify(this._data));
        },
        set: function(key, value) {
            this._data[key] = value;
        },
        get: function(key, fallback) {
            if (Settings.fields[key]) {
                fallback = Settings.fields[key].default;
            }
            return this._data.hasOwnProperty(key) ? this._data[key] : fallback;
        },
        fields: {
            showCursors: {
                default: true,
                change: function(value) {
                    UI.cursors.classList[value ? 'remove' : 'add']('hidden');
                }
            },
            paintStyle: {
                default: 'embossed',
                init: function(el) {
                    each(Painter, function(_, name) {
                        var option = document.createElement('option');
                        option.value = name;
                        option.innerHTML = l10n[name];
                        el.appendChild(option);
                    });
                },
                change: function(value) {
                    currentPainter = value;
                    paintField();
                    paintBlocks();
                }
            },
            randomGenerator: {
                default: 'bag',
                init: function(el) {
                    each(['bag', 'rand'], function(state) {
                        var option = document.createElement('option');
                        option.value = state;
                        option.innerHTML = l10n[state];
                        el.appendChild(option);
                    });
                }
            },
            cursorDelay: {
                default: 2,
                init: function(el) {
                    for (var i = 1; i < 5; i++) {
                        var option = document.createElement('option');
                        option.value = i;
                        option.innerHTML = l10n.ms.replace('%s', i * tick);
                        el.appendChild(option);
                    }
                }
            }
        }
    };

    clearField();
    each(Painter, function(painter) {
        painter.setup.call(painter);
    });
    Settings.init();

    var paintTest = function() {
        var el = $('test');
        el.width = size * 19;
        el.height = size * 30;
        var canvas = el.getContext('2d');
        var i = 0, x, y = 1, r;
        each(Tetriminos, function(tetrimino, type) {
            for (r = 0; r < tetrimino.theta; r++) {
                x = 1 + r * 5;
                paintTetrimino(canvas, type, x, y, r);
            }
            y += tetrimino.height + 1;
            i++;
        });
    };

    if (0) {
        paintTest();
    } else {
        startGame();
    }
});