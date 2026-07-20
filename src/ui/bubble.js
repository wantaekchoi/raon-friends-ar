import { CONFIG } from '../config.js';

let timer = null;

export function showLine(line) {
  const bubble = document.getElementById('bubble');
  const name = document.getElementById('bubble-name');
  const text = document.getElementById('bubble-text');

  bubble.hidden = false;
  name.textContent = CONFIG.characters[line.speaker].name;

  clearInterval(timer);
  let i = 0;
  text.textContent = '';
  timer = setInterval(() => {
    text.textContent = line.text.slice(0, ++i);
    if (i >= line.text.length) clearInterval(timer);
  }, 35);
}
