/* 星尘公会 · 像素画素材
 * 用字符串网格描述像素画，运行时渲染为 SVG（crispEdges 保证锐利像素感）。
 * 前台（main.js）与管理端（admin.js）共用。
 */
(function (root) {
  'use strict';

  var SPRITES = {
    /* 公会徽记：星盾 */
    shield: {
      palette: { S: '#c7cbe0', G: '#ffcb47', W: '#fff6d8' },
      rows: [
        '....SSSSSSSS....',
        '...SSSSSSSSSS...',
        '..SSSSSSSSSSSS..',
        '..SSGGGGGGGGSS..',
        '..SGGGGWWGGGGS..',
        '..SGGGWWWWGGGS..',
        '..SGGWWWWWWGGS..',
        '..SGGGWWWWGGGS..',
        '..SGGGGWWGGGGS..',
        '..SSGGGGGGGGSS..',
        '...SSGGGGGGSS...',
        '....SSGGGGSS....',
        '.....SSGGSS.....',
        '......SSSS......',
        '.......SS.......'
      ]
    },
    /* 职业图标 */
    sword: {
      palette: { W: '#ffffff', S: '#b9c0d8', G: '#ffcb47', H: '#8a5a3b' },
      rows: [
        '.....WS.....',
        '....WWSS....',
        '....WWSS....',
        '....WWSS....',
        '....WWSS....',
        '....WWSS....',
        '....WWSS....',
        '.GGGGGGGGGG.',
        '....HHHH....',
        '....HHHH....',
        '....HHHH....',
        '...HHHHHH...'
      ]
    },
    staff: {
      palette: { O: '#ffcb47', P: '#b983ff', W: '#ffffff', B: '#8a5a3b' },
      rows: [
        '....OOOO....',
        '...OPPPPO...',
        '...OPWPPO...',
        '...OPPPPO...',
        '....OOOO....',
        '.....BB.....',
        '.....BB.....',
        '.....BB.....',
        '.....BB.....',
        '.....BB.....',
        '.....BB.....',
        '....BBBB....'
      ]
    },
    bow: {
      palette: { W: '#a06a3c', S: '#e8e0c8' },
      rows: [
        '.....WW.....',
        '....WW.S....',
        '...WW...S...',
        '...W....S...',
        '...W....S...',
        '...W....S...',
        '...W....S...',
        '...WW..S....',
        '....WW.S....',
        '.....WW.....'
      ]
    },
    cross: {
      palette: { Y: '#ffcb47', W: '#fff6d8' },
      rows: [
        '....WYYY....',
        '....YYYY....',
        '....YYYY....',
        '.YYYYYYYYYY.',
        '.YYYYYYYYYY.',
        '....YYYY....',
        '....YYYY....',
        '....YYYY....',
        '....YYYY....',
        '....YYYY....'
      ]
    },
    dagger: {
      palette: { W: '#ffffff', S: '#b9c0d8', G: '#5cdb95', H: '#6b4a2f' },
      rows: [
        '........WS..',
        '.......WSS..',
        '......WSS...',
        '.....WSS....',
        '....WSS.....',
        '...WSS......',
        '..WSS.......',
        '.GGGG.......',
        '..HHH.......',
        '...HHH......',
        '....HHH.....'
      ]
    },
    crystal: {
      palette: { P: '#57b8ff', W: '#eaf7ff', G: '#ffcb47' },
      rows: [
        '....PPPP....',
        '...PPPPPP...',
        '..PPWPPPPP..',
        '..PPPPPPPP..',
        '..PPPPPPPP..',
        '...PPPPPP...',
        '....PPPP....',
        '..GGGGGGGG..',
        '..GGGGGGGG..',
        '...GGGGGG...'
      ]
    },
    /* 成员作品 */
    slime: {
      palette: { G: '#43d17c', W: '#eafff3', B: '#14324a' },
      rows: [
        '.....GGGGGG.....',
        '...GGGGGGGGGG...',
        '..GGWWGGGGGGGG..',
        '.GGWWGGGGGGGGGG.',
        '.GGBBGGGGGGBBGG.',
        'GGBBBGGGGGGBBBGG',
        'GGGGGGGGGGGGGGGG',
        'GGGGGGGGGGGGGGGG',
        'GGGGGGGBBGGGGGGG',
        'GGGGGGGBBBGGGGGG',
        'GGGGGGGGGGGGGGGG',
        '.GGGGGGGGGGGGGG.',
        '..GGGGGGGGGGGG..',
        '...GGGGGGGGGG...'
      ]
    },
    castle: {
      palette: { F: '#ff5d6c', B: '#8f9bb3', W: '#ffd75e', D: '#3a2c4f' },
      rows: [
        '.F.....FF.....F.',
        '.FF....FF....FF.',
        '..BB.BBBB.BB.BB.',
        '..BBBBBBBBBBBB..',
        '..BBWBBBBBBWBB..',
        '..BBBBBBBBBBBB..',
        '..BBBBBBBBBBBB..',
        '..BBBBBDBBBBBB..',
        '..BBBBDDDBBBBB..',
        '..BBBBDDDBBBBB..',
        '..BBBBDDDBBBBB..',
        '..BBBBDDDBBBBB..'
      ]
    },
    potion: {
      palette: { W: '#e8e0c8', B: '#8a5a3b', P: '#bfe8ff', L: '#c95bff' },
      rows: [
        '......WWWW......',
        '......WBBW......',
        '......WBBW......',
        '.......BB.......',
        '......PPPP......',
        '....PPPPPPPP....',
        '...PPPPPPPPPP...',
        '..PPPPLLLLLPPP..',
        '..PWLLLLLLLLPP..',
        '..PPLLLLLLLLPP..',
        '..PPLLLLLLLLPP..',
        '..PPPLLLLLLPPP..',
        '...PPPPPPPPPP...',
        '.....PPPPPP.....'
      ]
    },
    chest: {
      palette: { b: '#5a3a22', W: '#a06a3c', Y: '#ffd75e', G: '#c98f1b', B: '#2b1a10' },
      rows: [
        '..bbbbbbbbbbbb..',
        '..bWWWWWWWWWWb..',
        '..bWYWWWWWWYWb..',
        '..bWWWWWWWWWWb..',
        '..bbbbbbbbbbbb..',
        '..bGGGGGGGGGGb..',
        '..bGGGGYYYYGGb..',
        '..bGGGYBBYGGGb..',
        '..bGGGYBBYGGGb..',
        '..bGGGGYYYYGGb..',
        '..bGGGGGGGGGGb..',
        '..bbbbbbbbbbbb..'
      ]
    },
    ghost: {
      palette: { W: '#e8e6ff', K: '#2a2450' },
      rows: [
        '.....WWWWWW.....',
        '...WWWWWWWWWW...',
        '..WWWWWWWWWWWW..',
        '.WWKKWWWWWWKKWW.',
        '.WWKKWWWWWWKKWW.',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWKKKKWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WW.WWW.WWW.WWW.W'
      ]
    },
    mushroom: {
      palette: { R: '#ff5d5d', W: '#fff3e0', C: '#f0d8a8' },
      rows: [
        '.....RRRRRR.....',
        '...RRRRRRRRRR...',
        '..RWWRRRRRRWWR..',
        '.RWWWRRRRRRWWWR.',
        '.RRRRRRRRRRRRRR.',
        '.RRWWRRRRRRWWRR.',
        '..RRRRRRRRRRRR..',
        '...CCCCCCCCCC...',
        '...CCCCCCCCCC...',
        '...CCCCCCCCCC...',
        '....CCCCCCCC....'
      ]
    }
  };

  /* 网格 → SVG（同一行内相同颜色合并为一个 rect） */
  function spriteSVG(name, scale) {
    var sp = SPRITES[name];
    if (!sp) return '';
    scale = scale || 4;
    var rows = sp.rows, h = rows.length, w = 0, y;
    for (y = 0; y < h; y++) w = Math.max(w, rows[y].length);
    var out = '';
    for (y = 0; y < h; y++) {
      var row = rows[y], x = 0;
      while (x < row.length) {
        var ch = row[x];
        if (ch === '.' || ch === ' ') { x++; continue; }
        var x2 = x;
        while (x2 < row.length && row[x2] === ch) x2++;
        var c = sp.palette[ch];
        if (c) out += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" fill="' + c + '"/>';
        x = x2;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
      '" width="' + (w * scale) + '" height="' + (h * scale) +
      '" shape-rendering="crispEdges" aria-hidden="true">' + out + '</svg>';
  }

  /* 职业与在线时段（与服务端 CLASSES / TIME_SLOTS 保持一致） */
  var CLASSES = [
    { id: 'warrior',  name: '战士', sprite: 'sword',   color: '#d7d7e8' },
    { id: 'mage',     name: '法师', sprite: 'staff',   color: '#b983ff' },
    { id: 'archer',   name: '弓手', sprite: 'bow',     color: '#5cdb95' },
    { id: 'priest',   name: '牧师', sprite: 'cross',   color: '#ffcb47' },
    { id: 'rogue',    name: '刺客', sprite: 'dagger',  color: '#ff5d6c' },
    { id: 'summoner', name: '术士', sprite: 'crystal', color: '#57b8ff' }
  ];

  var TIME_SLOTS = [
    { id: 'wd-morning',   label: '工作日 · 上午' },
    { id: 'wd-afternoon', label: '工作日 · 下午' },
    { id: 'wd-night',     label: '工作日 · 晚上' },
    { id: 'wd-late',      label: '工作日 · 深夜' },
    { id: 'we-day',       label: '周末 · 白天' },
    { id: 'we-night',     label: '周末 · 晚上' }
  ];

  root.SPRITES = SPRITES;
  root.spriteSVG = spriteSVG;
  root.CLASSES = CLASSES;
  root.TIME_SLOTS = TIME_SLOTS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SPRITES: SPRITES, spriteSVG: spriteSVG, CLASSES: CLASSES, TIME_SLOTS: TIME_SLOTS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
